import os
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "admin_jobs_api_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["ALLOW_SQLITE_FOR_TESTS"] = "1"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.job import Job
from app.models.job_event import JobEvent
from app.models.technician_password_reset_request import TechnicianPasswordResetRequest


class AdminJobsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        token_response = cls.client.post(
            "/auth/dev/admin-token",
            json={"email": "admin@nexusops.com", "password": "NexusOps!Admin2026"},
        )
        assert token_response.status_code == 200
        cls.auth_header = {"Authorization": f"Bearer {token_response.json()['access_token']}"}

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    def setUp(self):
        with SessionLocal() as db:
            db.query(JobEvent).delete()
            db.query(Job).delete()
            db.query(TechnicianPasswordResetRequest).delete()
            db.commit()

    def _seed_job(self, *, code: str, status: str = "admin_review") -> Job:
        with SessionLocal() as db:
            row = Job(
                id=uuid4(),
                job_code=code,
                status=status,
                source_system="admin_ui",
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return row

    def test_get_admin_job_detail_includes_timeline_fallback(self):
        job = self._seed_job(code="SM2-DETAIL-001")

        res = self.client.get(f"/admin/jobs/{job.id}", headers=self.auth_header)
        self.assertEqual(res.status_code, 200, res.text)
        payload = res.json()
        self.assertEqual(payload["id"], str(job.id))
        self.assertIsNone(payload["internal_notes"])
        self.assertTrue(any(item["event_type"] == "JOB_CREATED" for item in payload["timeline"]))

    def test_update_internal_notes_persists_and_records_events(self):
        job = self._seed_job(code="SM2-NOTE-001")

        save_res = self.client.patch(
            f"/admin/jobs/{job.id}/internal-notes",
            json={"internal_notes": "Call before arrival"},
            headers=self.auth_header,
        )
        self.assertEqual(save_res.status_code, 200, save_res.text)
        saved_payload = save_res.json()
        self.assertEqual(saved_payload["internal_notes"], "Call before arrival")
        self.assertEqual(saved_payload["timeline"][0]["event_type"], "INTERNAL_NOTE_UPDATED")

        with SessionLocal() as db:
            refreshed = db.query(Job).filter(Job.id == job.id).first()
            self.assertIsNotNone(refreshed)
            self.assertEqual(refreshed.internal_notes, "Call before arrival")

        clear_res = self.client.patch(
            f"/admin/jobs/{job.id}/internal-notes",
            json={"internal_notes": "   "},
            headers=self.auth_header,
        )
        self.assertEqual(clear_res.status_code, 200, clear_res.text)
        cleared_payload = clear_res.json()
        self.assertIsNone(cleared_payload["internal_notes"])
        self.assertEqual(cleared_payload["timeline"][0]["event_type"], "INTERNAL_NOTE_CLEARED")


if __name__ == "__main__":
    unittest.main()
