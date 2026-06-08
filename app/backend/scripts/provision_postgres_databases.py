from __future__ import annotations

import os
from pathlib import Path

import psycopg
from psycopg import sql


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _load_env_file() -> None:
    env_path = BACKEND_ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


def _database_url(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    if value.startswith("postgresql+psycopg://"):
        return "postgresql://" + value[len("postgresql+psycopg://"):]
    return value


def _database_name_from_url(url: str) -> str:
    stripped = url.split("?", 1)[0].rstrip("/")
    return stripped.rsplit("/", 1)[-1]


def _admin_url(url: str) -> str:
    if "?" in url:
        base, query = url.split("?", 1)
        return base.rsplit("/", 1)[0] + "/postgres" + ("?" + query if query else "")
    return url.rsplit("/", 1)[0] + "/postgres"


def _ensure_database(url: str) -> None:
    db_name = _database_name_from_url(url)
    admin_url = _admin_url(url)

    with psycopg.connect(admin_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            if cur.fetchone():
                print(f"Database already exists: {db_name}")
                return
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
            print(f"Created database: {db_name}")


def main() -> int:
    _load_env_file()
    _ensure_database(_database_url("DATABASE_URL"))
    _ensure_database(_database_url("TEST_DATABASE_URL"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
