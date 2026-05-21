from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Iterable

from ..core.config import (
    EMAIL_API_KEY,
    EMAIL_ENABLED,
    EMAIL_FROM_DOMAIN,
    EMAIL_PROVIDER,
    EMAIL_REPLY_TO,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailAttachment:
    filename: str
    content: bytes
    content_type: str = "application/octet-stream"


@dataclass(frozen=True)
class PlatformEmailResult:
    status: str
    provider: str
    demo_mode: bool
    error_message: str | None = None


def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)


def smtp_config_summary() -> dict:
    return {
        "configured": is_smtp_configured() or bool(EMAIL_PROVIDER and EMAIL_API_KEY),
        "EMAIL_PROVIDER": EMAIL_PROVIDER or "(demo)",
        "EMAIL_FROM_DOMAIN": EMAIL_FROM_DOMAIN,
        "EMAIL_ENABLED": EMAIL_ENABLED,
        "EMAIL_REPLY_TO": EMAIL_REPLY_TO or "(tenant support email)",
        "SMTP_HOST": SMTP_HOST or "(not set)",
        "SMTP_PORT": SMTP_PORT,
        "SMTP_USERNAME": SMTP_USERNAME or "(not set)",
        "SMTP_PASSWORD": "***" if SMTP_PASSWORD else "(not set)",
        "SMTP_FROM_EMAIL": SMTP_FROM_EMAIL or "(not set)",
        "SMTP_FROM_NAME": SMTP_FROM_NAME or "(not set)",
    }


def _build_message(
    *,
    to: str,
    from_email: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> MIMEMultipart:
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    resolved_from_email = from_email or SMTP_FROM_EMAIL
    resolved_from_name = from_name if from_name is not None else SMTP_FROM_NAME
    msg["From"] = f"{resolved_from_name} <{resolved_from_email}>" if resolved_from_name else resolved_from_email
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to

    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(body, "plain", "utf-8"))
    if html_body:
        body_part.attach(MIMEText(html_body, "html", "utf-8"))
    msg.attach(body_part)

    for attachment in attachments or []:
        maintype, _, subtype = attachment.content_type.partition("/")
        part = MIMEBase(maintype or "application", subtype or "octet-stream")
        part.set_payload(attachment.content)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=attachment.filename)
        msg.attach(part)

    return msg


def send_email(
    *,
    to: str,
    from_email: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> bool:
    """Send a plain-text email. Returns True on success, False if unconfigured or on error."""
    if not is_smtp_configured():
        logger.warning("SMTP not configured — skipping email to %s", to)
        return False
    try:
        _send(to=to, from_email=from_email, from_name=from_name, reply_to=reply_to, subject=subject, body=body, html_body=html_body, attachments=attachments)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


def send_email_or_raise(
    *,
    to: str,
    from_email: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> None:
    """Send email and raise on failure — used by the test endpoint."""
    if not is_smtp_configured():
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD.")
    _send(to=to, from_email=from_email, from_name=from_name, reply_to=reply_to, subject=subject, body=body, html_body=html_body, attachments=attachments)


def send_platform_email(
    *,
    to: str,
    from_email: str,
    from_name: str,
    reply_to: str | None,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> PlatformEmailResult:
    """Send from a tenant-owned NexusOps identity, with safe demo fallback."""
    if not EMAIL_ENABLED:
        logger.info("Platform email disabled; queued demo email to %s from %s", to, from_email)
        return PlatformEmailResult(status="queued_demo", provider="demo", demo_mode=True)

    provider = (EMAIL_PROVIDER or "").strip().lower()
    if provider and provider not in {"smtp", "demo"} and not EMAIL_API_KEY:
        logger.info("Email provider %s lacks EMAIL_API_KEY; queued demo email to %s", provider, to)
        return PlatformEmailResult(status="queued_demo", provider=provider, demo_mode=True)

    if provider in {"", "smtp"}:
        if not is_smtp_configured():
            logger.info("SMTP not configured; queued demo email to %s from %s", to, from_email)
            return PlatformEmailResult(status="queued_demo", provider="demo", demo_mode=True)
        try:
            _send(
                to=to,
                from_email=from_email,
                from_name=from_name,
                reply_to=reply_to or EMAIL_REPLY_TO or None,
                subject=subject,
                body=body,
                html_body=html_body,
                attachments=attachments,
            )
            return PlatformEmailResult(status="sent", provider="smtp", demo_mode=False)
        except Exception as exc:
            logger.exception("Failed to send platform email to %s", to)
            return PlatformEmailResult(status="failed", provider="smtp", demo_mode=False, error_message=str(exc))

    # Transactional providers are environment-configured here. Until a provider
    # client is selected, keep behavior safe and observable instead of failing.
    logger.info("Provider %s configured for future delivery; queued demo email to %s", provider, to)
    return PlatformEmailResult(status="queued_demo", provider=provider or "demo", demo_mode=True)


def _send(
    *,
    to: str,
    from_email: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> None:
    msg = _build_message(to=to, from_email=from_email, from_name=from_name, reply_to=reply_to, subject=subject, body=body, html_body=html_body, attachments=attachments)
    envelope_from = from_email or SMTP_FROM_EMAIL
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(envelope_from, [to], msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(envelope_from, [to], msg.as_string())
    logger.info("Email sent to %s — %s", to, subject)
