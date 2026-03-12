"""
Tracking Endpoints — Email open tracking, click tracking, unsubscribe และ Resend webhook
"""

import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response

from app.services.tracking import tracking_service
from app.services.supabase_client import supabase

logger = logging.getLogger(__name__)
router = APIRouter()

# Content-Type สำหรับ tracking pixel GIF
_GIF_CONTENT_TYPE = "image/gif"
_GIF_CACHE_CONTROL = "no-cache, no-store, must-revalidate, max-age=0"

# Resend webhook event types
_RESEND_EVENT_SENT = "email.sent"
_RESEND_EVENT_DELIVERED = "email.delivered"
_RESEND_EVENT_OPENED = "email.opened"
_RESEND_EVENT_CLICKED = "email.clicked"
_RESEND_EVENT_BOUNCED = "email.bounced"
_RESEND_EVENT_COMPLAINED = "email.complained"

# Table names
_TABLE_EMAIL_EVENTS = "email_events"
_TABLE_UNSUBSCRIBES = "email_unsubscribes"


async def _record_event(
    event_id: str,
    event_type: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    """บันทึก tracking event ลง Supabase (fire-and-forget)"""
    try:
        await supabase.insert(
            table=_TABLE_EMAIL_EVENTS,
            data={
                "event_id": event_id,
                "event_type": event_type,
                "occurred_at": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata or {},
            },
            returning=False,
        )
    except Exception as e:
        logger.warning("Failed to record event %s for %s: %s", event_type, event_id, e)


@router.get(
    "/track/open/{event_id}",
    summary="Email open tracking pixel",
    description="Return 1x1 transparent GIF และบันทึก open event",
    include_in_schema=False,
)
async def track_open(event_id: str, request: Request) -> Response:
    """
    Tracking pixel endpoint — บันทึก email open event

    Client จะ request URL นี้โดยอัตโนมัติเมื่อเปิดอีเมล (โหลด image)
    Return 1x1 transparent GIF เพื่อไม่ให้ email client แสดง error
    """
    # บันทึก event (non-blocking)
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await _record_event(
        event_id=event_id,
        event_type="open",
        metadata={
            "ip": ip,
            "user_agent": user_agent,
        },
    )

    logger.debug("Email opened | event_id=%s | ip=%s", event_id, ip)

    # Return 1x1 GIF
    return Response(
        content=tracking_service.get_tracking_pixel_bytes(),
        media_type=_GIF_CONTENT_TYPE,
        headers={
            "Cache-Control": _GIF_CACHE_CONTROL,
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get(
    "/track/click/{event_id}",
    summary="Email click tracking redirect",
    description="บันทึก click event และ redirect ไปยัง URL ปลายทาง",
    include_in_schema=False,
)
async def track_click(event_id: str, url: str, request: Request) -> RedirectResponse:
    """
    Click tracking endpoint — บันทึก click event และ redirect

    URL ปลายทางถูก URL-encode ไว้ใน query parameter ?url=
    """
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ต้องระบุ url parameter",
        )

    # Decode URL
    decoded_url = unquote(url)

    # ตรวจสอบ URL scheme (ป้องกัน open redirect ที่อันตราย)
    if not (decoded_url.startswith("http://") or decoded_url.startswith("https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL ต้องเริ่มต้นด้วย http:// หรือ https://",
        )

    # บันทึก event
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await _record_event(
        event_id=event_id,
        event_type="click",
        metadata={
            "url": decoded_url,
            "ip": ip,
            "user_agent": user_agent,
        },
    )

    logger.debug("Email clicked | event_id=%s | url=%s", event_id, decoded_url[:100])

    return RedirectResponse(url=decoded_url, status_code=status.HTTP_302_FOUND)


@router.get(
    "/unsubscribe/{token}",
    summary="Unsubscribe page",
    description="Decode token และ unsubscribe email address",
)
async def unsubscribe(token: str) -> dict[str, Any]:
    """
    Unsubscribe endpoint

    Token = base64url encode ของ "{workspace_id}:{email}"
    จะ decode token แล้ว insert ลง email_unsubscribes table
    """
    decoded = tracking_service.decode_unsubscribe_token(token)

    if not decoded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsubscribe link ไม่ถูกต้องหรือหมดอายุ",
        )

    workspace_id, email = decoded

    # บันทึกการ unsubscribe
    try:
        await supabase.upsert(
            table=_TABLE_UNSUBSCRIBES,
            data={
                "workspace_id": workspace_id,
                "email": email,
                "unsubscribed_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="workspace_id,email",
            returning=False,
        )
        logger.info("Unsubscribed | workspace=%s | email=%s", workspace_id, email)
    except Exception as e:
        logger.error("Failed to record unsubscribe | email=%s | error=%s", email, e)
        # ยังคง return success เพื่อ UX ที่ดี

    return {
        "success": True,
        "message": f"อีเมล {email} ถูกยกเลิกการรับข่าวสารเรียบร้อยแล้ว",
        "email": email,
    }


@router.post(
    "/webhooks/resend",
    summary="Resend webhook handler",
    description="รับ events จาก Resend (sent, delivered, opened, clicked, bounced, complained)",
    include_in_schema=False,
)
async def resend_webhook(request: Request) -> dict[str, str]:
    """
    Resend webhook handler

    รองรับ events:
    - email.sent: บันทึก sent event
    - email.delivered: บันทึก delivered event
    - email.opened: บันทึก open event
    - email.clicked: บันทึก click event
    - email.bounced: บันทึก bounce event
    - email.complained: บันทึก complaint event + auto-unsubscribe
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    event_type = payload.get("type", "")
    data = payload.get("data", {})

    # Extract common fields
    email_id = data.get("email_id") or data.get("id", "")
    to_address = data.get("to", [])
    if isinstance(to_address, list) and to_address:
        to_address = to_address[0]
    elif isinstance(to_address, str):
        pass
    else:
        to_address = ""

    tags = data.get("tags", {})

    logger.info("Resend webhook | type=%s | email_id=%s | to=%s", event_type, email_id, to_address)

    # Map Resend event type → internal event type
    event_map = {
        _RESEND_EVENT_SENT: "sent",
        _RESEND_EVENT_DELIVERED: "delivered",
        _RESEND_EVENT_OPENED: "open",
        _RESEND_EVENT_CLICKED: "click",
        _RESEND_EVENT_BOUNCED: "bounce",
        _RESEND_EVENT_COMPLAINED: "complaint",
    }

    internal_event = event_map.get(event_type)

    if not internal_event:
        logger.debug("Unknown Resend event type: %s", event_type)
        return {"status": "ignored", "reason": f"unknown event type: {event_type}"}

    # บันทึก event ลง Supabase
    metadata: dict[str, Any] = {
        "resend_email_id": email_id,
        "to": to_address,
        "tags": tags,
        "raw_type": event_type,
    }

    # เพิ่ม click URL ถ้ามี
    if event_type == _RESEND_EVENT_CLICKED:
        metadata["click_url"] = data.get("click", {}).get("link", "")

    # เพิ่ม bounce reason ถ้ามี
    if event_type == _RESEND_EVENT_BOUNCED:
        bounce = data.get("bounce", {})
        metadata["bounce_type"] = bounce.get("type", "")
        metadata["bounce_description"] = bounce.get("description", "")

    await _record_event(
        event_id=email_id,
        event_type=internal_event,
        metadata=metadata,
    )

    # Auto-unsubscribe เมื่อมี complaint
    if event_type == _RESEND_EVENT_COMPLAINED and to_address:
        workspace_id = tags.get("workspace_id", "") if isinstance(tags, dict) else ""

        if workspace_id:
            try:
                await supabase.upsert(
                    table=_TABLE_UNSUBSCRIBES,
                    data={
                        "workspace_id": workspace_id,
                        "email": to_address,
                        "unsubscribed_at": datetime.now(timezone.utc).isoformat(),
                        "reason": "complaint",
                    },
                    on_conflict="workspace_id,email",
                    returning=False,
                )
                logger.warning(
                    "Auto-unsubscribed due to complaint | email=%s | workspace=%s",
                    to_address,
                    workspace_id,
                )
            except Exception as e:
                logger.error("Failed to auto-unsubscribe | email=%s | error=%s", to_address, e)
        else:
            logger.warning(
                "Complaint received but no workspace_id in tags | email=%s",
                to_address,
            )

    return {"status": "ok", "event": internal_event}
