import base64
import hashlib
import io
import os
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from ..core.config import (
    CHAT_MAX_ATTACHMENT_BYTES,
    CHAT_MAX_VOICE_DURATION_SECONDS,
    CHAT_STORAGE_ROOT,
)

try:
    from mutagen import File as MutagenFile
except Exception:  # pragma: no cover - optional dependency in dev/runtime
    MutagenFile = None


DATA_URL_PATTERN = re.compile(r"^data:(?P<mime>[-\w.+/]+);base64,(?P<data>.+)$", re.IGNORECASE | re.DOTALL)
OLE_HEADER = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
EBML_HEADER = b"\x1a\x45\xdf\xa3"


@dataclass(frozen=True)
class StoredChatAttachment:
    attachment_id: UUID
    original_name: str
    mime_type: str
    size_bytes: int
    attachment_type: str
    storage_path: str
    sha256_hash: str
    duration_seconds: Optional[int]


class ChatStorageService:
    @staticmethod
    def parse_and_store(
        *,
        tenant_id: UUID,
        conversation_id: UUID,
        message_id: UUID,
        original_name: str,
        claimed_mime_type: str,
        size_bytes: int,
        data_url: str,
        duration_seconds: Optional[int] = None,
    ) -> StoredChatAttachment:
        normalized_name = (original_name or "attachment").strip()
        if not normalized_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Attachment name is required")

        if size_bytes < 1 or size_bytes > CHAT_MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Attachment exceeds size limit")

        detected = ChatStorageService._decode_and_validate(
            original_name=normalized_name,
            claimed_mime_type=claimed_mime_type,
            data_url=data_url,
            expected_size=size_bytes,
            client_duration_seconds=duration_seconds,
        )

        attachment_id = uuid4()
        extension = ChatStorageService._extension_for_mime(detected["mime_type"], normalized_name)
        directory = CHAT_STORAGE_ROOT / str(tenant_id) / str(conversation_id) / str(message_id)
        directory.mkdir(parents=True, exist_ok=True)
        storage_path = directory / f"{attachment_id}.{extension}"
        storage_path.write_bytes(detected["content"])

        return StoredChatAttachment(
            attachment_id=attachment_id,
            original_name=normalized_name,
            mime_type=detected["mime_type"],
            size_bytes=len(detected["content"]),
            attachment_type=detected["attachment_type"],
            storage_path=str(storage_path),
            sha256_hash=detected["sha256_hash"],
            duration_seconds=detected["duration_seconds"],
        )

    @staticmethod
    def read_content(storage_path: str) -> bytes:
        path = Path(storage_path)
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found")
        return path.read_bytes()

    @staticmethod
    def _decode_and_validate(
        *,
        original_name: str,
        claimed_mime_type: str,
        data_url: str,
        expected_size: int,
        client_duration_seconds: Optional[int],
    ) -> dict:
        match = DATA_URL_PATTERN.match((data_url or "").strip())
        if not match:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Attachment must use a base64 data URL")

        try:
            content = base64.b64decode(match.group("data"), validate=True)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Attachment payload is invalid") from exc

        if not content:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Attachment payload is empty")
        if len(content) != expected_size:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Attachment size mismatch")
        if len(content) > CHAT_MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Attachment exceeds size limit")

        detected = ChatStorageService._detect_attachment_type(
            original_name=original_name,
            claimed_mime_type=(claimed_mime_type or match.group("mime") or "").strip().lower(),
            content=content,
        )
        sha256_hash = hashlib.sha256(content).hexdigest()

        duration_seconds = None
        if detected["attachment_type"] == "voice":
            duration_seconds = ChatStorageService._detect_audio_duration_seconds(
                content=content,
                mime_type=detected["mime_type"],
                fallback_duration_seconds=client_duration_seconds,
            )
            if duration_seconds is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Voice duration could not be determined",
                )
            if duration_seconds < 1 or duration_seconds > CHAT_MAX_VOICE_DURATION_SECONDS:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Voice duration exceeds limit",
                )

        return {
            "content": content,
            "mime_type": detected["mime_type"],
            "attachment_type": detected["attachment_type"],
            "duration_seconds": duration_seconds,
            "sha256_hash": sha256_hash,
        }

    @staticmethod
    def _detect_attachment_type(*, original_name: str, claimed_mime_type: str, content: bytes) -> dict:
        lower_name = original_name.lower()

        if content.startswith(b"%PDF"):
            return {"mime_type": "application/pdf", "attachment_type": "document"}
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            return {"mime_type": "image/png", "attachment_type": "image"}
        if content.startswith(b"\xff\xd8\xff"):
            return {"mime_type": "image/jpeg", "attachment_type": "image"}
        if content.startswith((b"GIF87a", b"GIF89a")):
            return {"mime_type": "image/gif", "attachment_type": "image"}
        if len(content) > 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            return {"mime_type": "image/webp", "attachment_type": "image"}

        if len(content) > 12 and content[:4] == b"RIFF" and content[8:12] == b"WAVE":
            return {"mime_type": "audio/wav", "attachment_type": "voice"}
        if content.startswith(b"OggS"):
            return {"mime_type": "audio/ogg", "attachment_type": "voice"}
        if content.startswith(EBML_HEADER):
            return {"mime_type": "audio/webm", "attachment_type": "voice"}
        if content.startswith(b"ID3") or (len(content) > 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0):
            return {"mime_type": "audio/mpeg", "attachment_type": "voice"}
        if len(content) > 12 and content[4:8] == b"ftyp":
            if any(token in content[8:24] for token in (b"M4A", b"isom", b"mp42", b"mp41", b"qt  ")):
                return {"mime_type": "audio/mp4", "attachment_type": "voice"}

        if content.startswith(OLE_HEADER) and lower_name.endswith(".doc"):
            return {"mime_type": "application/msword", "attachment_type": "document"}
        if lower_name.endswith(".docx") and zipfile.is_zipfile(io.BytesIO(content)):
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
            if "[Content_Types].xml" in names and any(name.startswith("word/") for name in names):
                return {
                    "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "attachment_type": "document",
                }

        if claimed_mime_type == "text/plain":
            try:
                content.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Plain-text attachment must be UTF-8 encoded",
                ) from exc
            return {"mime_type": "text/plain", "attachment_type": "document"}

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Attachment type is not allowed",
        )

    @staticmethod
    def _detect_audio_duration_seconds(
        *,
        content: bytes,
        mime_type: str,
        fallback_duration_seconds: Optional[int],
    ) -> Optional[int]:
        duration_seconds = None
        if MutagenFile is not None:
            try:
                parsed = MutagenFile(io.BytesIO(content))
                raw_length = getattr(getattr(parsed, "info", None), "length", None)
                if raw_length is not None:
                    duration_seconds = max(1, int(round(float(raw_length))))
            except Exception:
                duration_seconds = None

        if duration_seconds is None and fallback_duration_seconds is not None:
            duration_seconds = int(fallback_duration_seconds)

        return duration_seconds

    @staticmethod
    def _extension_for_mime(mime_type: str, original_name: str) -> str:
        mapping = {
            "application/pdf": "pdf",
            "application/msword": "doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/gif": "gif",
            "image/webp": "webp",
            "audio/wav": "wav",
            "audio/ogg": "ogg",
            "audio/webm": "webm",
            "audio/mpeg": "mp3",
            "audio/mp4": "m4a",
            "text/plain": "txt",
        }
        extension = mapping.get(mime_type)
        if extension:
            return extension

        _, dot, suffix = original_name.rpartition(".")
        if dot and suffix:
            return suffix.lower()
        return "bin"
