import hashlib
import hmac

import bcrypt


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
