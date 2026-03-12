"""
Email Tracking Service — สร้าง tracking pixel, link wrapping และ unsubscribe links
ใช้ URL-safe base64 สำหรับ token encoding
"""

import base64
import logging
import re
from urllib.parse import quote, urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)

# 1x1 transparent GIF (binary)
_TRACKING_PIXEL_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00"
    b"!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01"
    b"\x00\x00\x02\x02D\x01\x00;"
)

# Regex หา links ใน HTML (ไม่จับ tracking links และ unsubscribe links)
_LINK_PATTERN = re.compile(
    r'<a\s+([^>]*?)href=["\']([^"\']+)["\']([^>]*)>',
    re.IGNORECASE,
)


class TrackingService:
    """
    Email Tracking Service

    สร้าง tracking URLs สำหรับ open tracking, click tracking
    และ unsubscribe links
    """

    def get_tracking_pixel_bytes(self) -> bytes:
        """Return 1x1 transparent GIF binary data"""
        return _TRACKING_PIXEL_GIF

    def generate_tracking_pixel(self, event_id: str) -> str:
        """
        สร้าง tracking pixel HTML tag

        Args:
            event_id: unique event ID สำหรับ email นี้

        Returns:
            HTML <img> tag ที่ชี้ไปยัง tracking pixel URL
            URL format: {API_URL}/api/v1/track/open/{event_id}
        """
        api_url = settings.api_url.rstrip("/")
        pixel_url = f"{api_url}/api/v1/track/open/{event_id}"

        return (
            f'<img src="{pixel_url}" '
            f'width="1" height="1" '
            f'alt="" style="display:none;width:1px;height:1px;" />'
        )

    def wrap_links(self, html_body: str, event_id: str) -> str:
        """
        แทนที่ links ใน HTML ด้วย tracking redirect URLs

        ข้ามลิงก์ที่เป็น:
        - unsubscribe links (มี /unsubscribe/)
        - tracking links (มี /track/)
        - mailto: links
        - anchor links (#)

        Args:
            html_body: HTML email body
            event_id: unique event ID

        Returns:
            HTML body ที่ links ถูก wrap ด้วย tracking redirect
        """
        api_url = settings.api_url.rstrip("/")

        def replace_link(match: re.Match) -> str:
            before_href = match.group(1)
            original_url = match.group(2)
            after_href = match.group(3)

            # ข้ามลิงก์พิเศษ
            if (
                original_url.startswith("mailto:")
                or original_url.startswith("#")
                or "/unsubscribe/" in original_url
                or "/track/" in original_url
                or original_url == "{{unsubscribe_link}}"
            ):
                return match.group(0)

            # ตรวจว่า URL valid
            try:
                parsed = urlparse(original_url)
                if not parsed.scheme:
                    return match.group(0)
            except Exception:
                return match.group(0)

            encoded_url = quote(original_url, safe="")
            tracking_url = f"{api_url}/api/v1/track/click/{event_id}?url={encoded_url}"

            return f'<a {before_href}href="{tracking_url}"{after_href}>'

        wrapped = _LINK_PATTERN.sub(replace_link, html_body)

        logger.debug("Links wrapped for event_id=%s", event_id)
        return wrapped

    def generate_unsubscribe_link(self, workspace_id: str, email: str) -> str:
        """
        สร้าง unsubscribe link สำหรับ email

        Token = base64url encode ของ "{workspace_id}:{email}"
        URL format: {API_URL}/api/v1/unsubscribe/{token}

        Args:
            workspace_id: workspace ID
            email: email address ของผู้รับ

        Returns:
            Full unsubscribe URL
        """
        raw = f"{workspace_id}:{email}"
        token = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")

        api_url = settings.api_url.rstrip("/")
        return f"{api_url}/api/v1/unsubscribe/{token}"

    def decode_unsubscribe_token(self, token: str) -> tuple[str, str] | None:
        """
        Decode unsubscribe token กลับเป็น workspace_id และ email

        Args:
            token: base64url encoded token

        Returns:
            tuple ของ (workspace_id, email) หรือ None ถ้า invalid
        """
        try:
            # เติม padding กลับ
            padding = 4 - len(token) % 4
            if padding != 4:
                token += "=" * padding

            decoded = base64.urlsafe_b64decode(token.encode()).decode()

            if ":" not in decoded:
                logger.warning("Invalid unsubscribe token format: %s", token[:20])
                return None

            # แยก workspace_id:email (email อาจมี : ได้)
            parts = decoded.split(":", 1)
            if len(parts) != 2:
                return None

            workspace_id, email = parts
            if not workspace_id or not email:
                return None

            return workspace_id, email

        except Exception as e:
            logger.error("Error decoding unsubscribe token: %s", e)
            return None

    def inject_tracking(
        self,
        html_body: str,
        event_id: str,
        workspace_id: str,
        recipient_email: str,
    ) -> str:
        """
        Inject tracking pixel + wrap links + inject unsubscribe link

        Args:
            html_body: HTML email body
            event_id: unique event ID
            workspace_id: workspace ID
            recipient_email: email ของผู้รับ

        Returns:
            HTML body ที่มี tracking ครบทั้งหมด
        """
        # สร้าง unsubscribe link และ replace placeholder
        unsubscribe_link = self.generate_unsubscribe_link(workspace_id, recipient_email)
        html = html_body.replace("{{unsubscribe_link}}", unsubscribe_link)

        # Wrap links
        html = self.wrap_links(html, event_id)

        # Inject tracking pixel ก่อน </body> หรือต่อท้าย
        pixel = self.generate_tracking_pixel(event_id)
        if "</body>" in html.lower():
            html = re.sub(r"</body>", f"{pixel}</body>", html, flags=re.IGNORECASE)
        else:
            html = html + pixel

        return html


# Singleton instance
tracking_service = TrackingService()
