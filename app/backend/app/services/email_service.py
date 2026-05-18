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


def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)


def smtp_config_summary() -> dict:
    return {
        "configured": is_smtp_configured(),
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
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> MIMEMultipart:
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>" if SMTP_FROM_NAME else SMTP_FROM_EMAIL
    msg["To"] = to

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
        _send(to=to, subject=subject, body=body, html_body=html_body, attachments=attachments)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


def send_email_or_raise(
    *,
    to: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> None:
    """Send email and raise on failure — used by the test endpoint."""
    if not is_smtp_configured():
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD.")
    _send(to=to, subject=subject, body=body, html_body=html_body, attachments=attachments)


def _send(
    *,
    to: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[EmailAttachment] | None = None,
) -> None:
    msg = _build_message(to=to, subject=subject, body=body, html_body=html_body, attachments=attachments)
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to], msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to], msg.as_string())
    logger.info("Email sent to %s — %s", to, subject)
