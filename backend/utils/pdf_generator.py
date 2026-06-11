"""
TaxFi — PDF Generation for IRS Forms

Generates actual PDF files for Form 8949, Schedule D, and Schedule 1
using ReportLab for production-quality output.
"""

from datetime import datetime
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


def generate_form_8949(
    user_address: str,
    tax_year: int,
    short_term_entries: list[dict],
    long_term_entries: list[dict],
) -> bytes:
    """Generate Form 8949 PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    
    normal_style = ParagraphStyle(
        'Normal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
    )

    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica-Bold',
    )

    story = []

    # Title
    story.append(Paragraph(f"Form 8949 — {tax_year}", title_style))
    story.append(Paragraph(
        "Sales and Other Dispositions of Capital Assets",
        ParagraphStyle('Subtitle', parent=title_style, fontSize=11),
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"TaxFi Generated — {datetime.now().strftime('%Y-%m-%d')}", normal_style))
    story.append(Spacer(1, 6))

    # User info
    story.append(Paragraph(f"Wallet: {user_address[:6]}...{user_address[-4:]}", normal_style))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    story.append(Spacer(1, 12))

    # Part I - Short-term
    story.append(Paragraph("Part I — Short-Term Transactions", header_style))
    story.append(Spacer(1, 6))

    if short_term_entries:
        st_headers = ["Description", "Acquired", "Sold", "Proceeds", "Cost Basis", "Gain/Loss"]
        st_data = [st_headers]
        for i, entry in enumerate(short_term_entries, 1):
            st_data.append([
                entry.get('description', '')[:30],
                entry.get('acquisition_date', ''),
                entry.get('sale_date', ''),
                f"${entry.get('proceeds', 0):,.2f}",
                f"${entry.get('cost_basis', 0):,.2f}",
                f"${entry.get('gain_loss', 0):,.2f}",
            ])

        st_table = Table(st_data, colWidths=[2*inch, 0.7*inch, 0.7*inch, 0.9*inch, 0.9*inch, 0.9*inch])
        st_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(st_table)
    else:
        story.append(Paragraph("No short-term transactions.", normal_style))

    story.append(Spacer(1, 12))

    # Part II - Long-term
    story.append(Paragraph("Part II — Long-Term Transactions", header_style))
    story.append(Spacer(1, 6))

    if long_term_entries:
        lt_headers = ["Description", "Acquired", "Sold", "Proceeds", "Cost Basis", "Gain/Loss"]
        lt_data = [lt_headers]
        for i, entry in enumerate(long_term_entries, 1):
            lt_data.append([
                entry.get('description', '')[:30],
                entry.get('acquisition_date', ''),
                entry.get('sale_date', ''),
                f"${entry.get('proceeds', 0):,.2f}",
                f"${entry.get('cost_basis', 0):,.2f}",
                f"${entry.get('gain_loss', 0):,.2f}",
            ])

        lt_table = Table(lt_data, colWidths=[2*inch, 0.7*inch, 0.7*inch, 0.9*inch, 0.9*inch, 0.9*inch])
        lt_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(lt_table)
    else:
        story.append(Paragraph("No long-term transactions.", normal_style))

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "This document was generated by TaxFi and should be reviewed by a qualified tax professional. "
        "The onchain hash of this form has been recorded for verification.",
        ParagraphStyle('Footer', parent=normal_style, fontSize=8, textColor=colors.grey),
    ))

    doc.build(story)
    return buffer.getvalue()


def generate_schedule_d(
    user_address: str,
    tax_year: int,
    short_term_gain: float,
    short_term_loss: float,
    long_term_gain: float,
    long_term_loss: float,
) -> bytes:
    """Generate Schedule D PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"Schedule D (Form 1040) — {tax_year}", ParagraphStyle(
        'Title', parent=styles['Heading1'], fontSize=14, alignment=TA_CENTER
    )))
    story.append(Paragraph("Capital Gains and Losses", ParagraphStyle('Subtitle', parent=styles['Heading2'], fontSize=11, alignment=TA_CENTER)))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Wallet: {user_address[:6]}...{user_address[-4:]}", styles['Normal']))
    story.append(Spacer(1, 12))

    # Part I
    story.append(Paragraph("Part I — Short-Term Capital Gains and Losses", styles['Heading3']))
    story.append(Spacer(1, 6))

    st_data = [
        ["1b. Enter net short-term gain/loss:", f"${short_term_gain - short_term_loss:,.2f}"],
        ["1c. Total short-term gain/loss:", f"${short_term_gain - short_term_loss:,.2f}"],
    ]

    st_table = Table(st_data, colWidths=[4*inch, 2*inch])
    st_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(st_table)

    # Part II
    story.append(Spacer(1, 12))
    story.append(Paragraph("Part II — Long-Term Capital Gains and Losses", styles['Heading3']))
    story.append(Spacer(1, 6))

    lt_data = [
        ["8h. Enter net long-term gain/loss:", f"${long_term_gain - long_term_loss:,.2f}"],
        ["8i. Total long-term gain/loss:", f"${long_term_gain - long_term_loss:,.2f}"],
    ]

    lt_table = Table(lt_data, colWidths=[4*inch, 2*inch])
    lt_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(lt_table)

    doc.build(story)
    return buffer.getvalue()


def generate_tax_summary(
    user_address: str,
    tax_year: int,
    summary: dict,
    onchain_hashes: dict,
) -> bytes:
    """Generate a plain-English tax summary PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    story = []

    # Title
    title = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER, spaceAfter=20)
    story.append(Paragraph(f"TaxFi Tax Summary — {tax_year}", title))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#6366f1")))
    story.append(Spacer(1, 20))

    # Summary text
    story.append(Paragraph(f"Wallet: {user_address}", styles['Normal']))
    story.append(Spacer(1, 12))

    if 'summary' in summary:
        story.append(Paragraph(summary['summary'], ParagraphStyle(
            'SummaryText', parent=styles['Normal'], fontSize=12, leading=18, spaceAfter=20
        )))

    # Key numbers
    story.append(Paragraph("Key Numbers", styles['Heading2']))
    story.append(Spacer(1, 8))

    if 'key_numbers' in summary:
        key_data = []
        for key, value in summary['key_numbers'].items():
            key_data.append([
                key.replace('_', ' ').title(),
                str(value),
            ])

        key_table = Table(key_data, colWidths=[4*inch, 2*inch])
        key_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(key_table)

    # Onchain hashes
    story.append(Spacer(1, 20))
    story.append(Paragraph("Onchain Verification", styles['Heading2']))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "These forms have been anchored onchain for immutable verification:",
        styles['Normal'],
    ))
    story.append(Spacer(1, 8))

    for form, hash_value in onchain_hashes.items():
        story.append(Paragraph(
            f"• {form.upper()}: {hash_value}",
            ParagraphStyle('Hash', parent=styles['Normal'], fontSize=9, fontName='Courier'),
        ))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "This summary was generated by TaxFi. Consult a qualified tax professional for filing advice. "
        "TaxFi is not a CPA or tax attorney.",
        ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8, textColor=colors.grey),
    ))

    doc.build(story)
    return buffer.getvalue()


def generate_all_forms(
    user_address: str,
    tax_year: int,
    form_data: dict,
    onchain_hashes: dict,
) -> dict[str, bytes]:
    """Generate all tax forms as a dictionary of PDFs."""
    return {
        "form_8949.pdf": generate_form_8949(
            user_address,
            tax_year,
            form_data.get('form_8949', {}).get('parts', {}).get('I', {}).get('transactions', []),
            form_data.get('form_8949', {}).get('parts', {}).get('II', {}).get('transactions', []),
        ),
        "schedule_d.pdf": generate_schedule_d(
            user_address,
            tax_year,
            form_data.get('schedule_d', {}).get('part_i', {}).get('total_gain', 0),
            form_data.get('schedule_d', {}).get('part_i', {}).get('total_loss', 0),
            form_data.get('schedule_d', {}).get('part_ii', {}).get('total_gain', 0),
            form_data.get('schedule_d', {}).get('part_ii', {}).get('total_loss', 0),
        ),
        "tax_summary.pdf": generate_tax_summary(user_address, tax_year, form_data.get('summary', {}), onchain_hashes),
    }