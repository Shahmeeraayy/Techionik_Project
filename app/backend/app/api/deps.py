from typing import Generator
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import event, text
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker, with_loader_criteria

from ..core.config import DATABASE_URL, DEFAULT_TENANT_ID
from ..core.enums import UserRole
from ..core.security import AuthenticatedUser, decode_access_token
from ..core.tenant import TenantContext
from ..models.base import TenantScopedMixin
from ..models import *  # noqa: F401,F403
from ..services.access_policy_service import AccessPolicyService

IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    pool_pre_ping=not IS_SQLITE,
)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@event.listens_for(SessionLocal, "do_orm_execute")
def _apply_tenant_scope(execute_state) -> None:
    if not execute_state.is_select or execute_state.execution_options.get("skip_tenant_scope"):
        return

    tenant_id = execute_state.session.info.get("tenant_id")
    if tenant_id is None:
        return

    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(
            TenantScopedMixin,
            lambda cls: cls.tenant_id == tenant_id,
            include_aliases=True,
        )
    )


@event.listens_for(SessionLocal, "before_flush")
def _populate_tenant_id(session: Session, flush_context, instances) -> None:
    tenant_id = session.info.get("tenant_id")
    if tenant_id is None:
        return

    for obj in session.new:
        if isinstance(obj, TenantScopedMixin):
            current = getattr(obj, "tenant_id", None)
            if current is None:
                obj.tenant_id = tenant_id
            elif current != tenant_id:
                raise ValueError("Cross-tenant writes are not allowed")


def _resolve_tenant_id_from_request(request: Request | None) -> UUID:
    request_context = getattr(getattr(request, "state", None), "tenant_context", None)
    if isinstance(request_context, TenantContext) and request_context.tenant_id:
        return request_context.tenant_id
    return UUID(DEFAULT_TENANT_ID)


def get_db(request: Request) -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        tenant_id = _resolve_tenant_id_from_request(request)
        db.info["tenant_id"] = tenant_id

        if not DATABASE_URL.startswith("sqlite"):
            db.execute(text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"), {"tenant_id": str(tenant_id)})

        yield db
    finally:
        db.close()


def get_platform_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        db.info["tenant_id"] = None
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme)) -> AuthenticatedUser:
    return decode_access_token(token)


def require_roles(*allowed_roles: UserRole):
    def dependency(
        current_user: AuthenticatedUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> AuthenticatedUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this resource",
            )
        if current_user.role in {UserRole.ADMIN, UserRole.TECHNICIAN} and current_user.tenant_id is not None:
            tenant = (
                db.query(Tenant)
                .execution_options(skip_tenant_scope=True)
                .filter(Tenant.id == current_user.tenant_id)
                .first()
            )
            if tenant is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tenant not found",
                )
            tenant_status = getattr(tenant, "platform_status", None) or getattr(tenant, "status", None)
            if not AccessPolicyService.is_tenant_accessible(tenant_status):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Tenant access is currently restricted",
                )
        return current_user

    return dependency


def require_super_admin(*allowed_platform_roles: str):
    normalized_roles = {item.strip().lower() for item in allowed_platform_roles if item.strip()}

    def dependency(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if current_user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super Admin access is required",
            )
        if normalized_roles and (current_user.platform_role or "").strip().lower() not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient platform permissions for this resource",
            )
        return current_user

    return dependency


def require_tenant_feature(*feature_keys: str):
    normalized_feature_keys = [item.strip().lower() for item in feature_keys if item.strip()]

    def dependency(
        current_user: AuthenticatedUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> AuthenticatedUser:
        if not normalized_feature_keys or current_user.role not in {UserRole.ADMIN, UserRole.TECHNICIAN}:
            return current_user

        tenant_id = current_user.tenant_id
        if tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant context is required for feature validation",
            )

        tenant = (
            db.query(Tenant)
            .execution_options(skip_tenant_scope=True)
            .filter(Tenant.id == tenant_id)
            .first()
        )
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found",
            )

        overrides = (
            db.query(TenantFeatureOverride)
            .execution_options(skip_tenant_scope=True)
            .filter(TenantFeatureOverride.tenant_id == tenant_id)
            .all()
        )
        disabled_features = [
            feature_key
            for feature_key in normalized_feature_keys
            if not AccessPolicyService.feature_is_enabled(
                tenant=tenant,
                feature_key=feature_key,
                overrides=overrides,
            )
        ]
        if disabled_features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature access disabled for this tenant: {', '.join(disabled_features)}",
            )

        return current_user

    return dependency
