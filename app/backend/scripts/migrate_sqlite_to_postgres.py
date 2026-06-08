import argparse
from collections.abc import Iterable
from datetime import UTC, datetime
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, MetaData, create_engine, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.sql.schema import Table


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = SCRIPT_DIR.parent
DEFAULT_SQLITE_URL = f"sqlite:///{(BACKEND_ROOT / 'nexusops-dev.db').resolve().as_posix()}"
REPORTS_DIR = BACKEND_ROOT / "private" / "migration-reports"
SKIPPED_TABLES = {"schema_migrations"}


def normalize_database_url(value: str) -> str:
    normalized = value.strip()
    if normalized.startswith("postgres://"):
        return "postgresql+psycopg://" + normalized[len("postgres://"):]
    if normalized.startswith("postgresql://") and "+psycopg" not in normalized.split("://", 1)[0]:
        return "postgresql+psycopg://" + normalized[len("postgresql://"):]
    return normalized


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy NexusOps data from SQLite into a PostgreSQL database that already has the target schema."
    )
    parser.add_argument(
        "--sqlite-url",
        default=os.getenv("SQLITE_DATABASE_URL", DEFAULT_SQLITE_URL),
        help=f"Source SQLite URL. Defaults to {DEFAULT_SQLITE_URL}",
    )
    parser.add_argument(
        "--postgres-url",
        default=os.getenv("POSTGRES_DATABASE_URL") or os.getenv("DATABASE_URL"),
        help="Target PostgreSQL URL. Falls back to POSTGRES_DATABASE_URL or DATABASE_URL.",
    )
    parser.add_argument(
        "--truncate-target",
        action="store_true",
        help="Delete rows from matching PostgreSQL tables before copying data.",
    )
    parser.add_argument(
        "--bootstrap-target",
        action="store_true",
        help="Run the managed backend migration script against the PostgreSQL target before copying rows.",
    )
    return parser.parse_args()


def _coerce_value(value: Any, target_column) -> Any:
    if value is None:
        return None

    python_type = None
    try:
        python_type = target_column.type.python_type
    except (AttributeError, NotImplementedError):
        python_type = None

    if isinstance(target_column.type, JSON) and isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return value

    if python_type is bool and isinstance(value, int):
        return bool(value)

    if python_type is UUID and isinstance(value, str):
        return UUID(value)

    return value


def _count_rows(connection, table: Table) -> int:
    return int(connection.execute(select(func.count()).select_from(table)).scalar_one())


def _truncate_tables(connection, tables: Iterable[Table]) -> None:
    for table in reversed(list(tables)):
        connection.execute(table.delete())


def _bootstrap_target_schema(postgres_url: str) -> None:
    env = os.environ.copy()
    env["APP_ENV"] = "development"
    env["DATABASE_URL"] = postgres_url

    subprocess.run(
        [sys.executable, str(SCRIPT_DIR / "migrate.py")],
        check=True,
        cwd=str(BACKEND_ROOT),
        env=env,
    )


def _load_table_maps(sqlite_engine, postgres_engine) -> tuple[dict[str, Table], dict[str, Table]]:
    source_metadata = MetaData()
    target_metadata = MetaData()
    source_metadata.reflect(bind=sqlite_engine)
    target_metadata.reflect(bind=postgres_engine)
    return (
        {table.name: table for table in source_metadata.sorted_tables},
        {table.name: table for table in target_metadata.sorted_tables},
    )


def main() -> int:
    args = parse_args()
    postgres_url = normalize_database_url(args.postgres_url or "")
    sqlite_url = args.sqlite_url.strip()

    if not sqlite_url.startswith("sqlite"):
        raise RuntimeError("The source database must be SQLite.")
    if not postgres_url.startswith("postgresql"):
        raise RuntimeError("The target database must be PostgreSQL.")

    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    postgres_engine = create_engine(postgres_url, pool_pre_ping=True)

    if args.bootstrap_target:
        _bootstrap_target_schema(postgres_url)

    source_tables, target_tables = _load_table_maps(sqlite_engine, postgres_engine)
    if not target_tables:
        raise RuntimeError("No tables were found in the PostgreSQL target. Run python scripts/migrate.py first.")

    ordered_target_tables = [table for table in target_tables.values() if table.name not in SKIPPED_TABLES]
    report: dict[str, Any] = {
        "started_at": datetime.now(UTC).isoformat(),
        "sqlite_url": sqlite_url,
        "postgres_url": postgres_url,
        "truncate_target": args.truncate_target,
        "bootstrap_target": args.bootstrap_target,
        "tables": [],
        "failed_rows": [],
    }

    with sqlite_engine.connect() as source_conn, postgres_engine.begin() as target_conn:
        if args.truncate_target:
            _truncate_tables(target_conn, ordered_target_tables)

        for target_table in ordered_target_tables:
            source_table = source_tables.get(target_table.name)
            if source_table is None:
                report["tables"].append(
                    {
                        "table": target_table.name,
                        "status": "skipped_missing_source_table",
                    }
                )
                continue

            source_rows = source_conn.execute(select(source_table)).mappings().all()
            source_count = len(source_rows)
            inserted = 0
            failed = 0

            if source_rows:
                payload = []
                for row in source_rows:
                    payload.append(
                        {
                            column.name: _coerce_value(row.get(column.name), column)
                            for column in target_table.columns
                            if column.name in row
                        }
                    )

                try:
                    target_conn.execute(target_table.insert(), payload)
                    inserted = source_count
                except IntegrityError:
                    for row in payload:
                        try:
                            target_conn.execute(target_table.insert().values(**row))
                            inserted += 1
                        except SQLAlchemyError as exc:
                            failed += 1
                            report["failed_rows"].append(
                                {
                                    "table": target_table.name,
                                    "error": str(exc),
                                    "row": row,
                                }
                            )

            target_count = _count_rows(target_conn, target_table)
            report["tables"].append(
                {
                    "table": target_table.name,
                    "status": "completed",
                    "source_count": source_count,
                    "inserted": inserted,
                    "failed": failed,
                    "target_count": target_count,
                }
            )

    report["finished_at"] = datetime.now(UTC).isoformat()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"sqlite_to_postgres_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
    report_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    print(f"Migration report written to {report_path}")
    for table_result in report["tables"]:
        table_name = table_result["table"]
        status = table_result["status"]
        source_count = table_result.get("source_count", 0)
        inserted = table_result.get("inserted", 0)
        failed = table_result.get("failed", 0)
        print(f"{table_name}: {status} source={source_count} inserted={inserted} failed={failed}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
