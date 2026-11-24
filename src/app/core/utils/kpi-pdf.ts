import type { jsPDF } from 'jspdf';
import {
  InstructorKpi,
  KPI_BAND_LABELS,
  KPI_INDICATORS,
  KpiHistoryPoint,
  KpiMonth,
} from '../interfaces/InstructorKpi';
import { formatPercent, indicatorBasis, monthLabel } from './kpi.utils';

/**
 * Instructor KPI sheets for the owner: one page per instructor, and for the
 * whole school a summary table in front of them. A4 portrait in points, in
 * the house style of the monthly report.
 *
 * Every adjustment is printed with the figure it replaced, who made it and
 * why: a report that hides its edits is not one an owner can rely on.
 */

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = PAGE_HEIGHT - 52;

type Rgb = [number, number, number];
const INK: Rgb = [0x11, 0x18, 0x27];
const BODY: Rgb = [0x37, 0x41, 0x51];
const MUTED: Rgb = [0x5f, 0x66, 0x73];
const BRAND: Rgb = [0x1a, 0x2b, 0x4c];
const ACCENT: Rgb = [0x3e, 0x6d, 0xb5];
const RULE: Rgb = [0xe5, 0xe7, 0xeb];
const SHADE: Rgb = [0xf6, 0xf7, 0xf9];
const GOLD: Rgb = [0xb5, 0x47, 0x08];
const PAPER: Rgb = [0xff, 0xff, 0xff];
const BAND_INK: Record<string, Rgb> = {
  Excellent: [0x02, 0x7a, 0x48],
  Good: [0x3e, 0x6d, 0xb5],
  NeedsAttention: [0xb4, 0x23, 0x18],
};

interface Cursor {
  doc: jsPDF;
  y: number;
}

export function kpiSheetFileName(kpi: InstructorKpi): string {
  return `KPI-${safe(kpi.instructorName)}-${kpi.month}.pdf`;
}

export function kpiMonthFileName(month: string): string {
  return `KPI-all-instructors-${month}.pdf`;
}

/** One instructor's month, with its trend when there is one. */
export function drawInstructorSheet(
  doc: jsPDF,
  month: KpiMonth,
  kpi: InstructorKpi,
  history: KpiHistoryPoint[] = []
): void {
  const cursor: Cursor = { doc, y: 0 };
  drawMasthead(cursor, 'Instructor KPI Report', month);
  drawHeadline(cursor, kpi);
  drawIndicators(cursor, month, kpi);
  if (history.length > 1) drawTrend(cursor, history);
}

/** Every instructor: the summary table, then a page each. */
export function drawMonthReport(doc: jsPDF, month: KpiMonth): void {
  const cursor: Cursor = { doc, y: 0 };
  drawMasthead(cursor, 'Instructor KPIs — All Instructors', month);
  drawSummary(cursor, month);
  for (const kpi of month.instructors) {
    doc.addPage();
    drawInstructorSheet(doc, month, kpi);
  }
}

/** Page numbers and the date on every page; run once the pages are drawn. */
export function stampPages(doc: jsPDF, generatedOn: Date): void {
  const pages = doc.getNumberOfPages();
  const when = generatedOn.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, FOOTER_TOP, PAGE_WIDTH - MARGIN, FOOTER_TOP);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${when}`, MARGIN, FOOTER_TOP + 16);
    doc.text(`Page ${i} of ${pages}`, PAGE_WIDTH - MARGIN, FOOTER_TOP + 16, { align: 'right' });
  }
}

// ── Parts ───────────────────────────────────────────────────────────────────

function drawMasthead(cursor: Cursor, title: string, month: KpiMonth): void {
  const { doc } = cursor;
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_WIDTH, 96, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 92, PAGE_WIDTH, 4, 'F');

  doc.setTextColor(...PAPER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('MINDVALLEY', MARGIN, 36, { charSpace: 2.4 });
  doc.setFontSize(19);
  doc.text(title, MARGIN, 64);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(monthLabel(month.month), PAGE_WIDTH - MARGIN, 64, { align: 'right' });

  cursor.y = 122;

  // Figures from a month nobody has approved can still move; say so on the page.
  if (month.status !== 'Approved') {
    doc.setFillColor(...GOLD);
    doc.roundedRect(MARGIN, cursor.y - 13, 232, 18, 4, 4, 'F');
    doc.setTextColor(...PAPER);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('NOT YET APPROVED — FIGURES MAY CHANGE', MARGIN + 10, cursor.y);
    cursor.y += 26;
  } else {
    const approved = [...month.events].reverse().find((e) => e.action === 'Approved');
    if (approved) {
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Approved by ${approved.byName} on ${shortDate(approved.at)}`, MARGIN, cursor.y);
      cursor.y += 22;
    }
  }
}

function drawHeadline(cursor: Cursor, kpi: InstructorKpi): void {
  const { doc } = cursor;
  const height = 70;
  doc.setFillColor(...SHADE);
  doc.setDrawColor(...RULE);
  doc.roundedRect(MARGIN, cursor.y, CONTENT_WIDTH, height, 8, 8, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('INSTRUCTOR', MARGIN + 16, cursor.y + 24, { charSpace: 0.6 });
  doc.text('OVERALL', PAGE_WIDTH - MARGIN - 16, cursor.y + 24, {
    align: 'right',
    charSpace: 0.6,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(fit(doc, kpi.instructorName, CONTENT_WIDTH - 200), MARGIN + 16, cursor.y + 48);

  doc.setFontSize(22);
  doc.text(formatPercent(kpi.overall), PAGE_WIDTH - MARGIN - 16, cursor.y + 50, {
    align: 'right',
  });
  if (kpi.band) {
    doc.setFontSize(9);
    doc.setTextColor(...BAND_INK[kpi.band]);
    doc.text(KPI_BAND_LABELS[kpi.band], PAGE_WIDTH - MARGIN - 16, cursor.y + 63, {
      align: 'right',
    });
  }
  cursor.y += height + 22;
}

function drawIndicators(cursor: Cursor, month: KpiMonth, kpi: InstructorKpi): void {
  const { doc } = cursor;
  for (const { key, label } of KPI_INDICATORS) {
    const indicator = kpi[key];
    const weight = month.settings.weights[key];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(label, MARGIN, cursor.y);
    doc.setFontSize(14);
    doc.text(formatPercent(indicator.value), PAGE_WIDTH - MARGIN, cursor.y, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      `${indicatorBasis(key, indicator.detail as never)} · weight ${weight}%`,
      MARGIN,
      cursor.y + 14
    );
    cursor.y += 22;

    if (indicator.override) {
      // Clear of the basis line above it.
      cursor.y += 10;
      const o = indicator.override;
      const note =
        `Adjusted from ${formatPercent(indicator.calculated)} by ${o.byName} ` +
        `on ${shortDate(o.at)}: ${o.reason}`;
      doc.setTextColor(...BODY);
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(note, CONTENT_WIDTH - 12);
      doc.setFillColor(...GOLD);
      doc.rect(MARGIN, cursor.y - 9, 2, lines.length * 11 + 2, 'F');
      doc.text(lines, MARGIN + 10, cursor.y);
      cursor.y += lines.length * 11 + 6;
    }

    doc.setDrawColor(...RULE);
    doc.line(MARGIN, cursor.y, PAGE_WIDTH - MARGIN, cursor.y);
    cursor.y += 22;
  }
}

function drawTrend(cursor: Cursor, history: KpiHistoryPoint[]): void {
  const { doc } = cursor;
  const points = [...history].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('The last months', MARGIN, cursor.y);
  cursor.y += 16;

  const labelWidth = 120;
  const col = (CONTENT_WIDTH - labelWidth) / points.length;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  points.forEach((p, i) => {
    const [y, m] = p.month.split('-').map(Number);
    const short = new Date(y, m - 1, 1).toLocaleDateString('en-GB', {
      month: 'short',
      year: '2-digit',
    });
    doc.text(short, MARGIN + labelWidth + col * (i + 1) - 6, cursor.y, { align: 'right' });
  });
  cursor.y += 6;

  const rows: [string, (p: KpiHistoryPoint) => number | null][] = [
    ...KPI_INDICATORS.map(
      ({ key, short }) =>
        [short, (p: KpiHistoryPoint) => p[key]] as [string, (p: KpiHistoryPoint) => number | null]
    ),
    ['Overall', (p) => p.overall],
  ];
  rows.forEach(([name, read], r) => {
    const top = cursor.y + r * 18;
    if (r % 2 === 0) {
      doc.setFillColor(...SHADE);
      doc.rect(MARGIN, top, CONTENT_WIDTH, 18, 'F');
    }
    doc.setFont('helvetica', name === 'Overall' ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(name, MARGIN + 8, top + 12);
    points.forEach((p, i) => {
      doc.text(formatPercent(read(p)), MARGIN + labelWidth + col * (i + 1) - 6, top + 12, {
        align: 'right',
      });
    });
  });
  cursor.y += rows.length * 18 + 16;
}

function drawSummary(cursor: Cursor, month: KpiMonth): void {
  const { doc } = cursor;
  const { weights, bands } = month.settings;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const intro =
    `Overall = reports ${weights.reports}% + registers ${weights.registers}% + ` +
    `classes kept ${weights.cancellations}%. Excellent from ${bands.excellent}%, ` +
    `Good from ${bands.good}%. An asterisk marks a figure an admin adjusted; ` +
    `each instructor's page says why.`;
  const lines = doc.splitTextToSize(intro, CONTENT_WIDTH);
  doc.text(lines, MARGIN, cursor.y);
  cursor.y += lines.length * 11 + 12;

  const columns = [
    { title: 'Instructor', x: MARGIN + 8, align: 'left' as const },
    ...KPI_INDICATORS.map((ind, i) => ({
      title: ind.short,
      x: MARGIN + 210 + i * 60,
      align: 'right' as const,
    })),
    // Room after it for the longest band, "Needs attention".
    { title: 'Overall', x: MARGIN + 210 + 3 * 60 + 4, align: 'right' as const },
    { title: 'Band', x: PAGE_WIDTH - MARGIN - 8, align: 'right' as const },
  ];

  const header = () => {
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN, cursor.y, CONTENT_WIDTH, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...PAPER);
    for (const c of columns) doc.text(c.title, c.x, cursor.y + 13, { align: c.align });
    cursor.y += 20;
  };
  header();

  month.instructors.forEach((kpi, r) => {
    if (cursor.y + 20 > FOOTER_TOP - 10) {
      doc.addPage();
      cursor.y = MARGIN;
      header();
    }
    if (r % 2 === 1) {
      doc.setFillColor(...SHADE);
      doc.rect(MARGIN, cursor.y, CONTENT_WIDTH, 20, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(fit(doc, kpi.instructorName, 190), columns[0].x, cursor.y + 13);
    KPI_INDICATORS.forEach(({ key }, i) => {
      const ind = kpi[key];
      doc.text(
        formatPercent(ind.value) + (ind.override ? '*' : ''),
        columns[i + 1].x,
        cursor.y + 13,
        {
          align: 'right',
        }
      );
    });
    doc.setFont('helvetica', 'bold');
    doc.text(formatPercent(kpi.overall), columns[4].x, cursor.y + 13, { align: 'right' });
    doc.setTextColor(...(kpi.band ? BAND_INK[kpi.band] : MUTED));
    doc.text(kpi.band ? KPI_BAND_LABELS[kpi.band] : 'No data', columns[5].x, cursor.y + 13, {
      align: 'right',
    });
    cursor.y += 20;
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fit(doc: jsPDF, text: string, width: number): string {
  if (doc.getTextWidth(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(cut + '…') > width) cut = cut.slice(0, -1);
  return cut + '…';
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function safe(name: string): string {
  return name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
