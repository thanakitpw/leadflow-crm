"""
Email Schemas — Pydantic models สำหรับ Email Writer และ Email Sender
"""

from pydantic import BaseModel, EmailStr


class EmailDraft(BaseModel):
    subject: str
    body_html: str
    body_text: str
    variables_used: list[str] = []


class GenerateEmailRequest(BaseModel):
    lead_name: str
    business_name: str
    email: str
    category: str | None = None
    location: str | None = None
    rating: float | None = None
    score: int | None = None
    tone: str = "friendly"  # formal, friendly, casual
    language: str = "th"  # th, en
    template_category: str | None = None


class GenerateEmailResponse(BaseModel):
    draft: EmailDraft


class GenerateABResponse(BaseModel):
    variant_a: EmailDraft
    variant_b: EmailDraft


class SubjectSuggestionsRequest(BaseModel):
    lead_name: str
    business_name: str
    category: str | None = None
    location: str | None = None
    language: str = "th"
    count: int = 3


class SubjectSuggestionsResponse(BaseModel):
    subjects: list[str]


class SendEmailRequest(BaseModel):
    from_email: str
    to_email: str
    subject: str
    html_body: str
    text_body: str | None = None
    reply_to: str | None = None
    tags: dict[str, str] | None = None


class SendResult(BaseModel):
    message_id: str | None
    status: str  # sent, failed
    error: str | None = None


class BatchSendRequest(BaseModel):
    emails: list[SendEmailRequest]


class BatchSendResponse(BaseModel):
    results: list[SendResult]
    total: int
    sent: int
    failed: int


class DomainStatus(BaseModel):
    domain: str
    status: str  # verified, pending, failed
    spf_valid: bool = False
    dkim_valid: bool = False
    dmarc_valid: bool = False
    error: str | None = None
