from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..core.config import (
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
)

logger = logging.getLogger(__name__)


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


def _build_message(*, to: str, subject: str, body: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>" if SMTP_FROM_NAME else SMTP_FROM_EMAIL
    msg["To"] = to
    msg.attach(MIMEText(body, "plain", "utf-8"))
    return msg


def send_email(*, to: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True on success, False if unconfigured or on error."""
    if not is_smtp_configured():
        logger.warning("SMTP not configured — skipping email to %s", to)
        return False
    try:
        _send(to=to, subject=subject, body=body)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


def send_email_or_raise(*, to: str, subject: str, body: str) -> None:
    """Send email and raise on failure — used by the test endpoint."""
    if not is_smtp_configured():
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD.")
    _send(to=to, subject=subject, body=body)


def _send(*, to: str, subject: str, body: str) -> None:
    msg = _build_message(to=to, subject=subject, body=body)
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
