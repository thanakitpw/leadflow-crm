"""
Domain Manager Service — จัดการ domain settings สำหรับการส่ง email
รองรับ DNS record generation, domain verification และ warmup schedule
ใช้ dnspython สำหรับ DNS lookup
"""

import logging
from datetime import datetime, timezone
from typing import Any

import dns.resolver
import dns.exception

logger = logging.getLogger(__name__)

# Warmup schedule: (max_days, limit_per_day)
_WARMUP_SCHEDULE = [
    (3, 10),    # Day 1-3: 10/day
    (7, 25),    # Day 4-7: 25/day
    (14, 50),   # Day 8-14: 50/day
    (21, 100),  # Day 15-21: 100/day
]

_FULL_LIMIT = 500  # default full limit หลัง warmup


class VerificationResult:
    """ผลการตรวจสอบ DNS records"""

    def __init__(
        self,
        domain: str,
        spf_valid: bool = False,
        dkim_valid: bool = False,
        dmarc_valid: bool = False,
        spf_record: str | None = None,
        dkim_record: str | None = None,
        dmarc_record: str | None = None,
        errors: list[str] | None = None,
    ):
        self.domain = domain
        self.spf_valid = spf_valid
        self.dkim_valid = dkim_valid
        self.dmarc_valid = dmarc_valid
        self.spf_record = spf_record
        self.dkim_record = dkim_record
        self.dmarc_record = dmarc_record
        self.errors = errors or []
        self.all_valid = spf_valid and dkim_valid and dmarc_valid

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "spf_valid": self.spf_valid,
            "dkim_valid": self.dkim_valid,
            "dmarc_valid": self.dmarc_valid,
            "spf_record": self.spf_record,
            "dkim_record": self.dkim_record,
            "dmarc_record": self.dmarc_record,
            "all_valid": self.all_valid,
            "errors": self.errors,
        }


class DomainManager:
    """
    Domain management สำหรับ email sending

    จัดการ DNS records, verification และ warmup schedule
    """

    def generate_dns_records(self, domain: str) -> dict[str, Any]:
        """
        สร้าง DNS records ที่ต้องตั้งค่าสำหรับ domain

        Args:
            domain: domain name เช่น "yourdomain.com"

        Returns:
            dict ที่มี SPF, DKIM (placeholder), DMARC records
            พร้อม instructions สำหรับ DNS provider
        """
        spf_record = f"v=spf1 include:amazonses.com ~all"
        dmarc_record = f"v=DMARC1; p=none; rua=mailto:dmarc@{domain}"

        return {
            "domain": domain,
            "records": {
                "spf": {
                    "type": "TXT",
                    "host": "@",
                    "value": spf_record,
                    "description": "SPF record — อนุญาตให้ Amazon SES ส่ง email ในนาม domain นี้",
                },
                "dkim": {
                    "type": "TXT",
                    "host": f"resend._domainkey.{domain}",
                    "value": "<Resend DKIM key — รับได้จาก Resend Dashboard หลัง add domain>",
                    "description": "DKIM record — ต้องได้รับจาก Resend Dashboard โดยตรง",
                    "note": "เพิ่ม domain ใน Resend Dashboard ก่อน จากนั้น copy DKIM key มาใส่",
                },
                "dmarc": {
                    "type": "TXT",
                    "host": f"_dmarc.{domain}",
                    "value": dmarc_record,
                    "description": "DMARC record — ตั้งค่า policy แบบ monitor (p=none) ระยะแรก",
                },
                "mx": {
                    "type": "MX",
                    "host": "@",
                    "value": "feedback-smtp.us-east-1.amazonses.com",
                    "priority": 10,
                    "description": "MX record สำหรับรับ bounce/complaint notifications จาก SES",
                },
            },
            "setup_instructions": [
                f"1. เพิ่ม domain '{domain}' ใน Resend Dashboard (resend.com)",
                "2. Copy DKIM key จาก Resend Dashboard ไปใส่ใน DNS",
                "3. เพิ่ม SPF, DKIM, DMARC, MX records ใน DNS provider ของคุณ",
                "4. รอ DNS propagation (1-24 ชั่วโมง)",
                "5. กด Verify ใน Resend Dashboard",
                f"6. เริ่มต้น warmup โดยส่ง email ไม่เกิน 10 ฉบับ/วัน",
            ],
        }

    async def verify_domain(self, domain: str) -> VerificationResult:
        """
        ตรวจสอบ DNS records ของ domain

        ใช้ dnspython ตรวจ SPF และ DMARC
        DKIM ตรวจผ่าน Resend API (ใน email_sender.py)

        Args:
            domain: domain name

        Returns:
            VerificationResult ที่มีสถานะของแต่ละ record
        """
        errors: list[str] = []
        spf_valid = False
        dmarc_valid = False
        spf_record = None
        dmarc_record = None
        dkim_record = None

        # ตรวจ SPF — ค้นหา TXT record ที่มี "v=spf1"
        try:
            answers = dns.resolver.resolve(domain, "TXT")
            for rdata in answers:
                txt = "".join(s.decode() if isinstance(s, bytes) else s for s in rdata.strings)
                if txt.startswith("v=spf1"):
                    spf_record = txt
                    # ตรวจว่า include SES หรือ Resend
                    if "amazonses.com" in txt or "resend.com" in txt or "sendgrid.net" in txt:
                        spf_valid = True
                    else:
                        errors.append(f"SPF record พบแต่ไม่มี include สำหรับ email provider: {txt[:100]}")
                    break

            if not spf_record:
                errors.append(f"ไม่พบ SPF record สำหรับ {domain}")

        except dns.resolver.NXDOMAIN:
            errors.append(f"Domain {domain} ไม่พบใน DNS")
        except dns.resolver.NoAnswer:
            errors.append(f"ไม่พบ TXT records สำหรับ {domain}")
        except dns.exception.DNSException as e:
            errors.append(f"DNS lookup error สำหรับ SPF: {str(e)}")
        except Exception as e:
            errors.append(f"Unexpected error ตรวจ SPF: {str(e)}")

        # ตรวจ DMARC — ค้นหา TXT record ที่ _dmarc.{domain}
        try:
            dmarc_domain = f"_dmarc.{domain}"
            answers = dns.resolver.resolve(dmarc_domain, "TXT")
            for rdata in answers:
                txt = "".join(s.decode() if isinstance(s, bytes) else s for s in rdata.strings)
                if txt.startswith("v=DMARC1"):
                    dmarc_record = txt
                    dmarc_valid = True
                    break

            if not dmarc_record:
                errors.append(f"ไม่พบ DMARC record สำหรับ {dmarc_domain}")

        except dns.resolver.NXDOMAIN:
            errors.append(f"ไม่พบ _dmarc.{domain} ใน DNS — กรุณาเพิ่ม DMARC record")
        except dns.resolver.NoAnswer:
            errors.append(f"ไม่พบ TXT records สำหรับ _dmarc.{domain}")
        except dns.exception.DNSException as e:
            errors.append(f"DNS lookup error สำหรับ DMARC: {str(e)}")
        except Exception as e:
            errors.append(f"Unexpected error ตรวจ DMARC: {str(e)}")

        # ตรวจ DKIM selector (resend._domainkey)
        try:
            dkim_domain = f"resend._domainkey.{domain}"
            answers = dns.resolver.resolve(dkim_domain, "TXT")
            for rdata in answers:
                txt = "".join(s.decode() if isinstance(s, bytes) else s for s in rdata.strings)
                if "p=" in txt:  # DKIM public key
                    dkim_record = txt[:50] + "..."
                    break

            if not dkim_record:
                errors.append(f"ไม่พบ DKIM record สำหรับ resend._domainkey.{domain}")

        except dns.resolver.NXDOMAIN:
            errors.append(f"ไม่พบ DKIM record — กรุณาตั้งค่าจาก Resend Dashboard")
        except dns.resolver.NoAnswer:
            errors.append(f"ไม่พบ DKIM TXT record สำหรับ resend._domainkey.{domain}")
        except dns.exception.DNSException as e:
            errors.append(f"DNS lookup error สำหรับ DKIM: {str(e)}")
        except Exception as e:
            logger.debug("DKIM check error (อาจไม่ได้ใช้ Resend): %s", e)

        dkim_valid = dkim_record is not None

        logger.info(
            "Domain verified | domain=%s | spf=%s | dkim=%s | dmarc=%s",
            domain, spf_valid, dkim_valid, dmarc_valid,
        )

        return VerificationResult(
            domain=domain,
            spf_valid=spf_valid,
            dkim_valid=dkim_valid,
            dmarc_valid=dmarc_valid,
            spf_record=spf_record,
            dkim_record=dkim_record,
            dmarc_record=dmarc_record,
            errors=errors,
        )

    def calculate_warmup_limit(self, domain_data: dict[str, Any]) -> int:
        """
        คำนวณ daily send limit ตาม warmup schedule

        Warmup schedule:
        - Day 1-3: 10/day
        - Day 4-7: 25/day
        - Day 8-14: 50/day
        - Day 15-21: 100/day
        - Day 22+: full limit (default 500/day)

        Args:
            domain_data: dict ที่มี:
                - created_at: ISO datetime string ของวันที่เริ่ม warmup
                - daily_limit: full limit หลัง warmup (optional, default 500)
                - warmup_enabled: bool (optional, default True)

        Returns:
            int: จำนวน email สูงสุดที่ส่งได้วันนี้
        """
        full_limit = domain_data.get("daily_limit", _FULL_LIMIT)

        # ถ้าปิด warmup — return full limit
        if not domain_data.get("warmup_enabled", True):
            return full_limit

        created_at_str = domain_data.get("created_at")
        if not created_at_str:
            logger.warning("domain_data ไม่มี created_at — ใช้ limit ต่ำสุด 10")
            return 10

        try:
            # Parse datetime
            if isinstance(created_at_str, datetime):
                created_at = created_at_str
            else:
                # รองรับ ISO format ทั้งแบบ Z และ +00:00
                created_at_str = created_at_str.replace("Z", "+00:00")
                created_at = datetime.fromisoformat(created_at_str)

            # คำนวณจำนวนวันที่ผ่านมา
            now = datetime.now(timezone.utc)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            days_since = (now - created_at).days + 1  # day 1 = วันแรก

            # หา limit จาก warmup schedule
            cumulative_days = 0
            for max_days, limit in _WARMUP_SCHEDULE:
                if days_since <= max_days:
                    logger.debug(
                        "Warmup limit | domain=%s | day=%d | limit=%d",
                        domain_data.get("domain", "unknown"),
                        days_since,
                        limit,
                    )
                    return limit
                cumulative_days = max_days

            # หลัง warmup — return full limit
            logger.debug(
                "Warmup complete | domain=%s | day=%d | limit=%d",
                domain_data.get("domain", "unknown"),
                days_since,
                full_limit,
            )
            return full_limit

        except (ValueError, TypeError) as e:
            logger.error("Error parsing created_at '%s': %s", created_at_str, e)
            return 10  # conservative fallback


# Singleton instance
domain_manager = DomainManager()
