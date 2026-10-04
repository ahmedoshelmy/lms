import type { jsPDF } from 'jspdf';
import {
  EVALUATION_SECTIONS,
  EvaluationMetric,
  MonthlyEvaluation,
} from '../interfaces/MonthlyEvaluation';

/**
 * Draws the monthly report onto a jsPDF document.
 *
 * A4 portrait in points, laid out in the order the school's own template used:
 * who the report is about and the three rates, then what was covered, then the
 * four scored sections, then the recommendation. Keeping that order matters —
 * parents have been reading this shape for a year and the report should not
 * feel like a different school's.
 */

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Sampled from the school's template. */
const INK: [number, number, number] = [0x11, 0x18, 0x27];
const MUTED: [number, number, number] = [0x6b, 0x72, 0x80];
const BRAND: [number, number, number] = [0x1a, 0x2b, 0x4c];
const ACCENT: [number, number, number] = [0x3e, 0x6d, 0xb5];
const RULE: [number, number, number] = [0xe5, 0xe7, 0xeb];
const BAND: [number, number, number] = [0xf3, 0xf4, 0xf6];

/** Where the cursor is on the page, carried between the drawing steps. */
interface Cursor {
  doc: jsPDF;
  y: number;
}

export function monthlyReportFileName(report: MonthlyEvaluation): string {
  const month = report.month.slice(0, 7);
  const safe = report.studentName
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${safe}-${report.groupName}-${month}.pdf`;
}

export function drawMonthlyReport(doc: jsPDF, report: MonthlyEvaluation): void {
  const cursor: Cursor = { doc, y: 0 };

  drawHeader(cursor, report);
  drawRates(cursor, report);
  drawOverview(cursor, report);

  for (const section of EVALUATION_SECTIONS) {
    drawSection(cursor, section, report);
  }

  drawRecommendation(cursor, report);
  stampFooters(doc);
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function drawHeader(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_WIDTH, 96, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Student Monthly Performance Report', MARGIN, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Empowering Future Engineers', MARGIN, 64);
  doc.text(monthName(report.month), PAGE_WIDTH - MARGIN, 64, { align: 'right' });

  cursor.y = 124;

  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  const intro =
    "This report summarises the student's progress in their coding course at MindValley, " +
    'and is written for parents and guardians.';
  const lines = doc.splitTextToSize(intro, CONTENT_WIDTH);
  doc.text(lines, MARGIN, cursor.y);
  cursor.y += lines.length * 12 + 10;

  // Who it is about, in two rows of three, as the template had it.
  drawFactRow(cursor, [
    ['Student', report.studentName],
    ['Group', report.groupName],
    ['Course', report.courseName],
  ]);
  drawFactRow(cursor, [
    ['Level', report.courseLevel],
    ['Instructor', report.instructorName],
    ['Month', monthName(report.month)],
  ]);
}

function drawFactRow(cursor: Cursor, facts: [string, string][]): void {
  const { doc } = cursor;
  const columnWidth = CONTENT_WIDTH / facts.length;

  facts.forEach(([label, value], index) => {
    const x = MARGIN + columnWidth * index;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, cursor.y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(fit(doc, value, columnWidth - 10, 11), x, cursor.y + 14);
  });

  cursor.y += 34;
}

function drawRates(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  const rates: [string, number][] = [
    ['Attendance rate', report.attendanceRate],
    ['Session tasks rate', report.tasksRate],
    ['Assignments rate', report.assignmentsRate],
  ];

  const gap = 12;
  const boxWidth = (CONTENT_WIDTH - gap * (rates.length - 1)) / rates.length;

  rates.forEach(([label, value], index) => {
    const x = MARGIN + (boxWidth + gap) * index;

    doc.setFillColor(...BAND);
    doc.roundedRect(x, cursor.y, boxWidth, 58, 8, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...BRAND);
    doc.text(`${value}%`, x + 12, cursor.y + 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 12, cursor.y + 46);

    // A bar under the figure, so the three read against each other at a glance.
    const barWidth = boxWidth - 24;
    doc.setFillColor(...RULE);
    doc.roundedRect(x + 12, cursor.y + 50, barWidth, 4, 2, 2, 'F');
    if (value > 0) {
      doc.setFillColor(...ACCENT);
      doc.roundedRect(x + 12, cursor.y + 50, (barWidth * Math.min(value, 100)) / 100, 4, 2, 2, 'F');
    }
  });

  cursor.y += 58 + 22;
}

function drawOverview(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  heading(cursor, 'Technical topics covered and projects');

  const text = report.technicalOverview?.trim() || 'No classes were recorded for this month.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);

  for (const paragraph of text.split(/\n{2,}/)) {
    const lines = doc.splitTextToSize(paragraph.replace(/\n/g, ' '), CONTENT_WIDTH);
    for (const line of lines) {
      breakIfNeeded(cursor, 16);
      doc.text(line, MARGIN, cursor.y);
      cursor.y += 14;
    }
    cursor.y += 6;
  }

  cursor.y += 8;
}

function drawSection(
  cursor: Cursor,
  section: (typeof EVALUATION_SECTIONS)[number],
  report: MonthlyEvaluation
): void {
  const { doc } = cursor;

  breakIfNeeded(cursor, 40 + section.metrics.length * 22);
  heading(cursor, section.title);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(section.blurb, MARGIN, cursor.y);
  cursor.y += 16;

  for (const row of section.metrics) {
    const stars = starsFor(report, row.metric);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(row.label, MARGIN, cursor.y);

    drawStars(doc, PAGE_WIDTH - MARGIN - 86, cursor.y - 7, stars);

    cursor.y += 10;
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, cursor.y, PAGE_WIDTH - MARGIN, cursor.y);
    cursor.y += 12;
  }

  cursor.y += 8;
}

/**
 * Five stars, filled to the score.
 *
 * Drawn rather than typed: Helvetica has no star, and the glyph a font
 * substitution picks is as likely to be a box as a star.
 */
function drawStars(doc: jsPDF, x: number, y: number, score: number): void {
  const size = 5.4;
  const gap = 17;

  for (let i = 0; i < 5; i++) {
    const centreX = x + gap * i + size;
    const filled = i < score;

    doc.setDrawColor(...(filled ? ACCENT : RULE));
    doc.setFillColor(...(filled ? ACCENT : RULE));

    const points: [number, number][] = [];
    for (let point = 0; point < 10; point++) {
      const radius = point % 2 === 0 ? size : size / 2.4;
      const angle = (Math.PI / 5) * point - Math.PI / 2;
      points.push([centreX + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
    }

    // jsPDF draws a polygon from a start point and a list of offsets.
    const [first, ...rest] = points;
    const offsets = rest.map((point, index) => [
      point[0] - (index === 0 ? first[0] : rest[index - 1][0]),
      point[1] - (index === 0 ? first[1] : rest[index - 1][1]),
    ]);

    doc.lines(offsets, first[0], first[1], [1, 1], 'F', true);
  }
}

function drawRecommendation(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  const lines = (report.recommendations ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  breakIfNeeded(cursor, 60 + lines.length * 16);
  heading(cursor, "Instructor's recommendation");

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);

  if (lines.length === 0) {
    doc.setTextColor(...MUTED);
    doc.text('No recommendation was given this month.', MARGIN, cursor.y);
    cursor.y += 16;
    return;
  }

  for (const line of lines) {
    for (const wrapped of doc.splitTextToSize(line, CONTENT_WIDTH - 16)) {
      breakIfNeeded(cursor, 18);
      doc.text(wrapped, MARGIN + 14, cursor.y);
      cursor.y += 14;
    }

    // The bullet sits against the first line of each recommendation.
    doc.setFillColor(...ACCENT);
    doc.circle(MARGIN + 5, cursor.y - 18, 2, 'F');
    cursor.y += 4;
  }
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function heading(cursor: Cursor, text: string): void {
  const { doc } = cursor;

  breakIfNeeded(cursor, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.text(text, MARGIN, cursor.y);
  cursor.y += 8;

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, cursor.y, MARGIN + 44, cursor.y);
  doc.setLineWidth(0.5);
  cursor.y += 16;
}

/** Starts a new page when what comes next would run off this one. */
function breakIfNeeded(cursor: Cursor, needed: number): void {
  if (cursor.y + needed <= PAGE_HEIGHT - 56) {
    return;
  }

  cursor.doc.addPage();
  cursor.y = MARGIN + 10;
}

function stampFooters(doc: jsPDF): void {
  const pages = doc.getNumberOfPages();

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Academic & Operations Team — MindValley', MARGIN, PAGE_HEIGHT - 30);
    doc.text(`${page} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 30, { align: 'right' });
  }
}

function starsFor(report: MonthlyEvaluation, metric: EvaluationMetric): number {
  return report.ratings.find((rating) => rating.metric === metric)?.stars ?? 0;
}

/** Shrinks a size until the text fits, so a long name cannot run into the next column. */
function fit(doc: jsPDF, text: string, maxWidth: number, size: number): string {
  doc.setFontSize(size);
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }

  let trimmed = text;
  while (trimmed.length > 4 && doc.getTextWidth(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed}…`;
}

function monthName(month: string): string {
  return new Date(`${month.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}
