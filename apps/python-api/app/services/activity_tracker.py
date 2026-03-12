"""
Activity Tracker Service — บันทึก activity ลง Supabase activity_feed table

รองรับ actions ทุกประเภทใน LeadFlow CRM:
- Lead actions:    lead_created, lead_updated, lead_deleted, lead_scored
- Campaign actions: campaign_created, campaign_sent, campaign_paused
- Email actions:   email_sent, email_opened, email_clicked, email_bounced
- Template actions: template_created, template_updated
- Sequence actions: sequence_created, lead_enrolled
"""

import logging
from datetime import datetime, timezone
from typing import Any, Literal

from app.services.supabase_client import supabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Action type definitions
# ---------------------------------------------------------------------------

LeadAction = Literal[
    "lead_created",
    "lead_updated",
    "lead_deleted",
    "lead_scored",
]

CampaignAction = Literal[
    "campaign_created",
    "campaign_sent",
    "campaign_paused",
    "campaign_resumed",
    "campaign_completed",
]

EmailAction = Literal[
    "email_sent",
    "email_opened",
    "email_clicked",
    "email_bounced",
    "email_replied",
    "email_unsubscribed",
]

TemplateAction = Literal[
    "template_created",
    "template_updated",
    "template_deleted",
]

SequenceAction = Literal[
    "sequence_created",
    "sequence_updated",
    "lead_enrolled",
    "lead_unenrolled",
]

ActivityAction = (
    LeadAction
    | CampaignAction
    | EmailAction
    | TemplateAction
    | SequenceAction
    | str  # fallback สำหรับ custom actions
)

EntityType = Literal[
    "lead",
    "campaign",
    "email",
    "template",
    "sequence",
    "workspace",
]

# ชื่อ table ใน Supabase
_TABLE_ACTIVITY_FEED = "activity_feed"


# ---------------------------------------------------------------------------
# Core tracker function
# ---------------------------------------------------------------------------

async def track_activity(
    workspace_id: str,
    action: ActivityAction,
    entity_type: EntityType | str,
    entity_id: str | None = None,
    user_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """
    บันทึก activity event ลง Supabase activity_feed table

    Args:
        workspace_id: ID ของ workspace (multi-tenant filter — จำเป็นต้องระบุ)
        action: ประเภทของ action เช่น "lead_created", "email_sent"
        entity_type: ประเภทของ entity เช่น "lead", "campaign", "email"
        entity_id: ID ของ entity ที่เกี่ยวข้อง (optional)
        user_id: ID ของ user ที่ทำ action (optional, None = system action)
        metadata: ข้อมูลเพิ่มเติม เช่น {"score": 85, "reason": "high rating"}

    Returns:
        dict ของ row ที่ insert ได้ หรือ None ถ้าเกิด error
    """
    if not workspace_id:
        logger.warning("track_activity: workspace_id is required, skipping")
        return None

    if not action:
        logger.warning("track_activity: action is required, skipping")
        return None

    record: dict[str, Any] = {
        "workspace_id": workspace_id,
        "action": action,
        "entity_type": entity_type,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }

    if entity_id is not None:
        record["entity_id"] = entity_id

    if user_id is not None:
        record["user_id"] = user_id

    try:
        result = await supabase.insert(
            table=_TABLE_ACTIVITY_FEED,
            data=record,
            returning=True,
        )
        logger.debug(
            "Activity tracked | workspace=%s | action=%s | entity=%s/%s",
            workspace_id,
            action,
            entity_type,
            entity_id,
        )
        return result

    except Exception as e:
        # Activity tracking ไม่ควร block main flow — log แล้วคืน None
        logger.error(
            "track_activity: failed to insert | workspace=%s | action=%s | error=%s",
            workspace_id,
            action,
            str(e),
        )
        return None


# ---------------------------------------------------------------------------
# Convenience wrappers — Lead actions
# ---------------------------------------------------------------------------

async def track_lead_created(
    workspace_id: str,
    lead_id: str,
    user_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อสร้าง lead ใหม่"""
    return await track_activity(
        workspace_id=workspace_id,
        action="lead_created",
        entity_type="lead",
        entity_id=lead_id,
        user_id=user_id,
        metadata=metadata,
    )


async def track_lead_updated(
    workspace_id: str,
    lead_id: str,
    changed_fields: list[str] | None = None,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่ออัปเดตข้อมูล lead"""
    meta: dict[str, Any] = {}
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return await track_activity(
        workspace_id=workspace_id,
        action="lead_updated",
        entity_type="lead",
        entity_id=lead_id,
        user_id=user_id,
        metadata=meta,
    )


async def track_lead_scored(
    workspace_id: str,
    lead_id: str,
    score: int,
    score_details: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อ AI ให้คะแนน lead"""
    meta: dict[str, Any] = {"score": score}
    if score_details:
        meta.update(score_details)
    return await track_activity(
        workspace_id=workspace_id,
        action="lead_scored",
        entity_type="lead",
        entity_id=lead_id,
        metadata=meta,
    )


async def track_lead_deleted(
    workspace_id: str,
    lead_id: str,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อลบ lead"""
    return await track_activity(
        workspace_id=workspace_id,
        action="lead_deleted",
        entity_type="lead",
        entity_id=lead_id,
        user_id=user_id,
    )


# ---------------------------------------------------------------------------
# Convenience wrappers — Campaign actions
# ---------------------------------------------------------------------------

async def track_campaign_created(
    workspace_id: str,
    campaign_id: str,
    campaign_name: str,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อสร้าง campaign ใหม่"""
    return await track_activity(
        workspace_id=workspace_id,
        action="campaign_created",
        entity_type="campaign",
        entity_id=campaign_id,
        user_id=user_id,
        metadata={"campaign_name": campaign_name},
    )


async def track_campaign_sent(
    workspace_id: str,
    campaign_id: str,
    email_count: int,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อส่ง campaign"""
    return await track_activity(
        workspace_id=workspace_id,
        action="campaign_sent",
        entity_type="campaign",
        entity_id=campaign_id,
        user_id=user_id,
        metadata={"email_count": email_count},
    )


async def track_campaign_paused(
    workspace_id: str,
    campaign_id: str,
    user_id: str | None = None,
    reason: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อหยุด campaign ชั่วคราว"""
    meta: dict[str, Any] = {}
    if reason:
        meta["reason"] = reason
    return await track_activity(
        workspace_id=workspace_id,
        action="campaign_paused",
        entity_type="campaign",
        entity_id=campaign_id,
        user_id=user_id,
        metadata=meta,
    )


# ---------------------------------------------------------------------------
# Convenience wrappers — Email actions
# ---------------------------------------------------------------------------

async def track_email_sent(
    workspace_id: str,
    email_event_id: str,
    lead_id: str | None = None,
    campaign_id: str | None = None,
    to_email: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อส่ง email"""
    meta: dict[str, Any] = {}
    if lead_id:
        meta["lead_id"] = lead_id
    if campaign_id:
        meta["campaign_id"] = campaign_id
    if to_email:
        meta["to_email"] = to_email
    return await track_activity(
        workspace_id=workspace_id,
        action="email_sent",
        entity_type="email",
        entity_id=email_event_id,
        metadata=meta,
    )


async def track_email_opened(
    workspace_id: str,
    email_event_id: str,
    lead_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อ lead เปิดอ่าน email"""
    meta: dict[str, Any] = {}
    if lead_id:
        meta["lead_id"] = lead_id
    return await track_activity(
        workspace_id=workspace_id,
        action="email_opened",
        entity_type="email",
        entity_id=email_event_id,
        metadata=meta,
    )


async def track_email_clicked(
    workspace_id: str,
    email_event_id: str,
    url: str | None = None,
    lead_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อ lead คลิกลิงก์ใน email"""
    meta: dict[str, Any] = {}
    if url:
        meta["url"] = url
    if lead_id:
        meta["lead_id"] = lead_id
    return await track_activity(
        workspace_id=workspace_id,
        action="email_clicked",
        entity_type="email",
        entity_id=email_event_id,
        metadata=meta,
    )


async def track_email_bounced(
    workspace_id: str,
    email_event_id: str,
    bounce_type: str | None = None,
    to_email: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อ email bounce"""
    meta: dict[str, Any] = {}
    if bounce_type:
        meta["bounce_type"] = bounce_type
    if to_email:
        meta["to_email"] = to_email
    return await track_activity(
        workspace_id=workspace_id,
        action="email_bounced",
        entity_type="email",
        entity_id=email_event_id,
        metadata=meta,
    )


# ---------------------------------------------------------------------------
# Convenience wrappers — Template actions
# ---------------------------------------------------------------------------

async def track_template_created(
    workspace_id: str,
    template_id: str,
    template_name: str,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อสร้าง email template"""
    return await track_activity(
        workspace_id=workspace_id,
        action="template_created",
        entity_type="template",
        entity_id=template_id,
        user_id=user_id,
        metadata={"template_name": template_name},
    )


async def track_template_updated(
    workspace_id: str,
    template_id: str,
    user_id: str | None = None,
    changed_fields: list[str] | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่ออัปเดต email template"""
    meta: dict[str, Any] = {}
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return await track_activity(
        workspace_id=workspace_id,
        action="template_updated",
        entity_type="template",
        entity_id=template_id,
        user_id=user_id,
        metadata=meta,
    )


# ---------------------------------------------------------------------------
# Convenience wrappers — Sequence actions
# ---------------------------------------------------------------------------

async def track_sequence_created(
    workspace_id: str,
    sequence_id: str,
    sequence_name: str,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """บันทึกเมื่อสร้าง email sequence"""
    return await track_activity(
        workspace_id=workspace_id,
        action="sequence_created",
        entity_type="sequence",
        entity_id=sequence_id,
        user_id=user_id,
        metadata={"sequence_name": sequence_name},
    )


async def track_lead_enrolled(
    workspace_id: str,
    sequence_id: str,
    lead_id: str,
    enrolled_count: int = 1,
) -> dict[str, Any] | None:
    """บันทึกเมื่อเพิ่ม lead เข้า sequence"""
    return await track_activity(
        workspace_id=workspace_id,
        action="lead_enrolled",
        entity_type="sequence",
        entity_id=sequence_id,
        metadata={"lead_id": lead_id, "enrolled_count": enrolled_count},
    )
