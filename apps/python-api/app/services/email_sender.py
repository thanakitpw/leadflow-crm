"""
Email Sender Service — ส่ง email ผ่าน Resend API
รองรับ single send, batch send (max 100/batch) และ domain status check
ใช้ asyncio.Semaphore(10) จำกัด concurrent requests
"""

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.schemas.email import SendResult, DomainStatus

logger = logging.getLogger(__name__)

# Resend API endpoints
_RESEND_SEND_URL = "https://api.resend.com/emails"
_RESEND_DOMAINS_URL = "https://api.resend.com/domains"
_RESEND_BATCH_URL = "https://api.resend.com/emails/batch"

# Semaphore สำหรับ concurrent requests
_send_semaphore = asyncio.Semaphore(10)

# Timeout (วินาที)
_REQUEST_TIMEOUT = 30.0

# Resend batch limit
_MAX_BATCH_SIZE = 100


def _build_resend_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }


def _build_email_payload(
    from_email: str,
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
    reply_to: str | None = None,
    tags: dict[str, str] | None = None,
) -> dict[str, Any]:
    """สร้าง payload สำหรับ Resend API"""
    payload: dict[str, Any] = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }

    if text_body:
        payload["text"] = text_body

    if reply_to:
        payload["reply_to"] = reply_to

    if tags:
        payload["tags"] = [{"name": k, "value": v} for k, v in tags.items()]

    return payload


class EmailSender:
    """
    Resend API wrapper สำหรับส่ง email

    ทุก method return SendResult แทนการ raise exception
    เพื่อให้ batch operations ทำงาน partial success ได้
    """

    async def send_email(
        self,
        from_email: str,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str | None = None,
        reply_to: str | None = None,
        tags: dict[str, str] | None = None,
    ) -> SendResult:
        """
        ส่ง email เดียวผ่าน Resend API

        Args:
            from_email: อีเมลผู้ส่ง เช่น "LeadFlow <hello@yourdomain.com>"
            to_email: อีเมลผู้รับ
            subject: หัวข้ออีเมล
            html_body: HTML body
            text_body: Plain text body (optional)
            reply_to: Reply-to address (optional)
            tags: metadata tags (optional)

        Returns:
            SendResult ที่มี message_id และ status
        """
        if not settings.resend_api_key:
            logger.warning("Resend API key ไม่ถูกตั้งค่า — simulate send")
            return SendResult(
                message_id=f"sim_{to_email}_{subject[:20]}".replace(" ", "_"),
                status="sent",
                error=None,
            )

        payload = _build_email_payload(
            from_email, to_email, subject, html_body, text_body, reply_to, tags
        )

        async with _send_semaphore:
            try:
                async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
                    response = await client.post(
                        _RESEND_SEND_URL,
                        headers=_build_resend_headers(),
                        json=payload,
                    )
                    response.raise_for_status()

                data = response.json()
                message_id = data.get("id")
                logger.info("Email sent | to=%s | id=%s", to_email, message_id)

                return SendResult(
                    message_id=message_id,
                    status="sent",
                    error=None,
                )

            except httpx.HTTPStatusError as e:
                error_text = e.response.text[:500]
                logger.error(
                    "Resend API error | to=%s | status=%d | body=%s",
                    to_email,
                    e.response.status_code,
                    error_text,
                )
                return SendResult(
                    message_id=None,
                    status="failed",
                    error=f"HTTP {e.response.status_code}: {error_text}",
                )

            except httpx.TimeoutException:
                logger.error("Resend API timeout | to=%s", to_email)
                return SendResult(
                    message_id=None,
                    status="failed",
                    error="Request timeout",
                )

            except Exception as e:
                logger.error("Unexpected error sending email | to=%s | error=%s", to_email, e)
                return SendResult(
                    message_id=None,
                    status="failed",
                    error=str(e),
                )

    async def send_batch(
        self,
        emails: list[dict[str, Any]],
    ) -> list[SendResult]:
        """
        ส่ง email หลายรายการพร้อมกัน (max 100 per batch)

        Args:
            emails: list ของ dict ที่มี keys:
                    from_email, to_email, subject, html_body,
                    text_body (opt), reply_to (opt), tags (opt)

        Returns:
            list[SendResult] เรียงตามลำดับ input
        """
        if not emails:
            return []

        if len(emails) > _MAX_BATCH_SIZE:
            logger.warning(
                "Batch size %d เกิน limit %d — จะส่งแค่ %d รายการแรก",
                len(emails),
                _MAX_BATCH_SIZE,
                _MAX_BATCH_SIZE,
            )
            emails = emails[:_MAX_BATCH_SIZE]

        # ถ้าไม่มี API key — simulate ทั้ง batch
        if not settings.resend_api_key:
            logger.warning("Resend API key ไม่ถูกตั้งค่า — simulate batch send")
            return [
                SendResult(
                    message_id=f"sim_{e.get('to_email', i)}_{i}".replace(" ", "_"),
                    status="sent",
                )
                for i, e in enumerate(emails)
            ]

        # ใช้ Resend batch endpoint ถ้ามี หรือ concurrent individual sends
        try:
            return await self._send_batch_concurrent(emails)
        except Exception as e:
            logger.error("Batch send error: %s", e)
            return [
                SendResult(message_id=None, status="failed", error=str(e))
                for _ in emails
            ]

    async def _send_batch_concurrent(
        self,
        emails: list[dict[str, Any]],
    ) -> list[SendResult]:
        """ส่ง email พร้อมกันด้วย asyncio.gather + Semaphore(10)"""

        async def send_one(email_data: dict[str, Any]) -> SendResult:
            return await self.send_email(
                from_email=email_data.get("from_email", ""),
                to_email=email_data.get("to_email", ""),
                subject=email_data.get("subject", ""),
                html_body=email_data.get("html_body", ""),
                text_body=email_data.get("text_body"),
                reply_to=email_data.get("reply_to"),
                tags=email_data.get("tags"),
            )

        tasks = [send_one(e) for e in emails]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        results: list[SendResult] = []
        for i, result in enumerate(raw_results):
            if isinstance(result, Exception):
                logger.error("Batch item %d error: %s", i, result)
                results.append(SendResult(
                    message_id=None,
                    status="failed",
                    error=str(result),
                ))
            else:
                results.append(result)

        return results

    async def check_domain_status(self, domain: str) -> DomainStatus:
        """
        ตรวจสอบสถานะ domain ใน Resend

        Args:
            domain: domain name เช่น "yourdomain.com"

        Returns:
            DomainStatus ที่มีข้อมูล DKIM/SPF/DMARC
        """
        if not settings.resend_api_key:
            return DomainStatus(
                domain=domain,
                status="unknown",
                error="Resend API key ไม่ถูกตั้งค่า",
            )

        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
                response = await client.get(
                    _RESEND_DOMAINS_URL,
                    headers=_build_resend_headers(),
                )
                response.raise_for_status()

            data = response.json()
            domains = data.get("data", []) if isinstance(data, dict) else []

            # หา domain ที่ match
            matched = next(
                (d for d in domains if d.get("name") == domain),
                None,
            )

            if not matched:
                return DomainStatus(
                    domain=domain,
                    status="not_found",
                    error=f"Domain {domain} ไม่พบใน Resend account",
                )

            records = matched.get("records", [])
            spf_valid = any(
                r.get("type") == "MX" or r.get("name", "").startswith("spf")
                for r in records
                if r.get("status") == "verified"
            )
            dkim_valid = any(
                r.get("type") == "TXT" and "dkim" in r.get("name", "").lower()
                for r in records
                if r.get("status") == "verified"
            )

            domain_status = matched.get("status", "pending")

            return DomainStatus(
                domain=domain,
                status=domain_status,
                spf_valid=spf_valid,
                dkim_valid=dkim_valid,
                dmarc_valid=False,  # ตรวจ DMARC ใน DomainManager
            )

        except httpx.HTTPStatusError as e:
            logger.error("Resend domain check error | domain=%s | status=%d", domain, e.response.status_code)
            return DomainStatus(
                domain=domain,
                status="error",
                error=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            )

        except Exception as e:
            logger.error("Unexpected error checking domain %s: %s", domain, e)
            return DomainStatus(
                domain=domain,
                status="error",
                error=str(e),
            )


# Singleton instance
email_sender = EmailSender()
