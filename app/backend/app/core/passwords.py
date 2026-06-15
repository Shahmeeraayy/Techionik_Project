import re
import hashlib
import hmac

import bcrypt

ADMIN_PASSWORD_MIN_LENGTH = 12
COMMON_WEAK_PASSWORDS = {
    "admin",
    "admin123",
    "password",
    "password123",
    "passw0rd",
    "qwerty",
    "qwerty123",
    "root",
    "root123",
    "superadmin",
    "superadmin123",
    "letmein",
    "welcome",
    "changeme",
}


def hash_password(password: str) -> str:
    normalized = password.strip()
    hashed = bcrypt.hashpw(normalized.encode("utf-8"), bcrypt.gensalt())
    return f"bcrypt${hashed.decode('utf-8')}"


def is_password_hash(value: str | None) -> bool:
    normalized = (value or "").strip()
    return normalized.startswith("bcrypt$") or normalized.startswith("pbkdf2_sha256$")


def verify_password(password: str, stored_hash: str, *, allow_plaintext_fallback: bool = False) -> bool:
    normalized_password = password.strip()
    normalized_stored = stored_hash.strip()

    if normalized_stored.startswith("bcrypt$"):
        bcrypt_hash = normalized_stored.split("$", 1)[1]
        try:
            return bcrypt.checkpw(normalized_password.encode("utf-8"), bcrypt_hash.encode("utf-8"))
        except ValueError:
            return False

    try:
        algorithm, raw_iterations, salt, digest = normalized_stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            raise ValueError
        iterations = int(raw_iterations)
    except ValueError:
        if allow_plaintext_fallback:
            return hmac.compare_digest(normalized_password, normalized_stored)
        return False

    computed = hashlib.pbkdf2_hmac(
        "sha256",
        normalized_password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return hmac.compare_digest(computed, digest)


def validate_strong_password(
    password: str,
    *,
    min_length: int = ADMIN_PASSWORD_MIN_LENGTH,
) -> str:
    normalized = password.strip()

    if len(normalized) < min_length:
        raise ValueError(
            f"Password must be at least {min_length} characters and include uppercase, lowercase, number, and symbol characters."
        )
    if not re.search(r"[A-Z]", normalized):
        raise ValueError(
            f"Password must be at least {min_length} characters and include uppercase, lowercase, number, and symbol characters."
        )
    if not re.search(r"[a-z]", normalized):
        raise ValueError(
            f"Password must be at least {min_length} characters and include uppercase, lowercase, number, and symbol characters."
        )
    if not re.search(r"\d", normalized):
        raise ValueError(
            f"Password must be at least {min_length} characters and include uppercase, lowercase, number, and symbol characters."
        )
    if not re.search(r"[^A-Za-z0-9]", normalized):
        raise ValueError(
            f"Password must be at least {min_length} characters and include uppercase, lowercase, number, and symbol characters."
        )
    if normalized.lower() in COMMON_WEAK_PASSWORDS:
        raise ValueError("Password must not be a common password.")

    return normalized
