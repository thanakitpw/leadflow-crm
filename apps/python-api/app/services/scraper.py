"""
Web Scraper Service — scrape homepage, /contact, /about, /team, /เกี่ยวกับเรา
Rate limit: max 2 requests/second per domain
Timeout: 10 seconds per page
Respects robots.txt
24-hour domain scrape cache: ไม่ scrape domain เดิมซ้ำใน 24 ชั่วโมง
Playwright fallback: สำหรับ JS-heavy / SPA websites
"""

import asyncio
import logging
import time
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 24-hour domain cache (in-memory)
# ---------------------------------------------------------------------------
# โครงสร้าง: { domain: { "timestamp": float, "results": dict } }
_domain_scrape_cache: dict[str, dict] = {}

# TTL: 24 ชั่วโมง (วินาที)
DOMAIN_CACHE_TTL = 24 * 60 * 60

# ---------------------------------------------------------------------------
# Rate limiting: max 2 concurrent requests per domain (จะ sleep 0.5s ระหว่างกัน)
# ---------------------------------------------------------------------------
_domain_semaphores: dict[str, asyncio.Semaphore] = {}

# ---------------------------------------------------------------------------
# SPA / JS-heavy site indicators
# ---------------------------------------------------------------------------
SPA_INDICATORS = [
    '<div id="root"></div>',
    '<div id="app"></div>',
    '<div id="root" ',
    '<div id="app" ',
    "window.__NEXT_DATA__",
    "window.__nuxt__",
    "__vue__",
]

# ขนาด content ขั้นต่ำ (ตัวอักษร) ที่ถือว่า scrape ได้เนื้อหา
MIN_CONTENT_LENGTH = 500

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "th,en-US;q=0.9,en;q=0.8",
    "Accept-Charset": "utf-8,iso-8859-1;q=0.5",
}

# Timeout ต่อ page (วินาที)
TIMEOUT = 10.0

# หน้าที่จะ scrape — รองรับ Thai paths
PAGES_TO_SCRAPE = [
    "",               # homepage
    "/contact",       # contact page EN
    "/about",         # about page EN
    "/team",          # team page
    "/เกี่ยวกับเรา",  # about page TH
]

# ข้อมูลที่คืนกลับ: dict[url] = { "html": str, "source_path": str }
ScrapedPage = dict[str, str]  # { "html": ..., "source_path": ... }


def _get_domain(url: str) -> str:
    return urlparse(url).netloc


# ---------------------------------------------------------------------------
# 24-hour cache helpers
# ---------------------------------------------------------------------------

def _get_cached_results(domain: str) -> dict | None:
    """
    คืน cached results ถ้า domain ถูก scrape ไปแล้วใน 24 ชั่วโมง

    Returns:
        dict ของ results (เหมือน scrape_pages return) หรือ None ถ้าไม่มี/หมดอายุ
    """
    entry = _domain_scrape_cache.get(domain)
    if entry is None:
        return None

    age = time.time() - entry["timestamp"]
    if age > DOMAIN_CACHE_TTL:
        # หมดอายุแล้ว — ลบออกจาก cache
        del _domain_scrape_cache[domain]
        logger.debug(f"Domain cache expired for {domain} (age={age:.0f}s)")
        return None

    remaining = DOMAIN_CACHE_TTL - age
    logger.info(
        f"Domain cache HIT for {domain} "
        f"(scraped {age/3600:.1f}h ago, expires in {remaining/3600:.1f}h)"
    )
    return entry["results"]


def _set_cached_results(domain: str, results: dict) -> None:
    """บันทึก scrape results ลง in-memory cache พร้อม timestamp ปัจจุบัน"""
    _domain_scrape_cache[domain] = {
        "timestamp": time.time(),
        "results": results,
    }
    logger.debug(f"Domain cache SET for {domain} ({len(results)} pages)")


def get_domain_cache_info(domain: str) -> dict:
    """
    ดูข้อมูล cache ของ domain (สำหรับ debugging / monitoring)

    Returns:
        dict: { "cached": bool, "scraped_at": float | None, "age_hours": float | None }
    """
    entry = _domain_scrape_cache.get(domain)
    if entry is None:
        return {"cached": False, "scraped_at": None, "age_hours": None}

    age = time.time() - entry["timestamp"]
    if age > DOMAIN_CACHE_TTL:
        return {"cached": False, "scraped_at": None, "age_hours": None}

    return {
        "cached": True,
        "scraped_at": entry["timestamp"],
        "age_hours": round(age / 3600, 2),
    }


def _get_domain_semaphore(domain: str) -> asyncio.Semaphore:
    if domain not in _domain_semaphores:
        # อนุญาต max 2 concurrent requests ต่อ domain
        _domain_semaphores[domain] = asyncio.Semaphore(2)
    return _domain_semaphores[domain]


async def _check_robots_txt(client: httpx.AsyncClient, base_url: str) -> set[str]:
    """ตรวจสอบ robots.txt และ return paths ที่ disallowed"""
    disallowed: set[str] = set()
    try:
        robots_url = urljoin(base_url, "/robots.txt")
        response = await client.get(robots_url, timeout=5.0)
        if response.status_code == 200:
            rp = RobotFileParser()
            rp.parse(response.text.splitlines())
            for path in PAGES_TO_SCRAPE:
                # homepage path คือ "/"
                test_path = path if path else "/"
                test_url = urljoin(base_url, test_path)
                if not rp.can_fetch("*", test_url):
                    disallowed.add(path)
                    logger.debug(f"robots.txt disallows: {test_url}")
    except Exception as e:
        logger.debug(f"robots.txt check failed for {base_url}: {e}")
    return disallowed


# ---------------------------------------------------------------------------
# Playwright fallback helpers
# ---------------------------------------------------------------------------

def _needs_playwright(html: str) -> bool:
    """
    ตรวจสอบว่า HTML ที่ได้จาก httpx น่าจะเป็น SPA / JS-heavy site
    ที่ต้องการ Playwright เพื่อ render JavaScript

    Returns:
        True ถ้าควรลอง Playwright
    """
    # เนื้อหาสั้นเกินไป — น่าจะยังไม่ render
    if len(html) < MIN_CONTENT_LENGTH:
        return True

    # มี SPA indicator
    html_lower = html.lower()
    for indicator in SPA_INDICATORS:
        if indicator.lower() in html_lower:
            return True

    # มี <noscript> ที่บอกว่าต้องการ JavaScript
    if "<noscript>" in html_lower and "javascript" in html_lower:
        return True

    return False


async def _scrape_with_playwright(url: str) -> str | None:
    """
    Scrape URL ด้วย Playwright (headless Chromium) สำหรับ JS-heavy / SPA sites

    Args:
        url: URL ที่จะ scrape

    Returns:
        HTML string หลัง JavaScript render เสร็จ หรือ None ถ้าไม่สำเร็จ
    """
    try:
        from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
    except ImportError:
        logger.warning(
            "Playwright ไม่ได้ติดตั้ง — ข้าม Playwright fallback "
            "(ติดตั้งด้วย: pip install playwright && playwright install chromium)"
        )
        return None

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            try:
                await page.goto(
                    url,
                    timeout=TIMEOUT * 1000,  # Playwright ใช้ milliseconds
                    wait_until="networkidle",
                )
                html = await page.content()
                logger.info(f"Playwright scraped {url} ({len(html)} chars)")
                return html

            except PlaywrightTimeout:
                logger.warning(f"Playwright timeout scraping {url} (>{TIMEOUT}s)")
                return None
            except Exception as e:
                logger.warning(f"Playwright page error for {url}: {e}")
                return None
            finally:
                await context.close()
                await browser.close()

    except Exception as e:
        logger.error(f"Playwright launch error for {url}: {e}")
        return None


async def _fetch_page(
    client: httpx.AsyncClient,
    url: str,
    domain: str,
    source_path: str,
) -> tuple[str, str | None]:
    """
    Fetch หน้าเดียวพร้อม rate limiting
    ถ้า httpx ได้ content สั้นหรือเป็น SPA → ลอง Playwright fallback

    Returns:
        tuple ของ (source_path, html_content | None)
    """
    semaphore = _get_domain_semaphore(domain)

    async with semaphore:
        # Rate limit: หน่วงเวลา 0.5s ระหว่าง requests ต่อ domain (max 2 req/sec)
        await asyncio.sleep(0.5)
        try:
            response = await client.get(url, timeout=TIMEOUT, follow_redirects=True)
            if response.status_code == 200:
                # Handle encoding — ลอง detect จาก content-type ก่อน
                content_type = response.headers.get("content-type", "")
                if "charset" not in content_type.lower():
                    # ถ้าไม่ระบุ charset ให้ลอง utf-8 ก่อน แล้ว fallback เป็น tis-620
                    try:
                        html = response.content.decode("utf-8")
                    except UnicodeDecodeError:
                        try:
                            html = response.content.decode("tis-620")
                        except UnicodeDecodeError:
                            html = response.content.decode("utf-8", errors="replace")
                else:
                    html = response.text

                # Playwright fallback: ถ้า content ดูเป็น SPA / JS-heavy
                if _needs_playwright(html):
                    logger.info(
                        f"Detected SPA/JS-heavy content at {url} "
                        f"({len(html)} chars) — trying Playwright fallback"
                    )
                    pw_html = await _scrape_with_playwright(url)
                    if pw_html and len(pw_html) > len(html):
                        logger.info(
                            f"Playwright returned better content for {url} "
                            f"({len(pw_html)} chars vs httpx {len(html)} chars)"
                        )
                        html = pw_html

                return source_path, html
            logger.debug(f"HTTP {response.status_code} for {url}")
            return source_path, None

        except httpx.TimeoutException:
            logger.warning(f"Timeout scraping {url} (>{TIMEOUT}s)")
            return source_path, None
        except httpx.TooManyRedirects:
            logger.warning(f"Too many redirects for {url}")
            return source_path, None
        except httpx.RequestError as e:
            logger.warning(f"Request error for {url}: {e}")
            return source_path, None


async def scrape_pages(
    website_url: str,
    force: bool = False,
) -> dict[str, ScrapedPage]:
    """
    Scrape homepage + /contact + /about + /team + /เกี่ยวกับเรา

    รองรับ 24-hour domain cache — ถ้า domain นี้ถูก scrape ไปแล้วใน 24 ชั่วโมง
    จะ return cached results ทันที (ไม่ส่ง request ใหม่)

    Respects robots.txt — ไม่ scrape paths ที่ถูก disallow

    Args:
        website_url: URL ของเว็บไซต์ เช่น "https://example.com"
        force: ถ้า True จะ bypass 24-hour cache และ scrape ใหม่เสมอ

    Returns:
        dict ของ { page_url: { "html": html_content, "source_path": path } }
        จะมีแค่ URL ที่ scrape สำเร็จ
    """
    # Normalize URL
    if not website_url.startswith(("http://", "https://")):
        website_url = "https://" + website_url

    # ตัด trailing slash
    website_url = website_url.rstrip("/")
    domain = _get_domain(website_url)

    # ตรวจสอบ 24-hour cache ก่อน (เว้นแต่ force=True)
    if not force:
        cached = _get_cached_results(domain)
        if cached is not None:
            return cached

    results: dict[str, ScrapedPage] = {}

    async with httpx.AsyncClient(headers=HEADERS, verify=False) as client:
        # ตรวจสอบ robots.txt ก่อน
        disallowed_paths = await _check_robots_txt(client, website_url)
        if disallowed_paths:
            logger.info(f"robots.txt disallows {disallowed_paths} for {domain}")

        # สร้าง tasks สำหรับแต่ละหน้า
        tasks = []
        fetch_meta: list[tuple[str, str]] = []  # (page_url, source_path)

        for path in PAGES_TO_SCRAPE:
            if path in disallowed_paths:
                logger.info(f"Skipping {path!r} — disallowed by robots.txt")
                continue

            if path == "":
                page_url = website_url
            else:
                page_url = urljoin(website_url + "/", path.lstrip("/"))

            fetch_meta.append((page_url, path or "/"))
            tasks.append(_fetch_page(client, page_url, domain, path or "/"))

        # ดึงทุกหน้าพร้อมกัน (semaphore จะ limit rate)
        fetch_results = await asyncio.gather(*tasks, return_exceptions=True)

        success_count = 0
        for (page_url, source_path), fetch_result in zip(fetch_meta, fetch_results):
            if isinstance(fetch_result, Exception):
                logger.warning(f"Failed to scrape {page_url}: {fetch_result}")
                continue

            _path, html = fetch_result
            if html is not None:
                results[page_url] = {
                    "html": html,
                    "source_path": source_path,
                }
                success_count += 1

    logger.info(
        f"Scraped {success_count}/{len(PAGES_TO_SCRAPE)} pages for {domain}"
    )

    # บันทึกลง 24-hour cache (แม้ว่าจะได้ 0 หน้าก็ตาม — เพื่อป้องกัน flood)
    _set_cached_results(domain, results)

    return results
