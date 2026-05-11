import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.core.enums import UserRole
from app.core.security import create_access_token, decode_access_token


class TenantSecurityTestCase(unittest.TestCase):
    def test_create_and_decode_access_token_with_tenant_claims(self):
        user_id = uuid4()
        tenant_id = uuid4()
        token = create_access_token(
            user_id=user_id,
            role=UserRole.ADMIN,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            tenant_id=tenant_id,
            tenant_role="owner",
        )

        decoded = decode_access_token(token)

        self.assertEqual(decoded.user_id, user_id)
        self.assertEqual(decoded.role, UserRole.ADMIN)
        self.assertEqual(decoded.tenant_id, tenant_id)
        self.assertEqual(decoded.tenant_role, "owner")

    def test_decode_supports_supabase_style_app_metadata_tenant_claims(self):
        user_id = uuid4()
        tenant_id = uuid4()
        token = create_access_token(
            user_id=user_id,
            role=UserRole.TECHNICIAN,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            extra_claims={
                "tenant_id": None,
                "tenant_role": None,
                "app_metadata": {
                    "tenant_id": str(tenant_id),
                    "tenant_role": "technician",
                    "role": UserRole.TECHNICIAN.value,
                },
            },
        )

        decoded = decode_access_token(token)

        self.assertEqual(decoded.user_id, user_id)
        self.assertEqual(decoded.role, UserRole.TECHNICIAN)
        self.assertEqual(decoded.tenant_id, UUID(str(tenant_id)))
        self.assertEqual(decoded.tenant_role, "technician")


if __name__ == "__main__":
    unittest.main()
