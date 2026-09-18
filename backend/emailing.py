"""Transactional email via Resend's HTTP API.

Calls Resend directly with `requests` (already a dependency) instead of adding
the `resend` SDK as a new package — one small, auditable HTTP call gets the
same result. Runs on a thread via asyncio.to_thread wherever it's called from
an async route, the same pattern routes_auth.py already uses for Google's
OAuth calls, so a slow email API response never blocks other requests.
"""
import os
import logging

import requests

logger = logging.getLogger("orbit.email")

RESEND_API_URL = "https://api.resend.com/emails"


def send_email(to: str, subject: str, html: str) -> bool:
    """Send one transactional email via Resend. Returns True on success.

    Returns False (and logs a warning) when RESEND_API_KEY isn't configured,
    so local/dev environments without an email provider don't crash — the
    same optional-credential treatment ELEVENLABS_API_KEY etc. get elsewhere.
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not set — email to %s not sent (subject: %s)", to, subject)
        return False

    from_email = os.environ.get("RESEND_FROM_EMAIL", "ORBIT <onboarding@resend.dev>")
    try:
        resp = requests.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": from_email, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.error("Resend send to %s failed (%s): %s", to, resp.status_code, resp.text[:500])
            return False
        return True
    except requests.RequestException as e:
        logger.error("Resend send to %s raised: %s", to, e)
        return False


def reset_password_email_html(reset_url: str) -> str:
    return f"""\
<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #18181B;">
  <h2 style="margin: 0 0 16px; font-size: 20px;">Reset your ORBIT password</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #52525B;">
    We received a request to reset the password for your ORBIT account. Click the button below to
    choose a new one. This link expires in 1 hour.
  </p>
  <p style="margin: 28px 0;">
    <a href="{reset_url}" style="display: inline-block; background: #18181B; color: #ffffff; text-decoration: none;
       padding: 12px 24px; border-radius: 999px; font-size: 14px; font-weight: 600;">
      Reset password
    </a>
  </p>
  <p style="font-size: 13px; line-height: 1.6; color: #71717A;">
    If you didn't request this, you can safely ignore this email — your password will stay the same.
  </p>
  <p style="font-size: 12px; color: #A1A1AA; margin-top: 24px;">
    Or paste this link into your browser:<br>
    <a href="{reset_url}" style="color: #71717A;">{reset_url}</a>
  </p>
</div>
"""
