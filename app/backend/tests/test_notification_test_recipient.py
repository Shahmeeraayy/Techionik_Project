import pytest

from app.services.email_service import resolve_notification_recipients


def test_resolve_notification_recipients_adds_test_recipient_only_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NOTIFICATION_TEST_MODE", raising=False)
    monkeypatch.delenv("NOTIFICATION_TEST_RECIPIENT", raising=False)

    assert resolve_notification_recipients("primary@example.com") == ["primary@example.com"]

    monkeypatch.setenv("NOTIFICATION_TEST_MODE", "true")
    monkeypatch.setenv("NOTIFICATION_TEST_RECIPIENT", "muhammad.daniyal@techionik.com")
    assert resolve_notification_recipients("primary@example.com") == [
        "primary@example.com",
        "muhammad.daniyal@techionik.com",
    ]

    monkeypatch.setenv("NOTIFICATION_TEST_MODE", "false")
    assert resolve_notification_recipients("primary@example.com") == ["primary@example.com"]
