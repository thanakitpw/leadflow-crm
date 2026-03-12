"""
Report Generator Service — สร้าง printable HTML report สำหรับ LeadFlow CRM

แนวทาง: สร้าง HTML ที่มี inline CSS เพื่อให้ browser print ได้โดยตรง
ไม่ต้องพึ่งพา PDF library จึงรองรับภาษาไทยได้เต็มที่
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.schemas.report import SummaryStats, CampaignStat, TopLead

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CSS Styles
# ---------------------------------------------------------------------------

_REPORT_CSS = """
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Noto Sans Thai', 'Sarabun', 'Inter', sans-serif;
    font-size: 14px;
    color: #1C1814;
    background: #fff;
    padding: 40px;
    line-height: 1.6;
  }

  /* Header */
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 24px;
    border-bottom: 2px solid #1E3A5F;
    margin-bottom: 32px;
  }
  .logo-text {
    font-size: 24px;
    font-weight: 800;
    color: #1E3A5F;
    letter-spacing: -0.01em;
  }
  .logo-text span { color: #7C3AED; }
  .header-meta { text-align: right; }
  .header-meta .workspace-name {
    font-size: 18px;
    font-weight: 700;
    color: #1C1814;
  }
  .header-meta .date-range {
    font-size: 13px;
    color: #7A6F68;
    margin-top: 4px;
  }
  .report-title {
    font-size: 13px;
    font-weight: 500;
    color: #7A6F68;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 2px;
  }

  /* Section */
  .section {
    margin-bottom: 36px;
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #7A6F68;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #E5DDD6;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .stat-card {
    background: #F7F5F2;
    border: 1px solid #E5DDD6;
    border-radius: 12px;
    padding: 16px;
  }
  .stat-label {
    font-size: 12px;
    color: #7A6F68;
    margin-bottom: 6px;
  }
  .stat-value {
    font-size: 28px;
    font-weight: 800;
    color: #1E3A5F;
    line-height: 1;
  }
  .stat-sub {
    font-size: 12px;
    color: #7A6F68;
    margin-top: 4px;
  }
  .stat-card.highlight .stat-value { color: #7C3AED; }
  .stat-card.success .stat-value  { color: #16A34A; }
  .stat-card.warning .stat-value  { color: #D97706; }

  /* Table */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .data-table th {
    background: #EEF2F8;
    color: #1E3A5F;
    font-weight: 600;
    text-align: left;
    padding: 10px 12px;
    border-bottom: 2px solid #E5DDD6;
    white-space: nowrap;
  }
  .data-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #EFE9E2;
    color: #1C1814;
    vertical-align: middle;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:hover td { background: #F7F5F2; }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }
  .badge-active   { background: #dcfce7; color: #16A34A; }
  .badge-paused   { background: #fef3c7; color: #D97706; }
  .badge-completed{ background: #EEF2F8; color: #1E3A5F; }
  .badge-draft    { background: #EFE9E2; color: #7A6F68; }

  .score-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
  }
  .score-high { background: #dcfce7; color: #16A34A; }
  .score-mid  { background: #fef3c7; color: #D97706; }
  .score-low  { background: #fee2e2; color: #DC2626; }

  .rate-text { color: #7A6F68; font-size: 12px; }

  /* Empty state */
  .empty-row td {
    text-align: center;
    color: #7A6F68;
    padding: 24px;
    font-style: italic;
  }

  /* Footer */
  .report-footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #E5DDD6;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #7A6F68;
  }

  /* Print styles */
  @media print {
    body { padding: 20px; font-size: 12px; }
    .stats-grid { grid-template-columns: repeat(4, 1fr); }
    .stat-value { font-size: 22px; }
    .section { page-break-inside: avoid; }
    .report-header { page-break-after: avoid; }
  }
"""


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _rate_display(rate: float) -> str:
    """แสดง rate เป็น string เช่น 24.5% หรือ —"""
    if rate is None or rate == 0.0:
        return "—"
    return f"{rate:.1f}%"


def _score_badge(score: int | None) -> str:
    """สร้าง HTML badge สำหรับ lead score"""
    if score is None:
        return '<span class="rate-text">—</span>'
    if score >= 70:
        css_class = "score-high"
    elif score >= 40:
        css_class = "score-mid"
    else:
        css_class = "score-low"
    return f'<span class="score-badge {css_class}">{score}</span>'


def _status_badge(status: str) -> str:
    """สร้าง HTML badge สำหรับ campaign status"""
    status_lower = status.lower()
    badge_map = {
        "active":     "badge-active",
        "paused":     "badge-paused",
        "completed":  "badge-completed",
        "draft":      "badge-draft",
    }
    css_class = badge_map.get(status_lower, "badge-draft")
    label_map = {
        "active":    "Active",
        "paused":    "Paused",
        "completed": "Completed",
        "draft":     "Draft",
    }
    label = label_map.get(status_lower, status.capitalize() or "—")
    return f'<span class="badge {css_class}">{label}</span>'


def _fmt_number(n: int | None) -> str:
    """Format number ด้วย comma separator"""
    if n is None:
        return "—"
    return f"{n:,}"


# ---------------------------------------------------------------------------
# Section renderers
# ---------------------------------------------------------------------------

def _render_stats_section(stats: SummaryStats) -> str:
    """Render Section 1 — Summary Stats cards (2 rows x 4 columns)"""
    cards_row1 = [
        ("Total Leads",      _fmt_number(stats.total_leads),   "stat-card highlight", ""),
        ("New Leads",        _fmt_number(stats.new_leads),     "stat-card", "ในช่วงเวลาที่เลือก"),
        ("Emails Sent",      _fmt_number(stats.emails_sent),   "stat-card", ""),
        ("Active Campaigns", _fmt_number(stats.active_campaigns), "stat-card success", ""),
    ]
    cards_row2 = [
        ("Open Rate",   _rate_display(stats.open_rate),   "stat-card success", ""),
        ("Click Rate",  _rate_display(stats.click_rate),  "stat-card success", ""),
        ("Reply Rate",  _rate_display(stats.reply_rate),  "stat-card highlight", ""),
        ("Bounce Rate", _rate_display(stats.bounce_rate), "stat-card warning", ""),
    ]

    def _card(label: str, value: str, css: str, sub: str) -> str:
        sub_html = f'<div class="stat-sub">{sub}</div>' if sub else ""
        return (
            f'<div class="{css}">'
            f'<div class="stat-label">{label}</div>'
            f'<div class="stat-value">{value}</div>'
            f'{sub_html}'
            f'</div>'
        )

    row1_html = "".join(_card(*c) for c in cards_row1)
    row2_html = "".join(_card(*c) for c in cards_row2)

    return (
        '<div class="section">'
        '<div class="section-title">Summary Statistics</div>'
        f'<div class="stats-grid" style="margin-bottom:16px">{row1_html}</div>'
        f'<div class="stats-grid">{row2_html}</div>'
        '</div>'
    )


def _render_campaigns_section(campaigns: list[CampaignStat]) -> str:
    """Render Section 2 — Campaign Performance table"""

    def _safe_rate(sent: int, count: int) -> str:
        if sent <= 0:
            return "—"
        return f"{(count / sent * 100):.1f}%"

    if not campaigns:
        rows_html = (
            '<tr class="empty-row">'
            '<td colspan="7">No campaign data available</td>'
            '</tr>'
        )
    else:
        rows = []
        for c in campaigns:
            open_rate  = _safe_rate(c.sent, c.opened)
            click_rate = _safe_rate(c.sent, c.clicked)
            rows.append(
                "<tr>"
                f"<td>{c.name}</td>"
                f"<td>{_status_badge(c.status)}</td>"
                f"<td style='text-align:right'>{_fmt_number(c.sent)}</td>"
                f"<td style='text-align:right'>{_fmt_number(c.opened)}"
                f" <span class='rate-text'>({open_rate})</span></td>"
                f"<td style='text-align:right'>{_fmt_number(c.clicked)}"
                f" <span class='rate-text'>({click_rate})</span></td>"
                f"<td style='text-align:right'>{_fmt_number(c.replied)}</td>"
                f"<td style='text-align:right'>{_fmt_number(c.bounced)}</td>"
                "</tr>"
            )
        rows_html = "".join(rows)

    table_html = (
        '<table class="data-table">'
        "<thead><tr>"
        "<th>Campaign</th><th>Status</th>"
        "<th style='text-align:right'>Sent</th>"
        "<th style='text-align:right'>Opened</th>"
        "<th style='text-align:right'>Clicked</th>"
        "<th style='text-align:right'>Replied</th>"
        "<th style='text-align:right'>Bounced</th>"
        "</tr></thead>"
        f"<tbody>{rows_html}</tbody>"
        "</table>"
    )

    return (
        '<div class="section">'
        '<div class="section-title">Campaign Performance</div>'
        f'{table_html}'
        '</div>'
    )


def _render_top_leads_section(top_leads: list[TopLead]) -> str:
    """Render Section 3 — Top Leads table"""
    if not top_leads:
        rows_html = (
            '<tr class="empty-row">'
            '<td colspan="5">No lead data available</td>'
            '</tr>'
        )
    else:
        rows = []
        for lead in top_leads:
            rows.append(
                "<tr>"
                f"<td>{lead.name}</td>"
                f"<td>{lead.email or '—'}</td>"
                f"<td>{lead.category or '—'}</td>"
                f"<td>{lead.location or '—'}</td>"
                f"<td style='text-align:center'>{_score_badge(lead.score)}</td>"
                "</tr>"
            )
        rows_html = "".join(rows)

    table_html = (
        '<table class="data-table">'
        "<thead><tr>"
        "<th>Name / Business</th>"
        "<th>Email</th>"
        "<th>Category</th>"
        "<th>Location</th>"
        "<th style='text-align:center'>AI Score</th>"
        "</tr></thead>"
        f"<tbody>{rows_html}</tbody>"
        "</table>"
    )

    return (
        '<div class="section">'
        '<div class="section-title">Top Leads</div>'
        f'{table_html}'
        '</div>'
    )


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

async def generate_report_html(
    workspace_name: str,
    date_from: str,
    date_to: str,
    stats: SummaryStats,
    campaigns: list[CampaignStat],
    top_leads: list[TopLead] | None = None,
    extra: dict[str, Any] | None = None,
) -> str:
    """
    สร้าง printable HTML report สำหรับ LeadFlow CRM

    Args:
        workspace_name: ชื่อ workspace ที่แสดงใน header
        date_from: วันที่เริ่มต้น (YYYY-MM-DD)
        date_to: วันที่สิ้นสุด (YYYY-MM-DD)
        stats: SummaryStats object
        campaigns: รายการ CampaignStat
        top_leads: รายการ TopLead (optional)
        extra: ข้อมูลเพิ่มเติมที่ยังไม่ได้ใช้ (reserved for future)

    Returns:
        HTML string ที่พร้อม render ในหน้า browser หรือ print เป็น PDF
    """
    try:
        now_str = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

        # Header
        header_html = (
            '<div class="report-header">'
            '<div>'
            '<div class="logo-text">Lead<span>Flow</span></div>'
            '<div class="report-title">Performance Report</div>'
            '</div>'
            '<div class="header-meta">'
            f'<div class="workspace-name">{workspace_name}</div>'
            f'<div class="date-range">{date_from} — {date_to}</div>'
            '</div>'
            '</div>'
        )

        # Sections
        stats_section     = _render_stats_section(stats)
        campaigns_section = _render_campaigns_section(campaigns)
        leads_section     = _render_top_leads_section(top_leads or [])

        # Footer
        footer_html = (
            '<div class="report-footer">'
            f'<span>Generated at {now_str}</span>'
            '<span>Powered by LeadFlow</span>'
            '</div>'
        )

        # Assemble full HTML
        html = (
            "<!DOCTYPE html>"
            '<html lang="th">'
            "<head>"
            '<meta charset="UTF-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
            f"<title>LeadFlow Report — {workspace_name} ({date_from} to {date_to})</title>"
            "<link rel='preconnect' href='https://fonts.googleapis.com'>"
            "<link rel='stylesheet' href='https://fonts.googleapis.com/css2?"
            "family=Noto+Sans+Thai:wght@400;500;600;700;800"
            "&family=Inter:wght@400;500;600;700;800&display=swap'>"
            f"<style>{_REPORT_CSS}</style>"
            "</head>"
            "<body>"
            f"{header_html}"
            f"{stats_section}"
            f"{campaigns_section}"
            f"{leads_section}"
            f"{footer_html}"
            "</body>"
            "</html>"
        )

        return html

    except Exception as e:
        logger.error("report_generator: failed to generate HTML | error=%s", str(e))
        raise
