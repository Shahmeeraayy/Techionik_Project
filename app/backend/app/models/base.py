from uuid import UUID

from sqlalchemy import Column, Uuid
from sqlalchemy.ext.declarative import declarative_base, declared_attr

from ..core.config import DEFAULT_TENANT_ID

Base = declarative_base()


class TenantScopedMixin:
    @declared_attr
    def tenant_id(cls):  # noqa: N805
        return Column(
            Uuid(as_uuid=True),
            nullable=False,
            index=True,
            default=lambda: UUID(DEFAULT_TENANT_ID),
        )
