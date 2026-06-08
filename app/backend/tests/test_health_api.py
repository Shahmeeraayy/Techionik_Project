import os
import unittest

from fastapi.testclient import TestClient


_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "health_api_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["ALLOW_SQLITE_FOR_TESTS"] = "1"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import engine
from app.main import app
from app.models.base import Base


class HealthApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    def test_health_db_reports_local_sqlite_mode(self):
        response = self.client.get("/health/db")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {
                "database": "sqlite",
                "status": "connected",
                "environment": "development",
                "mode": "local_development_only",
            },
        )


if __name__ == "__main__":
    unittest.main()
