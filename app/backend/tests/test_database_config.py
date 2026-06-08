import importlib
import os
import unittest


os.environ["APP_ENV"] = "development"
os.environ["ALLOW_SQLITE_FOR_TESTS"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import app.core.config as config_module


class DatabaseConfigTests(unittest.TestCase):
    def setUp(self):
        self.original_env = {
            "APP_ENV": os.environ.get("APP_ENV"),
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
            "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY"),
            "SUPABASE_JWT_SECRET": os.environ.get("SUPABASE_JWT_SECRET"),
            "ALLOW_SQLITE_FOR_TESTS": os.environ.get("ALLOW_SQLITE_FOR_TESTS"),
        }

    def tearDown(self):
        for key, value in self.original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        importlib.reload(config_module)

    def _reload(self):
        return importlib.reload(config_module)

    def test_development_normalizes_postgres_urls(self):
        os.environ["APP_ENV"] = "development"
        os.environ["DATABASE_URL"] = "postgres://user:secret@localhost:5432/nexusops"

        reloaded = self._reload()

        self.assertEqual(
            reloaded.DATABASE_URL,
            "postgresql+psycopg://user:secret@localhost:5432/nexusops",
        )
        self.assertEqual(reloaded.DATABASE_BACKEND, "postgresql")

    def test_staging_rejects_sqlite(self):
        os.environ["APP_ENV"] = "staging"
        os.environ["DATABASE_URL"] = "sqlite:///./nexusops-dev.db"
        os.environ["JWT_SECRET_KEY"] = "staging-secret"
        os.environ.pop("ALLOW_SQLITE_FOR_TESTS", None)

        with self.assertRaisesRegex(RuntimeError, "SQLite is not allowed"):
            self._reload()


if __name__ == "__main__":
    unittest.main()
