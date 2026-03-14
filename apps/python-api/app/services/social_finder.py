"""
Social Media Finder Service — ค้นหา Facebook Page และ LINE OA จากเว็บไซต์ธุรกิจ

Flow:
1. ใช้ scraper.py scrape หน้า homepage, /contact, /about ฯลฯ
2. Parse HTML ด้วย BeautifulSoup
3. หา Facebook Page จาก anchor links
4. หา LINE OA จาก anchor links, text patterns, และ QR code images

Confidence Scores:
- Direct link (anchor href) = 90
- Text pattern ใกล้ context (LINE/Facebook keyword) = 70
- Text pattern ห่างจาก context = 50
- QR code image = 50
"""

import logging
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse, urljoin

from bs4 import BeautifulSoup, Tag

from app.services.scraper import scrape_pages

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Facebook — patterns ที่ใช้หา
# ---------------------------------------------------------------------------

# Domains ที่เป็น Facebook
FACEBOOK_DOMAINS = {"facebook.com", "fb.com", "fb.me", "www.facebook.com", "m.facebook.com"}

# Paths ที่ต้อง ignore — เป็น generic share/dialog links ไม่ใช่ page
FACEBOOK_IGNORE_PATHS = {
    "/sharer",
    "/sharer.php",
    "/share",
    "/dialog",
    "/dialog/",
    "/login",
    "/login.php",
    "/plugins",
    "/photo",
    "/photo.php",
    "/groups",
    "/events",
    "/marketplace",
    "/watch",
    "/gaming",
    "/ads",
    "/business",
}

# regex สำหรับ match Facebook username/page ID
# username ต้องขึ้นต้นด้วย letter/number ไม่มี dot หรือ underscore ตรงกลาง
FACEBOOK_USERNAME_RE = re.compile(
    r"^/([a-zA-Z0-9][a-zA-Z0-9.\-]*[a-zA-Z0-9]|[a-zA-Z0-9]{1,2})/?(\?.*)?$"
)

# ---------------------------------------------------------------------------
# LINE — patterns ที่ใช้หา
# ---------------------------------------------------------------------------

# URL schemes สำหรับ LINE OA
LINE_URL_PATTERNS = [
    r"line\.me/R/ti/p/(@[a-zA-Z0-9._-]+)",       # line.me/R/ti/p/@handle
    r"line\.me/ti/p/(@[a-zA-Z0-9._-]+)",           # line.me/ti/p/@handle
    r"line\.me/R/home/public/main\?id=([a-zA-Z0-9._-]+)",  # line.me public
    r"page\.line\.me/([a-zA-Z0-9._-]+)",           # page.line.me/pagename
    r"lin\.ee/([a-zA-Z0-9._-]+)",                  # lin.ee short link
    r"line://ti/p/(@[a-zA-Z0-9._-]+)",             # line:// protocol
]

# regex pattern สำหรับ match LINE handle ใน text
# LINE ID/OA มักจะเป็น @xxxxxx
LINE_HANDLE_RE = re.compile(
    r"@([a-zA-Z0-9][a-zA-Z0-9._-]{1,30})",
    re.IGNORECASE,
)

# Keywords ที่บ่งชี้ว่า context นั้นเกี่ยวข้องกับ LINE
LINE_CONTEXT_KEYWORDS = [
    "line", "ไลน์", "line oa", "line official", "line id",
    "line@", "add line", "เพิ่มเพื่อน", "add friend",
    "แอดไลน์", "ไลน์ oa", "ไลน์ออฟฟิเชียล",
]


# ---------------------------------------------------------------------------
# Dataclasses สำหรับ internal use
# ---------------------------------------------------------------------------


@dataclass
class SocialLinkResult:
    platform: str
    url: str | None
    handle: str | None
    source: str
    confidence: float


@dataclass
class SocialMediaResult:
    website: str
    facebook: SocialLinkResult | None = None
    line: SocialLinkResult | None = None
    pages_scraped: int = 0


# ---------------------------------------------------------------------------
# Facebook finder helpers
# ---------------------------------------------------------------------------


def _normalize_facebook_url(href: str) -> tuple[str, str] | None:
    """
    Parse Facebook URL และ return (cleaned_url, page_handle)
    คืน None ถ้าเป็น generic/ignored link

    Args:
        href: raw href จาก anchor tag

    Returns:
        (url, handle) หรือ None
    """
    try:
        parsed = urlparse(href)

        # ต้องเป็น domain ของ Facebook
        netloc = parsed.netloc.lower().lstrip("www.").lstrip("m.")
        base_netloc = parsed.netloc.lower()
        is_fb = (
            base_netloc in FACEBOOK_DOMAINS
            or base_netloc.endswith(".facebook.com")
            or base_netloc in {"fb.com", "fb.me"}
        )

        if not is_fb:
            return None

        path = parsed.path.rstrip("/")
        if not path or path == "":
            path = "/"

        # ตรวจ ignore paths
        for ignore in FACEBOOK_IGNORE_PATHS:
            if path == ignore or path.startswith(ignore + "/") or path.startswith(ignore + "?"):
                return None

        # ตรวจ path pattern — ต้องเป็น /username หรือ /profile.php?id=...
        if path.startswith("/profile.php"):
            # /profile.php?id=123456 — เป็น personal profile ไม่ใช่ page
            return None

        # path ต้องมีแค่ 1 segment (เช่น /restaurantbkk ไม่ใช่ /restaurantbkk/posts)
        path_parts = [p for p in path.split("/") if p]
        if len(path_parts) > 1:
            # ยกเว้น /pages/name/id pattern
            if path_parts[0] != "pages":
                return None

        if not path_parts:
            return None

        handle = path_parts[0] if path_parts[0] != "pages" else (
            path_parts[2] if len(path_parts) >= 3 else path_parts[-1]
        )

        # ตรวจ handle ด้วย regex
        match = FACEBOOK_USERNAME_RE.match("/" + handle)
        if not match:
            return None

        # สร้าง cleaned URL
        cleaned_url = f"https://facebook.com/{handle}"
        return cleaned_url, handle

    except Exception as e:
        logger.debug(f"Facebook URL parse error for {href!r}: {e}")
        return None


def _extract_facebook_from_html(soup: BeautifulSoup) -> SocialLinkResult | None:
    """
    ค้นหา Facebook Page link จาก BeautifulSoup object

    Args:
        soup: parsed HTML

    Returns:
        SocialLinkResult หรือ None
    """
    best: tuple[str, str, float] | None = None  # (url, handle, confidence)

    # 1. ค้นหา anchor tags ที่มี href ของ Facebook
    for a_tag in soup.find_all("a", href=True):
        href = str(a_tag.get("href", "")).strip()
        if not href:
            continue

        result = _normalize_facebook_url(href)
        if result:
            url, handle = result
            confidence = 90.0

            # เลือก result ที่ confidence สูงสุด (ถ้ามีหลาย link เลือกอันแรก)
            if best is None or confidence > best[2]:
                best = (url, handle, confidence)

    if best:
        url, handle, confidence = best
        return SocialLinkResult(
            platform="facebook",
            url=url,
            handle=handle,
            source="link",
            confidence=confidence,
        )

    return None


# ---------------------------------------------------------------------------
# LINE finder helpers
# ---------------------------------------------------------------------------


def _extract_line_from_url(href: str) -> tuple[str, str] | None:
    """
    Parse LINE URL/URI และ return (cleaned_url, handle)
    คืน None ถ้าไม่ใช่ LINE link

    Args:
        href: raw href

    Returns:
        (url, handle) หรือ None
    """
    href_lower = href.lower()

    # ตรวจว่าเป็น LINE URL ก่อน
    is_line = any(
        domain in href_lower
        for domain in ["line.me", "lin.ee", "page.line.me", "line://"]
    )
    if not is_line:
        return None

    for pattern in LINE_URL_PATTERNS:
        match = re.search(pattern, href, re.IGNORECASE)
        if match:
            handle = match.group(1)
            # Normalize — ตัด @ prefix ถ้ามี แล้วเพิ่มกลับ
            clean_handle = handle.lstrip("@")

            # สร้าง canonical URL
            if handle.startswith("@"):
                url = f"https://line.me/R/ti/p/{handle}"
            elif "lin.ee" in href_lower:
                url = f"https://lin.ee/{clean_handle}"
            elif "page.line.me" in href_lower:
                url = f"https://page.line.me/{clean_handle}"
            else:
                url = f"https://line.me/R/ti/p/@{clean_handle}"

            return url, f"@{clean_handle}"

    return None


def _is_near_line_context(element: Tag, soup: BeautifulSoup, window: int = 200) -> bool:
    """
    ตรวจว่า element นั้นอยู่ใกล้ LINE-related keywords หรือไม่

    Args:
        element: BS4 element ที่กำลังตรวจ
        soup: full page soup (ไม่ได้ใช้แต่เก็บไว้เผื่อ)
        window: จำนวน characters รอบๆ ที่จะตรวจ

    Returns:
        True ถ้าอยู่ใกล้ LINE context
    """
    # หา parent ที่ใหญ่พอ — ตรวจ text ใน container
    parent = element.parent
    for _ in range(4):
        if parent is None:
            break
        parent_text = parent.get_text(separator=" ", strip=True).lower()
        for keyword in LINE_CONTEXT_KEYWORDS:
            if keyword in parent_text:
                return True
        parent = parent.parent if parent else None

    return False


def _extract_line_from_html(soup: BeautifulSoup) -> SocialLinkResult | None:
    """
    ค้นหา LINE OA link จาก BeautifulSoup object

    Priority:
    1. Anchor tags ที่มี LINE URL (confidence=90)
    2. Text ที่มี @handle ใกล้ LINE keyword (confidence=70)
    3. QR code images ที่มี alt/title ว่า "line" (confidence=50)

    Returns:
        SocialLinkResult หรือ None (เลือก confidence สูงสุด)
    """
    candidates: list[SocialLinkResult] = []

    # ---- 1. Anchor tags ----
    for a_tag in soup.find_all("a", href=True):
        href = str(a_tag.get("href", "")).strip()
        if not href:
            continue

        result = _extract_line_from_url(href)
        if result:
            url, handle = result
            candidates.append(SocialLinkResult(
                platform="line",
                url=url,
                handle=handle,
                source="link",
                confidence=90.0,
            ))

    # ---- 2. Text patterns ----
    # ดูใน text ทั้งหมด หา @handle ที่อยู่ใกล้ LINE keyword
    full_text = soup.get_text(separator=" ", strip=True)

    # หา LINE URL ใน raw text (บางเว็บ paste URL ใน text ไม่ใช่ link)
    for pattern in LINE_URL_PATTERNS:
        for match in re.finditer(pattern, full_text, re.IGNORECASE):
            handle = match.group(1)
            clean_handle = handle.lstrip("@")
            url = f"https://line.me/R/ti/p/@{clean_handle}"
            candidates.append(SocialLinkResult(
                platform="line",
                url=url,
                handle=f"@{clean_handle}",
                source="text",
                confidence=70.0,
            ))

    # หา @handle ใน text ที่อยู่ใกล้ LINE keyword
    full_text_lower = full_text.lower()
    has_line_context = any(kw in full_text_lower for kw in LINE_CONTEXT_KEYWORDS)

    if has_line_context:
        for match in LINE_HANDLE_RE.finditer(full_text):
            handle = match.group(1)
            # กรอง handle ที่สั้นเกินไปหรืออาจเป็น email
            if len(handle) < 3:
                continue
            # ตรวจว่า handle นี้อยู่ในบริบท LINE หรือเปล่า
            start = max(0, match.start() - 150)
            end = min(len(full_text), match.end() + 150)
            surrounding = full_text[start:end].lower()
            if any(kw in surrounding for kw in LINE_CONTEXT_KEYWORDS):
                url = f"https://line.me/R/ti/p/@{handle}"
                candidates.append(SocialLinkResult(
                    platform="line",
                    url=url,
                    handle=f"@{handle}",
                    source="text",
                    confidence=70.0,
                ))

    # ---- 3. QR code images ----
    for img in soup.find_all("img"):
        alt = str(img.get("alt", "")).lower()
        title = str(img.get("title", "")).lower()
        src = str(img.get("src", "")).lower()

        is_line_qr = (
            "line" in alt
            or "line" in title
            or "qr" in alt
            or "qr" in title
        ) and ("line" in alt or "line" in title or "line" in src)

        if is_line_qr:
            # ไม่มี URL ที่แน่ชัด — return เฉพาะ indicator
            candidates.append(SocialLinkResult(
                platform="line",
                url=None,
                handle=None,
                source="qrcode",
                confidence=50.0,
            ))

    if not candidates:
        return None

    # เลือก candidate ที่ confidence สูงสุด และมี url (ถ้าทำได้)
    candidates.sort(key=lambda c: (c.confidence, 1 if c.url else 0), reverse=True)
    return candidates[0]


# ---------------------------------------------------------------------------
# Main function
# ---------------------------------------------------------------------------


async def find_social_media(website: str) -> SocialMediaResult:
    """
    ค้นหา Facebook Page และ LINE OA จากเว็บไซต์

    ใช้ scraper.py (พร้อม 24-hour cache, robots.txt, Playwright fallback)
    scrape หน้าหลักและหน้าที่เกี่ยวข้อง แล้ว parse ด้วย BeautifulSoup

    Args:
        website: URL ของเว็บไซต์ เช่น "https://example.co.th"

    Returns:
        SocialMediaResult ที่มี facebook และ line (อาจเป็น None ถ้าไม่พบ)

    Raises:
        ไม่ raise exceptions — error ทุกชนิดถูก catch และ return None สำหรับ platform นั้น
    """
    # Normalize URL
    if not website.startswith(("http://", "https://")):
        website = "https://" + website

    result = SocialMediaResult(website=website)

    try:
        # Scrape pages (reuse scraper.py — มี cache + rate limiting + Playwright fallback)
        scraped_pages = await scrape_pages(website)
        result.pages_scraped = len(scraped_pages)

        if not scraped_pages:
            logger.warning(f"Social finder: ไม่สามารถ scrape ได้เลยสำหรับ {website}")
            return result

        # รวม BeautifulSoup objects จากทุกหน้าที่ scrape ได้
        # จะ search จากหน้า homepage ก่อน แล้วค่อย /contact, /about ฯลฯ
        # เพื่อให้ page ที่มักมี social links ถูก prioritize

        # เรียงหน้า: homepage ก่อน
        def _page_priority(page_url: str) -> int:
            path = urlparse(page_url).path.rstrip("/")
            if not path or path == "":
                return 0  # homepage — สูงสุด
            if "/contact" in path:
                return 1
            if "/about" in path:
                return 2
            return 3

        sorted_pages = sorted(scraped_pages.items(), key=lambda kv: _page_priority(kv[0]))

        # ค้นหา Facebook และ LINE จากทุกหน้า — หยุดเมื่อพบทั้งคู่แล้ว
        for page_url, page_data in sorted_pages:
            html = page_data.get("html", "")
            if not html:
                continue

            try:
                soup = BeautifulSoup(html, "html.parser")
            except Exception as e:
                logger.debug(f"BeautifulSoup parse error for {page_url}: {e}")
                continue

            # ค้นหา Facebook ถ้ายังไม่พบ
            if result.facebook is None:
                try:
                    fb = _extract_facebook_from_html(soup)
                    if fb:
                        result.facebook = fb
                        logger.info(
                            f"Social finder: พบ Facebook {fb.handle!r} "
                            f"(confidence={fb.confidence}) จาก {page_url}"
                        )
                except Exception as e:
                    logger.warning(f"Facebook extraction error for {page_url}: {e}")

            # ค้นหา LINE ถ้ายังไม่พบ
            if result.line is None:
                try:
                    line = _extract_line_from_html(soup)
                    if line:
                        result.line = line
                        logger.info(
                            f"Social finder: พบ LINE {line.handle!r} "
                            f"(confidence={line.confidence}) จาก {page_url}"
                        )
                except Exception as e:
                    logger.warning(f"LINE extraction error for {page_url}: {e}")

            # หยุดเมื่อพบทั้ง Facebook และ LINE แล้ว
            if result.facebook is not None and result.line is not None:
                logger.debug(f"Social finder: พบครบทั้ง FB + LINE สำหรับ {website} — หยุด scrape")
                break

    except Exception as e:
        logger.error(f"Social finder: unexpected error สำหรับ {website}: {e}")
        # ไม่ raise — return partial result แทน

    return result
