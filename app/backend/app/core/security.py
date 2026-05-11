from dataclasses import dataclass
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status

from .config import JWT_ALGORITHM, JWT_SECRET_KEY, SUPABASE_JWT_SECRET
from .enums import UserRole


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: UUID
    role: UserRole
    tenant_id: UUID | None = None
    tenant_role: str | None = None
    claims: dict | None = None

def _encode_segment(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _decode_segment(segment: str) -> dict:
    padding = "=" * ((4 - len(segment) % 4) % 4)
    try:
        decoded = base64.urlsafe_b64decode((segment + padding).encode("utf-8"))
        return json.loads(decoded.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token encoding",
        ) from exc


def _decode_signature(segment: str) -> bytes:
    padding = "=" * ((4 - len(segment) % 4) % 4)
    try:
        return base64.urlsafe_b64decode((segment + padding).encode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature encoding",
        ) from exc


def create_access_token(
    *,
    user_id: UUID,
    role: UserRole,
    expires_at: datetime,
    tenant_id: UUID | None = None,
    tenant_role: str | None = None,
    extra_claims: dict | None = None,
) -> str:
    if JWT_ALGORITHM.upper() != "HS256":
        raise RuntimeError("Only HS256 JWT signing is supported")

    expiry = expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    else:
        expiry = expiry.astimezone(timezone.utc)

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "exp": int(expiry.timestamp()),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "tenant_role": tenant_role or role.value,
        "app_metadata": {
            "tenant_id": str(tenant_id) if tenant_id else None,
            "tenant_role": tenant_role or role.value,
            "role": role.value,
        },
    }
    if extra_claims:
        payload.update(extra_claims)

    header_segment = _encode_segment(header)
    payload_segment = _encode_segment(payload)
    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    signature = hmac.new(
        JWT_SECRET_KEY.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    signature_segment = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")
    return f"{header_segment}.{payload_segment}.{signature_segment}"


def decode_access_token(token: str) -> AuthenticatedUser:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format",
        )

    header_segment, payload_segment, signature_segment = parts
    header = _decode_segment(header_segment)
    payload = _decode_segment(payload_segment)

    token_algorithm = str(header.get("alg", "")).upper()
    configured_algorithm = JWT_ALGORITHM.upper()
    if token_algorithm != configured_algorithm:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token algorithm does not match server configuration",
        )

    if configured_algorithm != "HS256":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Only HS256 JWT verification is supported by this server",
        )

    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    provided_signature = _decode_signature(signature_segment)
    candidate_secrets = [JWT_SECRET_KEY]
    if SUPABASE_JWT_SECRET and SUPABASE_JWT_SECRET not in candidate_secrets:
        candidate_secrets.append(SUPABASE_JWT_SECRET)

    signature_matches = False
    for secret in candidate_secrets:
        expected_signature = hmac.new(
            secret.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        if hmac.compare_digest(expected_signature, provided_signature):
            signature_matches = True
            break

    if not signature_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    exp = payload.get("exp")
    if exp is not None:
        try:
            expiry = datetime.fromtimestamp(int(exp), tz=timezone.utc)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token expiry claim",
            ) from exc
        if datetime.now(timezone.utc) >= expiry:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired",
            )

    try:
        raw_sub = payload.get("sub")
        raw_role = payload.get("role")
        app_metadata = payload.get("app_metadata") or {}
        raw_tenant_id = (
            payload.get("tenant_id")
            or app_metadata.get("tenant_id")
            or (payload.get("user_metadata") or {}).get("tenant_id")
        )
        raw_tenant_role = payload.get("tenant_role") or app_metadata.get("tenant_role")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload",
        ) from exc

    if not raw_sub or not raw_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims",
        )

    try:
        user_id = UUID(str(raw_sub))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject must be a UUID",
        ) from exc

    try:
        role = UserRole(str(raw_role).lower())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unsupported user role",
        ) from exc

    tenant_id = None
    if raw_tenant_id:
        try:
            tenant_id = UUID(str(raw_tenant_id))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token tenant_id must be a UUID",
            ) from exc

    return AuthenticatedUser(
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
        tenant_role=str(raw_tenant_role).lower() if raw_tenant_role else role.value,
        claims=payload,
    )
