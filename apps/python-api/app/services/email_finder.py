"""
AI Email Finder Service
Flow: Scrape → Regex/mailto → Claude Extract → Pattern Guess → MX Validation
Confidence: mailto=95, scraped=90, regex=80, claude=75, pattern=50
"""

import asyncio
import json
import logging
import re
from urllib.parse import urlparse

import anthropic
from bs4 import BeautifulSoup

from app.core.config import settings
from app.services.mx_validator import get_domain_from_email, validate_mx
from app.services.scraper import scrape_pages

logger = logging.getLogger(__name__)

# Regex pattern สำหรับ email — รองรับ Thai domains (.co.th, .or.th, .ac.th ฯลฯ)
EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?",
)

# mailto: link pattern
MAILTO_REGEX = re.compile(r'href=["\']mailto:([^"\'?\s]+)', re.IGNORECASE)

# Common email prefixes สำหรับ pattern guess
COMMON_PREFIXES = [
    "info",
    "contact",
    "hello",
    "sales",
    "admin",
    "support",
    "team",
    "office",
]

# Confidence scores (0-100)
CONFIDENCE = {
    "mailto": 95,   # mailto: link ใน HTML — แน่นอนที่สุด
    "scraped": 90,  # หาจาก HTML โดยตรง (ไม่ใช่ mailto:)
    "regex": 80,    # regex จาก text content
    "claude": 75,   # Claude extract
    "pattern": 50,  # pattern guess (info@, contact@ ฯลฯ)
}


class EmailResult:
    """ผลลัพธ์ email ที่หาได้พร้อม confidence score"""

    def __init__(
        self,
        email: str,
        confidence: int,
        source: str,
        source_page: str = "",
    ):
        self.email = email.lower().strip()
        self.confidence = confidence
        self.source = source          # mailto | scraped | regex | claude | pattern
        self.source_page = source_page  # URL ของหน้าที่พบ email

    def to_dict(self) -> dict:
        return {
            "email": self.email,
            "confidence": self.confidence,
            "source": self.source,
            "source_page": self.source_page,
        }


def _extract_domain_from_url(url: str) -> str:
    """แยก domain จาก URL เช่น https://www.example.co.th → example.co.th"""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _is_valid_email_candidate(email: str) -> bool:
    """
    กรอง false positives ออก เช่น:
    - นามสกุลไฟล์ใน local part (image.png@host)
    - domain ที่ไม่มี dot
    - ความยาวเกิน RFC limit
    """
    if "@" not in email:
        return False

    local_part, domain_part = email.rsplit("@", 1)

    # กรอง naamสกุลไฟล์ใน local part
    image_exts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js", ".woff"]
    for ext in image_exts:
        if local_part.endswith(ext):
            return False

    # domain ต้องมี dot
    if "." not in domain_part:
        return False

    # ความยาวสมเหตุสมผล (RFC 5321)
    if len(email) > 254 or len(email) < 6:
        return False

    # local part ต้องไม่ว่างและไม่ยาวเกิน 64 chars
    if not local_part or len(local_part) > 64:
        return False

    return True


def _extract_emails_from_html(
    html: str,
    source_page: str = "",
) -> list[EmailResult]:
    """
    Extract email จาก HTML content ด้วย regex

    Step 1: หา mailto: links (confidence 95)
    Step 2: หา email ใน HTML attributes (confidence 90)
    Step 3: หา email จาก text content ด้วย regex (confidence 80)

    Returns:
        list of EmailResult เรียงตาม confidence สูงสุดก่อน
    """
    results: list[EmailResult] = []
    found_emails: set[str] = set()

    # Step 1: หา mailto: links (confidence สูงสุด)
    mailto_matches = MAILTO_REGEX.findall(html)
    for raw_email in mailto_matches:
        email = raw_email.lower().strip()
        # ตัด query params ถ้ามี เช่น mailto:info@ex.com?subject=...
        email = email.split("?")[0]
        if EMAIL_REGEX.match(email) and _is_valid_email_candidate(email) and email not in found_emails:
            found_emails.add(email)
            results.append(EmailResult(email, CONFIDENCE["mailto"], "mailto", source_page))

    # Parse HTML
    soup = BeautifulSoup(html, "html.parser")

    # Step 2: หา email จาก HTML attributes (data-email, value, content)
    for tag in soup.find_all(attrs={"data-email": True}):
        raw = str(tag.get("data-email", "")).lower().strip()
        if EMAIL_REGEX.match(raw) and _is_valid_email_candidate(raw) and raw not in found_emails:
            found_emails.add(raw)
            results.append(EmailResult(raw, CONFIDENCE["scraped"], "scraped", source_page))

    # Step 3: หา email จาก text content ด้วย regex
    text_content = soup.get_text(separator=" ")
    regex_matches = EMAIL_REGEX.findall(text_content)
    for raw_email in regex_matches:
        email = raw_email.lower().strip()
        if _is_valid_email_candidate(email) and email not in found_emails:
            found_emails.add(email)
            results.append(EmailResult(email, CONFIDENCE["regex"], "regex", source_page))

    return results


async def _claude_extract_emails(
    pages: dict[str, dict[str, str]],
) -> list[EmailResult]:
    """
    ใช้ Claude extract email จาก page content
    สำหรับกรณีที่ regex พลาด เช่น email ที่ถูก obfuscate หรือเขียนเป็นข้อความ

    Args:
        pages: dict จาก scrape_pages() — { url: { "html": ..., "source_path": ... } }

    Returns:
        list of EmailResult (source="claude", confidence=75)
    """
    if not settings.anthropic_api_key:
        logger.warning("Anthropic API key ไม่ถูกตั้งค่า — ข้าม Claude extraction")
        return []

    # รวม text content จากทุกหน้า (จำกัดขนาดเพื่อไม่ให้ prompt ใหญ่เกิน)
    combined_text = ""
    for url, page_data in pages.items():
        html = page_data.get("html", "")
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(separator="\n", strip=True)
        # จำกัด text ต่อหน้าไม่เกิน 3000 ตัวอักษร
        combined_text += f"\n\n--- Page: {url} ---\n{text[:3000]}"

    if not combined_text.strip():
        return []

    prompt = f"""ค้นหา email addresses จาก web page content ด้านล่างนี้
ให้หา email ที่อาจถูก obfuscate หรือซ่อนไว้ เช่น:
- "contact [at] example [dot] com"
- "info (at) company dot co dot th"
- "ติดต่อ: info ที่ example.com"
- email ที่เขียนแยกคำหรือใช้คำแทน @ และ .

Page content:
{combined_text[:8000]}

ตอบในรูปแบบ JSON เท่านั้น ห้ามมีข้อความอื่น:
{{
  "emails": ["email1@example.com", "email2@example.com"]
}}

ถ้าไม่พบ email ให้ตอบ: {{"emails": []}}"""

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text.strip()

        # Parse JSON — รองรับ markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        data = json.loads(response_text)
        emails = data.get("emails", [])

        results = []
        for raw_email in emails:
            email = str(raw_email).lower().strip()
            if EMAIL_REGEX.match(email) and _is_valid_email_candidate(email):
                results.append(EmailResult(email, CONFIDENCE["claude"], "claude"))

        logger.debug(f"Claude extracted {len(results)} emails")
        return results

    except json.JSONDecodeError as e:
        logger.warning(f"Claude ส่งกลับ JSON ไม่ถูกต้องสำหรับ email extraction: {e}")
        return []
    except anthropic.APIError as e:
        logger.error(f"Claude API error ระหว่าง email extraction: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error ใน Claude email extraction: {e}")
        return []


def _generate_pattern_emails(domain: str) -> list[EmailResult]:
    """
    สร้าง email patterns ทั่วไปจาก domain

    Args:
        domain: domain ของเว็บไซต์ เช่น "example.co.th"

    Returns:
        list of EmailResult (source="pattern", confidence=50)
    """
    results = []
    for prefix in COMMON_PREFIXES:
        email = f"{prefix}@{domain}"
        results.append(EmailResult(email, CONFIDENCE["pattern"], "pattern"))
    return results


def _deduplicate_emails(email_results: list[EmailResult]) -> list[EmailResult]:
    """
    Deduplicate emails — ถ้า email เดิมมีหลาย source
    ให้เก็บอันที่มี confidence สูงสุดไว้

    Args:
        email_results: list of EmailResult ที่อาจมี duplicate

    Returns:
        list of EmailResult ที่ไม่มี duplicate เรียงตาม confidence
    """
    best: dict[str, EmailResult] = {}
    for result in email_results:
        email = result.email
        if email not in best or result.confidence > best[email].confidence:
            best[email] = result
    return list(best.values())


async def find_emails(
    website_url: str,
    business_name: str = "",
) -> list[EmailResult]:
    """
    Main function: หา email จาก website URL

    Flow:
    1. Scrape pages (homepage, /contact, /about, /team, /เกี่ยวกับเรา)
    2. Regex scan: mailto: links + HTML attributes + text regex
    3. Claude extract (สำหรับ obfuscated emails)
    4. Pattern guess (info@, contact@, hello@ ฯลฯ)
    5. Deduplicate
    6. MX validation — กรอง domain ที่ไม่รับ email ออก
    7. กรอง confidence < 50 ออก
    8. เรียงตาม confidence (สูงสุดก่อน)

    Args:
        website_url: URL ของเว็บไซต์
        business_name: ชื่อธุรกิจ (optional — สำหรับ context ใน Claude)

    Returns:
        list of EmailResult เรียงตาม confidence (สูงสุดก่อน)
    """
    all_results: list[EmailResult] = []
    domain = _extract_domain_from_url(website_url)

    logger.info(f"เริ่ม email finding สำหรับ {website_url}")

    # Step 1: Scrape pages
    pages = await scrape_pages(website_url)
    pages_count = len(pages)

    if not pages:
        logger.warning(f"ไม่สามารถ scrape หน้าได้สำหรับ {website_url}")
    else:
        # Step 2: Regex extraction จากทุกหน้า
        for page_url, page_data in pages.items():
            html = page_data.get("html", "")
            source_path = page_data.get("source_path", page_url)
            page_results = _extract_emails_from_html(html, source_page=page_url)
            all_results.extend(page_results)
            logger.debug(f"พบ {len(page_results)} emails จาก {page_url}")

        # Step 3: Claude extraction (หา obfuscated emails)
        claude_results = await _claude_extract_emails(pages)
        all_results.extend(claude_results)
        logger.debug(f"Claude พบ {len(claude_results)} emails เพิ่มเติม")

    # Step 4: Pattern guess
    pattern_results = _generate_pattern_emails(domain)
    all_results.extend(pattern_results)
    logger.debug(f"สร้าง {len(pattern_results)} pattern emails สำหรับ {domain}")

    # Deduplicate ก่อน MX validation เพื่อลด DNS queries
    all_results = _deduplicate_emails(all_results)

    # Step 5: MX validation — เช็ค unique domains
    email_domains: set[str] = {get_domain_from_email(r.email) for r in all_results}

    mx_checks = await asyncio.gather(
        *[validate_mx(d) for d in email_domains],
        return_exceptions=True,
    )
    valid_domains: dict[str, bool] = {
        d: (result if isinstance(result, bool) else False)
        for d, result in zip(email_domains, mx_checks)
    }

    # Step 6 & 7: Filter — เอาแค่ email ที่ domain มี MX record และ confidence >= 50
    filtered_results: list[EmailResult] = []
    for result in all_results:
        email_domain = get_domain_from_email(result.email)
        has_mx = valid_domains.get(email_domain, False)

        if not has_mx:
            logger.debug(f"ตัดออก {result.email} — ไม่มี MX record สำหรับ {email_domain}")
            continue

        if result.confidence < 50:
            logger.debug(
                f"ตัดออก {result.email} — confidence ต่ำเกิน ({result.confidence})"
            )
            continue

        filtered_results.append(result)

    # Step 8: เรียงตาม confidence (สูงสุดก่อน)
    filtered_results.sort(key=lambda x: x.confidence, reverse=True)

    logger.info(
        f"Email finding เสร็จสิ้นสำหรับ {website_url}: "
        f"พบ {len(filtered_results)} emails (จาก {len(all_results)} candidates, "
        f"scrape {pages_count} หน้า)"
    )

    return filtered_results
