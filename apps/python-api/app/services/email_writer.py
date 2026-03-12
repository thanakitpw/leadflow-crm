"""
Email Writer Service — ใช้ Claude claude-sonnet-4-6 เขียน cold email outreach
รองรับ personalization, A/B variants และ subject line suggestions
"""

import asyncio
import json
import logging
import re
from typing import Any

import anthropic

from app.core.config import settings
from app.schemas.email import EmailDraft

logger = logging.getLogger(__name__)

# จำกัด concurrent Claude calls ไม่เกิน 3 พร้อมกัน
_claude_semaphore = asyncio.Semaphore(3)

# Placeholder สำหรับเมื่อไม่มี API key
_PLACEHOLDER_SUBJECT_TH = "ช่วยธุรกิจของคุณเติบโตได้อย่างไร"
_PLACEHOLDER_SUBJECT_EN = "How we can help your business grow"

_PLACEHOLDER_BODY_TH = """<p>สวัสดีครับ {{first_name}},</p>
<p>ผมได้ศึกษาธุรกิจ <strong>{{business_name}}</strong> ที่ {{location}} และเห็นว่ามีศักยภาพในการเติบโตที่น่าสนใจมาก</p>
<p>ทางเรามีบริการที่ช่วยให้ธุรกิจ {{category}} เช่นของคุณสามารถเพิ่มยอดขายและลูกค้าใหม่ได้อย่างมีประสิทธิภาพ</p>
<p>สนใจคุยเพิ่มเติมไหมครับ? ตอบกลับอีเมลนี้ได้เลยครับ</p>
<p>ขอบคุณครับ</p>
<p><a href="{{unsubscribe_link}}">ยกเลิกการรับอีเมล</a></p>"""

_PLACEHOLDER_BODY_EN = """<p>Hi {{first_name}},</p>
<p>I came across <strong>{{business_name}}</strong> in {{location}} and noticed some great opportunities for growth.</p>
<p>We help {{category}} businesses like yours attract more customers and increase revenue efficiently.</p>
<p>Would you be open to a quick chat? Just reply to this email.</p>
<p>Best regards</p>
<p><a href="{{unsubscribe_link}}">Unsubscribe</a></p>"""


def _extract_first_name(full_name: str) -> str:
    """ดึงชื่อแรกจาก full name"""
    if not full_name:
        return ""
    parts = full_name.strip().split()
    return parts[0] if parts else full_name


def _replace_variables(text: str, variables: dict[str, str]) -> tuple[str, list[str]]:
    """
    Replace template variables ใน text

    Args:
        text: template string ที่มี {{variable_name}}
        variables: dict ของ variable → value

    Returns:
        tuple ของ (replaced_text, list_of_variables_used)
    """
    used: list[str] = []
    result = text

    for key, value in variables.items():
        placeholder = f"{{{{{key}}}}}"
        if placeholder in result:
            result = result.replace(placeholder, value or "")
            if value:
                used.append(key)

    return result, used


def _build_variables(lead_data: dict[str, Any]) -> dict[str, str]:
    """สร้าง dict ของ variables จาก lead_data"""
    full_name = lead_data.get("name") or lead_data.get("lead_name", "")
    return {
        "business_name": lead_data.get("business_name", ""),
        "first_name": _extract_first_name(full_name),
        "name": full_name,
        "location": lead_data.get("location", ""),
        "category": lead_data.get("category", ""),
        "rating": str(lead_data.get("rating", "")) if lead_data.get("rating") else "",
        "score": str(lead_data.get("score", "")) if lead_data.get("score") else "",
        "unsubscribe_link": "{{unsubscribe_link}}",  # จะ inject ใน tracking layer
    }


def _build_email_system_prompt(language: str) -> str:
    """สร้าง system prompt สำหรับ Claude email writer"""
    if language == "th":
        return """คุณคือผู้เชี่ยวชาญด้านการเขียน cold email outreach สำหรับธุรกิจไทย

หน้าที่ของคุณ:
- เขียน email ที่เป็นธรรมชาติ น่าอ่าน และมีความเป็นส่วนตัวสูง
- ใช้ภาษาไทยที่เป็นทางการแต่ไม่แข็งกระด้าง
- Subject line ต้องสั้น กระชับ น่าสนใจ (ไม่เกิน 60 ตัวอักษร)
- Body ต้องสั้น อ่านง่าย มี CTA ที่ชัดเจน
- ต้องมี {{unsubscribe_link}} ไว้ท้ายเสมอ
- ใช้ HTML formatting (p, strong, a tags)
- ห้ามเขียนเนื้อหาที่ดูเหมือน spam หรือ aggressive sales"""
    else:
        return """You are an expert cold email outreach writer for Thai businesses.

Your responsibilities:
- Write natural, engaging, and highly personalized emails
- Use clear, professional but approachable language
- Subject lines must be short and compelling (under 60 characters)
- Body must be concise and easy to read with a clear CTA
- Always include {{unsubscribe_link}} at the bottom
- Use HTML formatting (p, strong, a tags)
- Avoid spam-like or aggressive sales language"""


def _build_email_prompt(
    lead_data: dict[str, Any],
    template_category: str | None,
    tone: str,
    language: str,
    variant_hint: str = "",
) -> str:
    """สร้าง prompt สำหรับ Claude เขียน email"""
    business_name = lead_data.get("business_name", "ไม่ระบุ")
    full_name = lead_data.get("name") or lead_data.get("lead_name", "")
    first_name = _extract_first_name(full_name)
    category = lead_data.get("category", "")
    location = lead_data.get("location", "")
    rating = lead_data.get("rating")
    score = lead_data.get("score")
    template_cat = template_category or category or "ธุรกิจทั่วไป"

    tone_descriptions = {
        "formal": "ทางการ สุภาพ มืออาชีพ" if language == "th" else "formal, professional, respectful",
        "friendly": "เป็นมิตร อบอุ่น แต่มืออาชีพ" if language == "th" else "friendly, warm, yet professional",
        "casual": "ผ่อนคลาย เป็นกันเอง" if language == "th" else "casual, relaxed, conversational",
    }
    tone_desc = tone_descriptions.get(tone, tone_descriptions["friendly"])

    lead_context = f"""ข้อมูล Lead:
- ชื่อธุรกิจ: {business_name}
- ชื่อผู้ติดต่อ: {first_name or "ไม่ระบุ"}
- ประเภทธุรกิจ: {category or "ไม่ระบุ"}
- ที่ตั้ง: {location or "ไม่ระบุ"}
- Google Rating: {rating or "ไม่ระบุ"}
- Lead Score: {score or "ไม่ระบุ"}/100
- หมวดหมู่ template: {template_cat}"""

    if language == "th":
        prompt = f"""{lead_context}

โทน: {tone_desc}
{f"คำแนะนำเพิ่มเติม: {variant_hint}" if variant_hint else ""}

เขียน cold email outreach เพื่อนำเสนอบริการ digital marketing / lead generation
โดย personalize จากข้อมูลข้างต้น

กฎ:
- Subject: สั้น น่าสนใจ ไม่เกิน 60 ตัวอักษร
- Body HTML: 3-4 ย่อหน้า ใช้ <p>, <strong>, <a> tags
- Body Text: version ข้อความธรรมดา (ไม่มี HTML)
- ใส่ {{{{unsubscribe_link}}}} ไว้ในส่วนท้ายของ body_html
- ใส่ตัวแปร {{{{business_name}}}}, {{{{first_name}}}}, {{{{location}}}}, {{{{category}}}} ตามที่เหมาะสม

ตอบในรูปแบบ JSON เท่านั้น:
{{
  "subject": "<subject line>",
  "body_html": "<html email body>",
  "body_text": "<plain text version>"
}}"""
    else:
        prompt = f"""{lead_context}

Tone: {tone_desc}
{f"Additional guidance: {variant_hint}" if variant_hint else ""}

Write a cold email outreach to offer digital marketing / lead generation services,
personalized based on the lead data above.

Rules:
- Subject: short, compelling, under 60 characters
- Body HTML: 3-4 paragraphs using <p>, <strong>, <a> tags
- Body Text: plain text version (no HTML)
- Include {{{{unsubscribe_link}}}} at the bottom of body_html
- Use variables {{{{business_name}}}}, {{{{first_name}}}}, {{{{location}}}}, {{{{category}}}} where appropriate

Reply in JSON format only:
{{
  "subject": "<subject line>",
  "body_html": "<html email body>",
  "body_text": "<plain text version>"
}}"""

    return prompt


def _build_subject_prompt(lead_data: dict[str, Any], count: int, language: str) -> str:
    """สร้าง prompt สำหรับ Claude แนะนำ subject lines"""
    business_name = lead_data.get("business_name", "")
    category = lead_data.get("category", "")
    location = lead_data.get("location", "")

    if language == "th":
        return f"""ธุรกิจ: {business_name}
ประเภท: {category}
ที่ตั้ง: {location}

สร้าง subject line สำหรับ cold email outreach จำนวน {count} แบบ
- แต่ละ subject ต้องสั้น น่าสนใจ ไม่เกิน 60 ตัวอักษร
- หลากหลายแนวทาง เช่น คำถาม, ข้อเสนอ, ตัวเลข
- ภาษาไทยเท่านั้น

ตอบเป็น JSON array เท่านั้น:
["subject 1", "subject 2", ...]"""
    else:
        return f"""Business: {business_name}
Category: {category}
Location: {location}

Generate {count} subject lines for a cold email outreach
- Each subject must be short, compelling, under 60 characters
- Vary the approach: question, offer, number-based, etc.
- English only

Reply as JSON array only:
["subject 1", "subject 2", ...]"""


def _parse_json_response(response_text: str) -> dict | list | None:
    """Parse JSON จาก Claude response — รองรับ markdown code blocks"""
    text = response_text.strip()

    # ลบ markdown code block
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # พยายาม extract JSON ด้วย regex
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        array_match = re.search(r'\[[\s\S]*\]', text)
        if array_match:
            try:
                return json.loads(array_match.group())
            except json.JSONDecodeError:
                pass

    return None


class EmailWriter:
    """
    Claude-powered Email Writer Agent

    สร้าง personalized cold email outreach จาก lead data
    รองรับ A/B variants และ subject line suggestions
    """

    async def generate_email(
        self,
        lead_data: dict[str, Any],
        template_category: str | None = None,
        tone: str = "friendly",
        language: str = "th",
    ) -> EmailDraft:
        """
        สร้าง personalized email draft จาก lead data

        Args:
            lead_data: dict ที่มี name, email, business_name, category, location, rating, score
            template_category: หมวดหมู่ template เช่น "restaurant", "hotel"
            tone: 'formal' | 'friendly' | 'casual'
            language: 'th' | 'en'

        Returns:
            EmailDraft ที่มี subject, body_html, body_text
            ถ้าไม่มี API key → return placeholder template
        """
        # Fallback เมื่อไม่มี API key
        if not settings.anthropic_api_key:
            logger.warning("Anthropic API key ไม่ถูกตั้งค่า — ใช้ placeholder email")
            return self._get_placeholder_draft(lead_data, language)

        prompt = _build_email_prompt(lead_data, template_category, tone, language)
        system_prompt = _build_email_system_prompt(language)

        async with _claude_semaphore:
            try:
                client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
                message = await client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=2000,
                    system=system_prompt,
                    messages=[{"role": "user", "content": prompt}],
                )

                response_text = message.content[0].text
                data = _parse_json_response(response_text)

                if not data or not isinstance(data, dict):
                    logger.warning("Claude ส่งกลับ JSON ไม่ถูกต้อง — ใช้ placeholder")
                    return self._get_placeholder_draft(lead_data, language)

                subject = str(data.get("subject", ""))
                body_html = str(data.get("body_html", ""))
                body_text = str(data.get("body_text", ""))

                # Replace variables
                variables = _build_variables(lead_data)
                subject, used_s = _replace_variables(subject, variables)
                body_html, used_h = _replace_variables(body_html, variables)
                body_text, used_t = _replace_variables(body_text, variables)

                all_used = list(set(used_s + used_h + used_t))

                logger.debug(
                    "Email generated for %s | subject=%s",
                    lead_data.get("business_name", "unknown"),
                    subject[:50],
                )

                return EmailDraft(
                    subject=subject,
                    body_html=body_html,
                    body_text=body_text,
                    variables_used=all_used,
                )

            except anthropic.AuthenticationError:
                logger.error("Anthropic API key ไม่ถูกต้อง")
                return self._get_placeholder_draft(lead_data, language)

            except anthropic.RateLimitError:
                logger.warning("Anthropic rate limit exceeded")
                return self._get_placeholder_draft(lead_data, language)

            except anthropic.APIError as e:
                logger.error("Claude API error ใน email writer: %s", e)
                return self._get_placeholder_draft(lead_data, language)

            except Exception as e:
                logger.error("Unexpected error ใน email writer: %s", e)
                return self._get_placeholder_draft(lead_data, language)

    async def generate_ab_variants(
        self,
        lead_data: dict[str, Any],
        template_category: str | None = None,
        tone: str = "friendly",
        language: str = "th",
    ) -> tuple[EmailDraft, EmailDraft]:
        """
        สร้าง 2 email variants สำหรับ A/B testing

        Variant A: เน้น value proposition / ประโยชน์ที่ได้รับ
        Variant B: เน้น social proof / case study / urgency

        Returns:
            tuple ของ (variant_a, variant_b)
        """
        hint_a = "เน้น value proposition และประโยชน์ที่ธุรกิจจะได้รับ ใช้ตัวเลขและ ROI" if language == "th" \
            else "Focus on value proposition and business benefits, use numbers and ROI"

        hint_b = "เน้น social proof, case study, และสร้าง urgency เพื่อกระตุ้นให้ตอบกลับเร็ว" if language == "th" \
            else "Focus on social proof, case study, and create urgency to prompt quick response"

        # Generate ทั้งสองพร้อมกัน
        variant_a, variant_b = await asyncio.gather(
            self.generate_email(
                lead_data,
                template_category,
                tone,
                language,
            ),
            self._generate_with_hint(lead_data, template_category, tone, language, hint_b),
        )

        # Ensure subjects แตกต่างกัน (retry ถ้าเหมือนกัน)
        if variant_a.subject == variant_b.subject:
            variant_b = await self._generate_with_hint(
                lead_data, template_category, tone, language,
                hint_b + (" กรุณาใช้ subject line ที่ต่างจาก: " if language == "th" else " Use a different subject than: ")
                + variant_a.subject,
            )

        return variant_a, variant_b

    async def suggest_subject_lines(
        self,
        lead_data: dict[str, Any],
        count: int = 3,
        language: str = "th",
    ) -> list[str]:
        """
        แนะนำ subject lines จาก Claude

        Args:
            lead_data: ข้อมูล lead
            count: จำนวน subject lines ที่ต้องการ (default 3)
            language: 'th' | 'en'

        Returns:
            list ของ subject line strings
            ถ้าไม่มี API key → return default subjects
        """
        if not settings.anthropic_api_key:
            logger.warning("Anthropic API key ไม่ถูกตั้งค่า — ใช้ placeholder subjects")
            return self._get_placeholder_subjects(language, count)

        prompt = _build_subject_prompt(lead_data, count, language)

        async with _claude_semaphore:
            try:
                client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
                message = await client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=500,
                    messages=[{"role": "user", "content": prompt}],
                )

                response_text = message.content[0].text
                data = _parse_json_response(response_text)

                if isinstance(data, list):
                    subjects = [str(s) for s in data if s]
                    return subjects[:count]

                logger.warning("Claude ส่งกลับ format ผิดสำหรับ subject suggestions")
                return self._get_placeholder_subjects(language, count)

            except Exception as e:
                logger.error("Error ใน suggest_subject_lines: %s", e)
                return self._get_placeholder_subjects(language, count)

    async def _generate_with_hint(
        self,
        lead_data: dict[str, Any],
        template_category: str | None,
        tone: str,
        language: str,
        hint: str,
    ) -> EmailDraft:
        """สร้าง email draft พร้อม hint เพิ่มเติม"""
        if not settings.anthropic_api_key:
            return self._get_placeholder_draft(lead_data, language)

        prompt = _build_email_prompt(lead_data, template_category, tone, language, variant_hint=hint)
        system_prompt = _build_email_system_prompt(language)

        async with _claude_semaphore:
            try:
                client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
                message = await client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=2000,
                    system=system_prompt,
                    messages=[{"role": "user", "content": prompt}],
                )

                response_text = message.content[0].text
                data = _parse_json_response(response_text)

                if not data or not isinstance(data, dict):
                    return self._get_placeholder_draft(lead_data, language)

                variables = _build_variables(lead_data)
                subject, used_s = _replace_variables(str(data.get("subject", "")), variables)
                body_html, used_h = _replace_variables(str(data.get("body_html", "")), variables)
                body_text, used_t = _replace_variables(str(data.get("body_text", "")), variables)

                return EmailDraft(
                    subject=subject,
                    body_html=body_html,
                    body_text=body_text,
                    variables_used=list(set(used_s + used_h + used_t)),
                )

            except Exception as e:
                logger.error("Error ใน _generate_with_hint: %s", e)
                return self._get_placeholder_draft(lead_data, language)

    def _get_placeholder_draft(self, lead_data: dict[str, Any], language: str) -> EmailDraft:
        """Return placeholder email draft เมื่อไม่มี API key"""
        variables = _build_variables(lead_data)
        subject = _PLACEHOLDER_SUBJECT_TH if language == "th" else _PLACEHOLDER_SUBJECT_EN
        body_html = _PLACEHOLDER_BODY_TH if language == "th" else _PLACEHOLDER_BODY_EN
        body_text = re.sub(r'<[^>]+>', '', body_html)  # strip HTML tags

        subject, _ = _replace_variables(subject, variables)
        body_html, used_h = _replace_variables(body_html, variables)
        body_text, used_t = _replace_variables(body_text, variables)

        return EmailDraft(
            subject=subject,
            body_html=body_html,
            body_text=body_text.strip(),
            variables_used=list(set(used_h + used_t)),
        )

    def _get_placeholder_subjects(self, language: str, count: int) -> list[str]:
        """Return placeholder subject lines"""
        if language == "th":
            defaults = [
                "เพิ่มลูกค้าใหม่ให้ธุรกิจของคุณ",
                "ช่วยธุรกิจเติบโตได้อย่างไร?",
                "ข้อเสนอพิเศษสำหรับธุรกิจคุณ",
                "เพิ่มยอดขาย 30% ใน 3 เดือน",
            ]
        else:
            defaults = [
                "Grow your business with us",
                "Quick question about your business",
                "Special offer for your business",
                "Increase sales by 30% in 3 months",
            ]
        return defaults[:count]


# Singleton instance
email_writer = EmailWriter()
