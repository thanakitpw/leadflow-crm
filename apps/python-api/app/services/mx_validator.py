"""
MX Record Validator — ตรวจสอบว่า domain รับ email ได้ไหม
ใช้ dnspython + in-memory cache เพื่อไม่ query ซ้ำ
Timeout: 3 วินาที
"""

import logging

import dns.asyncresolver
import dns.exception
import dns.resolver

logger = logging.getLogger(__name__)

# In-memory cache: domain -> has_mx (True/False)
_mx_cache: dict[str, bool] = {}

# DNS resolver timeout (วินาที)
DNS_TIMEOUT = 3.0


async def validate_mx(domain: str) -> bool:
    """
    ตรวจสอบว่า domain มี MX record หรือไม่

    Args:
        domain: ชื่อ domain เช่น "example.com" (ไม่ต้องมี @ หรือ schema)

    Returns:
        True ถ้ามี MX record (หรือ A record fallback), False ถ้าไม่มีหรือ error
    """
    # ทำความสะอาด domain
    domain = domain.strip().lower()
    if domain.startswith("@"):
        domain = domain[1:]

    if not domain or "." not in domain:
        return False

    # เช็ค cache ก่อน
    if domain in _mx_cache:
        logger.debug(f"MX cache hit for {domain}: {_mx_cache[domain]}")
        return _mx_cache[domain]

    try:
        resolver = dns.asyncresolver.Resolver()
        resolver.lifetime = DNS_TIMEOUT

        answers = await resolver.resolve(domain, "MX")
        has_mx = len(answers) > 0
        _mx_cache[domain] = has_mx
        logger.debug(
            f"MX lookup for {domain}: {'found' if has_mx else 'not found'} "
            f"({len(answers)} records)"
        )
        return has_mx

    except dns.resolver.NXDOMAIN:
        logger.debug(f"Domain does not exist: {domain}")
        _mx_cache[domain] = False
        return False

    except dns.resolver.NoAnswer:
        # ไม่มี MX record แต่ domain มีอยู่จริง — ลอง A record fallback
        logger.debug(f"No MX record for {domain}, checking A record fallback")
        try:
            resolver = dns.asyncresolver.Resolver()
            resolver.lifetime = DNS_TIMEOUT
            await resolver.resolve(domain, "A")
            # มี A record — domain ยังรับ email ได้ผ่าน A record
            _mx_cache[domain] = True
            return True
        except Exception:
            _mx_cache[domain] = False
            return False

    except dns.exception.Timeout:
        logger.warning(f"DNS timeout for {domain} (>{DNS_TIMEOUT}s)")
        # ถ้า timeout ไม่ cache เพื่อให้ลองใหม่ครั้งหน้า
        return False

    except Exception as e:
        logger.warning(f"MX validation error for {domain}: {e}")
        _mx_cache[domain] = False
        return False


async def validate_email_domain(email: str) -> bool:
    """
    ตรวจสอบ domain ของ email address

    Args:
        email: email address เช่น "info@example.com"

    Returns:
        True ถ้า domain รับ email ได้
    """
    domain = get_domain_from_email(email)
    if not domain:
        return False
    return await validate_mx(domain)


def get_domain_from_email(email: str) -> str:
    """แยก domain ออกจาก email address"""
    if "@" in email:
        return email.split("@", 1)[1].strip().lower()
    return email.strip().lower()


def clear_mx_cache() -> None:
    """ล้าง in-memory cache (สำหรับ testing)"""
    _mx_cache.clear()
    logger.debug("MX cache cleared")
