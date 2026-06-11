import base64
import io
import os
import unittest
import wave
from uuid import UUID

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "chat_api_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["ALLOW_SQLITE_FOR_TESTS"] = "1"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import SessionLocal, engine
from app.main import app
from app.models.admin_user import AdminUser
from app.models.base import Base
from app.models.job import Job
from app.models.technician import Technician


def _data_url(mime_type: str, payload: bytes) -> str:
    encoded = base64.b64encode(payload).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _tiny_wav_bytes() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(8000)
        handle.writeframes(b"\x00\x00" * 8000)
    return buffer.getvalue()


def _tiny_mp4_bytes() -> bytes:
    return b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 32)


class ChatApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

        tenant_one_signup = cls.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Tenant One",
                "workspace_slug": "tenant-one",
                "full_name": "Owner One",
                "email": "owner1@nexusops.local",
                "password": "owner12345",
            },
        )
        assert tenant_one_signup.status_code == 201, tenant_one_signup.text
        tenant_one_payload = tenant_one_signup.json()
        cls.admin_one_token = tenant_one_payload["access_token"]
        cls.tenant_one_id = tenant_one_payload["tenant_id"]

        tenant_two_signup = cls.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Tenant Two",
                "workspace_slug": "tenant-two",
                "full_name": "Owner Two",
                "email": "owner2@nexusops.local",
                "password": "owner12345",
            },
        )
        assert tenant_two_signup.status_code == 201, tenant_two_signup.text
        tenant_two_payload = tenant_two_signup.json()
        cls.admin_two_token = tenant_two_payload["access_token"]
        cls.tenant_two_id = tenant_two_payload["tenant_id"]

        with SessionLocal() as db:
            tenant_one_uuid = UUID(cls.tenant_one_id)
            tenant_two_uuid = UUID(cls.tenant_two_id)

            db.info["tenant_id"] = tenant_one_uuid
            tech_one = Technician(
                name="Alex One",
                full_name="Alex One",
                email="alex.one@nexusops.local",
                password="tech123",
                status="active",
                manual_availability=True,
            )
            tech_two = Technician(
                name="Blake Two",
                full_name="Blake Two",
                email="blake.two@nexusops.local",
                password="tech123",
                status="active",
                manual_availability=True,
            )
            tech_three = Technician(
                name="Dana Three",
                full_name="Dana Three",
                email="dana.three@nexusops.local",
                password="tech123",
                status="active",
                manual_availability=True,
            )
            db.add_all([tech_one, tech_two, tech_three])
            db.flush()

            job_one = Job(
                job_code="JOB-CHAT-001",
                status="scheduled",
                assigned_tech_id=tech_one.id,
                service_type="Inspection",
            )
            db.add(job_one)
            db.flush()

            db.info["tenant_id"] = tenant_two_uuid
            tech_other = Technician(
                name="Casey Other",
                full_name="Casey Other",
                email="casey.other@nexusops.local",
                password="tech123",
                status="active",
                manual_availability=True,
            )
            db.add(tech_other)
            db.flush()

            job_other = Job(
                job_code="JOB-CHAT-002",
                status="scheduled",
                assigned_tech_id=tech_other.id,
                service_type="Calibration",
            )
            db.add(job_other)
            db.commit()

            cls.tech_one_id = str(tech_one.id)
            cls.tech_two_id = str(tech_two.id)
            cls.tech_three_id = str(tech_three.id)
            cls.tech_other_id = str(tech_other.id)
            cls.job_one_id = str(job_one.id)
            cls.job_other_id = str(job_other.id)

        cls.tech_one_headers = {"Authorization": f"Bearer {cls._technician_token('alex.one@nexusops.local')}"}
        cls.tech_two_headers = {"Authorization": f"Bearer {cls._technician_token('blake.two@nexusops.local')}"}
        cls.tech_three_headers = {"Authorization": f"Bearer {cls._technician_token('dana.three@nexusops.local')}"}
        cls.tech_other_headers = {"Authorization": f"Bearer {cls._technician_token('casey.other@nexusops.local')}"}
        cls.admin_one_headers = {"Authorization": f"Bearer {cls.admin_one_token}"}
        cls.admin_two_headers = {"Authorization": f"Bearer {cls.admin_two_token}"}

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    @classmethod
    def _technician_token(cls, email: str) -> str:
        response = cls.client.post(
            "/auth/dev/technician-token",
            json={"email": email, "password": "tech123"},
        )
        assert response.status_code == 200, response.text
        return response.json()["access_token"]

    def test_z_admin_list_includes_direct_threads_and_broadcast_sends_to_active_technicians(self):
        response = self.client.get("/admin/chat/conversations", headers=self.admin_one_headers)
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        technician_ids = {row["technician_id"] for row in payload}
        self.assertIn(self.tech_one_id, technician_ids)
        self.assertIn(self.tech_two_id, technician_ids)

        broadcast = self.client.post(
            "/admin/chat/broadcast",
            headers=self.admin_one_headers,
            json={"text": "This should not send."},
        )
        self.assertEqual(broadcast.status_code, 201, broadcast.text)
        broadcast_payload = broadcast.json()
        self.assertEqual(len(broadcast_payload), 3)
        self.assertEqual(
            {row["technician_id"] for row in broadcast_payload},
            {self.tech_one_id, self.tech_two_id, self.tech_three_id},
        )
        self.assertTrue(all(row["is_broadcast"] for row in broadcast_payload))

    def test_job_chat_enforces_assignment_and_read_receipts(self):
        resolved = self.client.get(
            f"/admin/chat/jobs/{self.job_one_id}/conversation",
            headers=self.admin_one_headers,
        )
        self.assertEqual(resolved.status_code, 200, resolved.text)
        conversation_id = resolved.json()["conversation"]["id"]
        self.assertEqual(resolved.json()["conversation"]["conversation_type"], "job")

        message = self.client.post(
            f"/admin/chat/threads/{conversation_id}/messages",
            headers=self.admin_one_headers,
            json={"text": "Please confirm arrival window for this assigned job."},
        )
        self.assertEqual(message.status_code, 201, message.text)
        message_id = message.json()["id"]

        tech_access = self.client.get(
            f"/technicians/me/chat/jobs/{self.job_one_id}/conversation",
            headers=self.tech_one_headers,
        )
        self.assertEqual(tech_access.status_code, 200, tech_access.text)
        self.assertEqual(tech_access.json()["conversation"]["id"], conversation_id)

        forbidden = self.client.get(
            f"/technicians/me/chat/jobs/{self.job_one_id}/conversation",
            headers=self.tech_two_headers,
        )
        self.assertEqual(forbidden.status_code, 403, forbidden.text)

        thread = self.client.get(
            f"/technicians/me/chat/threads/{conversation_id}/messages",
            headers=self.tech_one_headers,
        )
        self.assertEqual(thread.status_code, 200, thread.text)
        self.assertTrue(any(row["id"] == message_id for row in thread.json()))

        read = self.client.post(
            f"/technicians/me/chat/threads/{conversation_id}/read",
            headers=self.tech_one_headers,
        )
        self.assertEqual(read.status_code, 200, read.text)

        admin_thread = self.client.get(
            f"/admin/chat/threads/{conversation_id}/messages",
            headers=self.admin_one_headers,
        )
        self.assertEqual(admin_thread.status_code, 200, admin_thread.text)
        latest = admin_thread.json()[-1]
        self.assertIsNotNone(latest["delivered_at"])
        self.assertIsNotNone(latest["read_at"])

    def test_chat_message_metadata_roundtrip_search_and_role_guards(self):
        resolved = self.client.get(
            f"/admin/chat/jobs/{self.job_one_id}/conversation",
            headers=self.admin_one_headers,
        )
        self.assertEqual(resolved.status_code, 200, resolved.text)
        conversation = resolved.json()["conversation"]
        conversation_id = conversation["id"]

        shared = self.client.post(
            f"/admin/chat/threads/{conversation_id}/messages",
            headers=self.admin_one_headers,
            json={
                "text": "Sharing the job summary.",
                "metadata": {"kind": "job_details"},
            },
        )
        self.assertEqual(shared.status_code, 201, shared.text)
        payload = shared.json()
        self.assertEqual(payload["metadata"]["kind"], "job_details")
        self.assertEqual(payload["metadata"]["job_id"], self.job_one_id)
        self.assertEqual(payload["metadata"]["job_code"], "JOB-CHAT-001")
        self.assertEqual(payload["metadata"]["job_status"], "scheduled")

        search = self.client.get(
            f"/admin/chat/threads/{conversation_id}/messages?search=job_details",
            headers=self.admin_one_headers,
        )
        self.assertEqual(search.status_code, 200, search.text)
        self.assertTrue(any(row["id"] == payload["id"] for row in search.json()))

        forbidden_location = self.client.post(
            "/technicians/me/chat/messages",
            headers=self.tech_one_headers,
            json={
                "text": "Requesting a location update.",
                "metadata": {"kind": "location_request"},
            },
        )
        self.assertEqual(forbidden_location.status_code, 403, forbidden_location.text)

        forbidden_status = self.client.post(
            "/technicians/me/chat/messages",
            headers=self.tech_one_headers,
            json={
                "text": "Requesting a status update.",
                "metadata": {"kind": "status_request"},
            },
        )
        self.assertEqual(forbidden_status.status_code, 403, forbidden_status.text)

    def test_admin_broadcast_reaches_selected_technicians_only(self):
        sent = self.client.post(
            "/admin/chat/broadcast",
            headers=self.admin_one_headers,
            json={
                "text": "Weather delay: check the updated dispatch board.",
                "technician_ids": [self.tech_one_id, self.tech_two_id],
            },
        )
        self.assertEqual(sent.status_code, 201, sent.text)
        payload = sent.json()
        self.assertEqual(len(payload), 2)
        self.assertTrue(all(row["is_broadcast"] for row in payload))
        self.assertTrue(all(row["metadata"]["broadcast"] is True for row in payload))

        tech_one_messages = self.client.get("/technicians/me/chat/messages", headers=self.tech_one_headers)
        self.assertEqual(tech_one_messages.status_code, 200, tech_one_messages.text)
        self.assertTrue(any(row["text"] == "Weather delay: check the updated dispatch board." for row in tech_one_messages.json()))

        tech_three_messages = self.client.get("/technicians/me/chat/messages", headers=self.tech_three_headers)
        self.assertEqual(tech_three_messages.status_code, 200, tech_three_messages.text)
        self.assertFalse(any(row["text"] == "Weather delay: check the updated dispatch board." for row in tech_three_messages.json()))

        forbidden = self.client.post(
            "/admin/chat/broadcast",
            headers=self.tech_one_headers,
            json={"text": "Technicians cannot broadcast."},
        )
        self.assertEqual(forbidden.status_code, 403, forbidden.text)

    def test_typing_status_is_member_scoped(self):
        resolved = self.client.get(
            f"/admin/chat/jobs/{self.job_one_id}/conversation",
            headers=self.admin_one_headers,
        )
        self.assertEqual(resolved.status_code, 200, resolved.text)
        conversation_id = resolved.json()["conversation"]["id"]

        started = self.client.post(
            f"/admin/chat/threads/{conversation_id}/typing",
            headers=self.admin_one_headers,
            json={"is_typing": True},
        )
        self.assertEqual(started.status_code, 200, started.text)

        visible_to_assigned_tech = self.client.get(
            f"/technicians/me/chat/threads/{conversation_id}/typing",
            headers=self.tech_one_headers,
        )
        self.assertEqual(visible_to_assigned_tech.status_code, 200, visible_to_assigned_tech.text)
        self.assertEqual(len(visible_to_assigned_tech.json()["participants"]), 1)
        self.assertEqual(visible_to_assigned_tech.json()["participants"][0]["role"], "admin")

        hidden_from_unassigned_tech = self.client.get(
            f"/technicians/me/chat/threads/{conversation_id}/typing",
            headers=self.tech_two_headers,
        )
        self.assertEqual(hidden_from_unassigned_tech.status_code, 403, hidden_from_unassigned_tech.text)

        stopped = self.client.post(
            f"/admin/chat/threads/{conversation_id}/typing",
            headers=self.admin_one_headers,
            json={"is_typing": False},
        )
        self.assertEqual(stopped.status_code, 200, stopped.text)

    def test_secure_attachment_voice_and_audit_access_are_scoped(self):
        resolved = self.client.get(
            f"/admin/chat/jobs/{self.job_one_id}/conversation",
            headers=self.admin_one_headers,
        )
        self.assertEqual(resolved.status_code, 200, resolved.text)
        conversation_id = resolved.json()["conversation"]["id"]

        pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        wav_bytes = _tiny_wav_bytes()
        video_bytes = _tiny_mp4_bytes()
        send = self.client.post(
            f"/admin/chat/threads/{conversation_id}/messages",
            headers=self.admin_one_headers,
            json={
                "text": "Attaching the work order and voice note.",
                "attachments": [
                    {
                        "name": "work-order.pdf",
                        "mime_type": "application/pdf",
                        "size_bytes": len(pdf_bytes),
                        "data_url": _data_url("application/pdf", pdf_bytes),
                    },
                    {
                        "name": "voice-note.wav",
                        "mime_type": "audio/wav",
                        "size_bytes": len(wav_bytes),
                        "duration_seconds": 1,
                        "data_url": _data_url("audio/wav", wav_bytes),
                    },
                    {
                        "name": "walkaround.mp4",
                        "mime_type": "video/mp4",
                        "size_bytes": len(video_bytes),
                        "data_url": _data_url("video/mp4", video_bytes),
                    },
                ],
            },
        )
        self.assertEqual(send.status_code, 201, send.text)
        payload = send.json()
        self.assertEqual(payload["message_type"], "mixed")
        self.assertEqual(len(payload["attachments"]), 3)
        self.assertTrue(all(item["preview_url"] for item in payload["attachments"]))
        self.assertTrue(all(item["download_url"] for item in payload["attachments"]))
        self.assertTrue(all(item.get("data_url") in (None, "") for item in payload["attachments"]))

        voice_attachment = next(item for item in payload["attachments"] if item["attachment_type"] == "voice")
        video_attachment = next(item for item in payload["attachments"] if item["attachment_type"] == "video")
        self.assertEqual(video_attachment["mime_type"], "video/mp4")
        attachment_id = voice_attachment["id"]
        download = self.client.get(
            f"/chat/attachments/{attachment_id}/content",
            headers=self.tech_one_headers,
        )
        self.assertEqual(download.status_code, 200, download.text)
        self.assertEqual(download.headers["content-type"], "audio/wav")

        video_download = self.client.get(
            f"/chat/attachments/{video_attachment['id']}/content",
            headers=self.tech_one_headers,
        )
        self.assertEqual(video_download.status_code, 200, video_download.text)
        self.assertEqual(video_download.headers["content-type"], "video/mp4")

        forbidden = self.client.get(
            f"/chat/attachments/{attachment_id}/content",
            headers=self.tech_other_headers,
        )
        self.assertEqual(forbidden.status_code, 404, forbidden.text)

        message_id = payload["id"]
        pinned = self.client.post(
            f"/admin/chat/messages/{message_id}/pin",
            headers=self.admin_one_headers,
        )
        self.assertEqual(pinned.status_code, 200, pinned.text)
        self.assertTrue(pinned.json()["is_pinned"])

        audit = self.client.get(
            f"/admin/chat/threads/{conversation_id}/audit-logs",
            headers=self.admin_one_headers,
        )
        self.assertEqual(audit.status_code, 200, audit.text)
        actions = {row["action"] for row in audit.json()}
        self.assertIn("chat.message.sent", actions)
        self.assertIn("chat.voice_uploaded", actions)
        self.assertIn("chat.attachment.downloaded", actions)
        self.assertIn("chat.message.pinned", actions)

    def test_admin_group_chat_is_member_scoped(self):
        created = self.client.post(
            "/admin/chat/groups",
            headers=self.admin_one_headers,
            json={
                "title": "Emergency Team",
                "technician_ids": [self.tech_one_id, self.tech_two_id],
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        conversation = created.json()["conversation"]
        self.assertEqual(conversation["channel_kind"], "group")
        self.assertEqual(conversation["member_count"], 2)
        self.assertEqual(set(conversation["member_ids"]), {self.tech_one_id, self.tech_two_id})

        admin_list = self.client.get("/admin/chat/conversations?search=Emergency", headers=self.admin_one_headers)
        self.assertEqual(admin_list.status_code, 200, admin_list.text)
        self.assertTrue(any(row["title"] == "Emergency Team" and row["channel_kind"] == "group" for row in admin_list.json()))

        tech_one_list = self.client.get("/technicians/me/chat/conversations", headers=self.tech_one_headers)
        self.assertEqual(tech_one_list.status_code, 200, tech_one_list.text)
        self.assertTrue(any(row["title"] == "Emergency Team" and row["channel_kind"] == "group" for row in tech_one_list.json()))

        tech_three_list = self.client.get("/technicians/me/chat/conversations", headers=self.tech_three_headers)
        self.assertEqual(tech_three_list.status_code, 200, tech_three_list.text)
        self.assertFalse(any(row["title"] == "Emergency Team" for row in tech_three_list.json()))

        sent = self.client.post(
            f"/admin/chat/threads/{conversation['id']}/messages",
            headers=self.admin_one_headers,
            json={"text": "Bring the emergency kit to every urgent dispatch."},
        )
        self.assertEqual(sent.status_code, 201, sent.text)

        tech_one_thread = self.client.get(
            f"/technicians/me/chat/threads/{conversation['id']}/messages",
            headers=self.tech_one_headers,
        )
        self.assertEqual(tech_one_thread.status_code, 200, tech_one_thread.text)
        self.assertEqual(tech_one_thread.json()[-1]["text"], "Bring the emergency kit to every urgent dispatch.")

        forbidden = self.client.get(
            f"/technicians/me/chat/threads/{conversation['id']}/messages",
            headers=self.tech_three_headers,
        )
        self.assertEqual(forbidden.status_code, 403, forbidden.text)


if __name__ == "__main__":
    unittest.main()
