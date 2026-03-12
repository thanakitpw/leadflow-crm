"""
Lead Scoring Service — ใช้ Claude วิเคราะห์คุณภาพ lead และให้คะแนน 0-100
รองรับ single scoring และ batch scoring (max 10 leads ต่อ batch)
ใช้ asyncio.Semaphore(5) จำกัด concurrent Claude calls
"""

import asyncio
import json
import logging
from typing import Any

import anthropic

from app.core.config import settings

logger = logging.getLogger(__name__)

# จำกัด concurrent Claude calls ไม่เกิน 5 พร้อมกัน
_claude_semaphore = asyncio.Semaphore(5)

# Fallback score เมื่อไม่มี API key
DEFAULT_SCORE_NO_KEY = 50
DEFAULT_REASONING_NO_KEY = "ไม่มี API key สำหรับ AI scoring"


def _build_scoring_prompt(lead_data: dict[str, Any]) -> str:
    """สร้าง prompt สำหรับ Claude lead scoring"""
    business_name = lead_data.get("business_name") or lead_data.get("name", "ไม่ระบุ")
    website = lead_data.get("website", "")
    email = lead_data.get("email", "")
    phone = lead_data.get("phone", "")
    rating = lead_data.get("rating")
    # รองรับทั้ง review_count และ reviews_count
    review_count = lead_data.get("review_count") or lead_data.get("reviews_count", 0)
    category = lead_data.get("category", "")
    address = lead_data.get("address", "")

    lead_info = f"""ข้อมูล Lead:
- ชื่อธุรกิจ: {business_name}
- Website: {website if website else "ไม่มี"}
- Email: {email if email else "ไม่มี"}
- เบอร์โทร: {phone if phone else "ไม่มี"}
- Google Rating: {rating if rating is not None else "ไม่มีข้อมูล"}/5
- จำนวน Reviews: {review_count if review_count else 0}
- ประเภทธุรกิจ: {category if category else "ไม่ระบุ"}
- ที่อยู่: {address if address else "ไม่ระบุ"}"""

    scoring_criteria = """เกณฑ์การให้คะแนน (รวม 100 คะแนน):
- มี Website: +15 คะแนน
- มี Email: +10 คะแนน
- Google Rating 4.5+: +20 คะแนน | 4.0-4.4: +15 คะแนน | 3.5-3.9: +10 คะแนน | ต่ำกว่า 3.5: +5 คะแนน
- Reviews มากกว่า 100: +15 คะแนน | 50-100: +10 คะแนน | 10-49: +7 คะแนน | น้อยกว่า 10: +3 คะแนน
- ประเภทธุรกิจเป็น F&B/SME/อสังหาฯ/B2B/Retail: +10 คะแนน
- มีเบอร์โทร: +5 คะแนน
- มีที่อยู่ชัดเจน (กรุงเทพ/ปริมณฑล): +5 คะแนน
- ความน่าสนใจโดยรวม (ดุลยพินิจ AI): +20 คะแนน"""

    return f"""{lead_info}

{scoring_criteria}

วิเคราะห์ lead นี้และให้คะแนนตามเกณฑ์ข้างต้น

ตอบในรูปแบบ JSON เท่านั้น ห้ามมีข้อความอื่น:
{{
  "score": <0-100>,
  "reasoning": "<อธิบายเหตุผลภาษาไทย 1-2 ประโยค บอกจุดเด่นและจุดด้อยของ lead นี้>"
}}"""


def _build_batch_scoring_prompt(leads: list[dict[str, Any]]) -> str:
    """
    สร้าง prompt สำหรับ batch scoring — ส่ง leads ทั้งหมดใน 1 API call

    Args:
        leads: list ของ lead_data dicts (max 10)

    Returns:
        prompt string สำหรับส่งให้ Claude
    """
    leads_text = ""
    for i, lead in enumerate(leads):
        business_name = lead.get("business_name") or lead.get("name", "ไม่ระบุ")
        website = lead.get("website", "")
        email = lead.get("email", "")
        phone = lead.get("phone", "")
        rating = lead.get("rating")
        review_count = lead.get("review_count") or lead.get("reviews_count", 0)
        category = lead.get("category", "")
        address = lead.get("address", "")
        lead_id = lead.get("id", str(i))

        leads_text += f"""
Lead #{i} (id: {lead_id}):
- ชื่อ: {business_name}
- Website: {website or "ไม่มี"}
- Email: {email or "ไม่มี"}
- โทร: {phone or "ไม่มี"}
- Rating: {rating if rating is not None else "N/A"}/5
- Reviews: {review_count or 0}
- ประเภท: {category or "ไม่ระบุ"}
- ที่อยู่: {address or "ไม่ระบุ"}
"""

    return f"""ให้คะแนน leads ต่อไปนี้ (0-100 คะแนน)

เกณฑ์การให้คะแนน:
- มี Website: +15 | มี Email: +10 | มีโทร: +5
- Rating 4.5+: +20 | 4.0-4.4: +15 | 3.5-3.9: +10 | ต่ำกว่า: +5
- Reviews 100+: +15 | 50-100: +10 | 10-49: +7 | น้อยกว่า 10: +3
- ประเภทธุรกิจ F&B/SME/B2B: +10
- ที่อยู่ชัดเจน: +5 | ความน่าสนใจโดยรวม: +20

{leads_text}

ตอบในรูปแบบ JSON array เท่านั้น ห้ามมีข้อความอื่น:
[
  {{"lead_index": 0, "score": <0-100>, "reasoning": "<1-2 ประโยคภาษาไทย>"}},
  ...
]"""


async def score_lead(lead_data: dict[str, Any]) -> dict[str, Any]:
    """
    ให้คะแนน lead เดียวด้วย Claude

    Args:
        lead_data: dict ที่มี keys: business_name (หรือ name), website?, email?,
                   phone?, rating?, review_count?, category?, address?

    Returns:
        dict: {{ score: int, reasoning: str }}
        ถ้าไม่มี API key → {{ score: 50, reasoning: "ไม่มี API key สำหรับ AI scoring" }}
        ถ้า Claude fail → {{ score: 0, reasoning: "error...", error: True }}
    """
    # Fallback เมื่อไม่มี API key
    if not settings.anthropic_api_key:
        logger.warning("Anthropic API key ไม่ถูกตั้งค่า — ใช้ default score")
        return {
            "score": DEFAULT_SCORE_NO_KEY,
            "reasoning": DEFAULT_REASONING_NO_KEY,
        }

    prompt = _build_scoring_prompt(lead_data)

    async with _claude_semaphore:
        try:
            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text.strip()

            # Parse JSON — รองรับ markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            data = json.loads(response_text)

            score = int(data.get("score", 0))
            score = max(0, min(100, score))  # clamp 0-100
            reasoning = str(data.get("reasoning", "ไม่มีเหตุผล"))

            business_name = lead_data.get("business_name") or lead_data.get("name", "unknown")
            logger.debug(f"Lead scored: {business_name} → {score}/100")

            return {"score": score, "reasoning": reasoning}

        except json.JSONDecodeError as e:
            logger.warning(f"Claude ส่งกลับ JSON ไม่ถูกต้องสำหรับ scoring: {e}")
            return {
                "score": 0,
                "reasoning": f"ไม่สามารถวิเคราะห์ผลลัพธ์จาก AI ได้: {str(e)}",
                "error": True,
            }

        except anthropic.AuthenticationError:
            logger.error("Anthropic API key ไม่ถูกต้อง")
            return {
                "score": 0,
                "reasoning": "ไม่สามารถให้คะแนนได้: API key ไม่ถูกต้อง",
                "error": True,
            }

        except anthropic.RateLimitError:
            logger.warning("Anthropic rate limit exceeded")
            return {
                "score": 0,
                "reasoning": "ไม่สามารถให้คะแนนได้: เกิน rate limit ของ API กรุณาลองใหม่อีกครั้ง",
                "error": True,
            }

        except anthropic.APIError as e:
            logger.error(f"Claude API error ระหว่าง scoring: {e}")
            return {
                "score": 0,
                "reasoning": f"ไม่สามารถให้คะแนนได้: เกิดข้อผิดพลาดจาก API ({str(e)})",
                "error": True,
            }

        except Exception as e:
            logger.error(f"Unexpected error ใน lead scoring: {e}")
            return {
                "score": 0,
                "reasoning": f"ไม่สามารถให้คะแนนได้: เกิดข้อผิดพลาดไม่คาดคิด ({str(e)})",
                "error": True,
            }


async def score_leads_batch(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    ให้คะแนนหลาย leads พร้อมกันใน 1 Claude API call (max 10 leads)

    ส่ง leads ทั้งหมดเป็น context เดียวให้ Claude ตอบกลับเป็น JSON array
    ถ้า batch fail จะ fallback เป็น concurrent individual scoring

    Args:
        leads: list ของ lead_data dicts (max 10 leads)

    Returns:
        list ของ {{ lead_index, score, reasoning }} เรียงตาม index
    """
    if not leads:
        return []

    total = len(leads)
    logger.info(f"Batch scoring {total} leads")

    # Fallback เมื่อไม่มี API key
    if not settings.anthropic_api_key:
        logger.warning("Anthropic API key ไม่ถูกตั้งค่า — ใช้ default scores")
        return [
            {
                "lead_index": i,
                "score": DEFAULT_SCORE_NO_KEY,
                "reasoning": DEFAULT_REASONING_NO_KEY,
            }
            for i in range(total)
        ]

    # ลอง batch scoring ใน 1 API call ก่อน
    try:
        batch_result = await _batch_score_single_call(leads)
        if batch_result is not None:
            logger.info(f"Batch scoring เสร็จสิ้น: {len(batch_result)} results")
            return batch_result
    except Exception as e:
        logger.warning(f"Batch scoring ล้มเหลว — fallback เป็น individual scoring: {e}")

    # Fallback: concurrent individual scoring
    logger.info("ใช้ individual scoring สำหรับแต่ละ lead")

    async def score_with_index(index: int, lead: dict[str, Any]) -> dict[str, Any]:
        result = await score_lead(lead)
        return {
            "lead_index": index,
            "score": result["score"],
            "reasoning": result["reasoning"],
            **({"error": True} if result.get("error") else {}),
        }

    tasks = [score_with_index(i, lead) for i, lead in enumerate(leads)]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    processed: list[dict[str, Any]] = []
    for i, result in enumerate(raw_results):
        if isinstance(result, Exception):
            logger.error(f"Individual scoring error สำหรับ lead {i}: {result}")
            processed.append({
                "lead_index": i,
                "score": 0,
                "reasoning": f"เกิดข้อผิดพลาด: {str(result)}",
                "error": True,
            })
        else:
            processed.append(result)

    return processed


async def _batch_score_single_call(
    leads: list[dict[str, Any]],
) -> list[dict[str, Any]] | None:
    """
    ส่ง leads ทั้งหมดให้ Claude ใน 1 API call

    Returns:
        list of {{ lead_index, score, reasoning }} หรือ None ถ้า fail
    """
    prompt = _build_batch_scoring_prompt(leads)

    async with _claude_semaphore:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text.strip()

        # Parse JSON array — รองรับ markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        data = json.loads(response_text)

        if not isinstance(data, list):
            logger.warning("Claude ไม่ส่ง JSON array กลับมาสำหรับ batch scoring")
            return None

        results: list[dict[str, Any]] = []
        for item in data:
            lead_index = int(item.get("lead_index", 0))
            score = int(item.get("score", 0))
            score = max(0, min(100, score))
            reasoning = str(item.get("reasoning", "ไม่มีเหตุผล"))
            results.append({
                "lead_index": lead_index,
                "score": score,
                "reasoning": reasoning,
            })

        # เรียงตาม lead_index
        results.sort(key=lambda x: x["lead_index"])
        return results
