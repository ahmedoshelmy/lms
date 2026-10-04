import type { jsPDF } from 'jspdf';
import {
  EVALUATION_SECTIONS,
  EvaluationMetric,
  MonthlyEvaluation,
} from '../interfaces/MonthlyEvaluation';

/**
 * Draws the monthly report onto a jsPDF document.
 *
 * A4 portrait in points, in the order the school's own template used: who the
 * report is about and the three rates, what was covered, the four scored
 * sections, then the recommendation. Parents have been reading that shape for
 * a year and the report should not feel like a different school's.
 *
 * The rule running through the layout is that nothing unanswered may look like
 * an answer. A rating nobody gave prints "Not rated", not five empty stars; a
 * rate nobody recorded prints "Not recorded", not 0%. The first draft of this
 * printed both as zeros and read, fairly, as a broken document.
 */

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = PAGE_HEIGHT - 52;

/** Sampled from the school's own template. */
const INK: Rgb = [0x11, 0x18, 0x27];
const BODY: Rgb = [0x37, 0x41, 0x51];
const MUTED: Rgb = [0x6b, 0x72, 0x80];
const BRAND: Rgb = [0x1a, 0x2b, 0x4c];
const ACCENT: Rgb = [0x3e, 0x6d, 0xb5];
const RULE: Rgb = [0xe5, 0xe7, 0xeb];
const BAND: Rgb = [0xf6, 0xf7, 0xf9];
const GOLD: Rgb = [0xf5, 0x9e, 0x0b];
const PAPER: Rgb = [0xff, 0xff, 0xff];

type Rgb = [number, number, number];

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

  drawMasthead(cursor, report);
  drawIdentity(cursor, report);
  drawRates(cursor, report);
  drawOverview(cursor, report);

  for (const section of EVALUATION_SECTIONS) {
    drawSection(cursor, section, report);
  }

  drawRecommendation(cursor, report);
  stampPages(doc, report);
}

// ── The top of page one ─────────────────────────────────────────────────────

function drawMasthead(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_WIDTH, 112, 'F');

  // A bar of the accent colour along the bottom edge, which is the one piece
  // of the school's artwork that survives being redrawn rather than embedded.
  doc.setFillColor(...ACCENT);
  doc.rect(0, 108, PAGE_WIDTH, 4, 'F');

  doc.setTextColor(...PAPER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('MINDVALLEY', MARGIN, 40, { charSpace: 2.4 });

  doc.setFontSize(21);
  doc.text('Student Monthly Performance Report', MARGIN, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Empowering Future Engineers', MARGIN, 90);
  doc.text(monthName(report.month), PAGE_WIDTH - MARGIN, 90, { align: 'right' });

  cursor.y = 140;

  // An unreleased report has to say so on its face. One printed from a draft
  // and handed to a parent is the mistake worth shouting about.
  if (report.status !== 'Released') {
    doc.setFillColor(...GOLD);
    doc.roundedRect(MARGIN, cursor.y - 13, 148, 18, 4, 4, 'F');
    doc.setTextColor(...PAPER);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DRAFT — NOT YET RELEASED', MARGIN + 10, cursor.y);
    cursor.y += 22;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  const intro =
    "This report summarises the student's progress in their coding course at MindValley, " +
    'and is written for parents and guardians.';
  const lines = doc.splitTextToSize(intro, CONTENT_WIDTH);
  doc.text(lines, MARGIN, cursor.y);
  cursor.y += lines.length * 12 + 16;
}

/** Who the report is about, in one bordered block of six facts. */
function drawIdentity(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  const rows: [string, string][][] = [
    [
      ['Student', report.studentName],
      ['Group', report.groupName],
      ['Course', courseWithoutLevel(report)],
    ],
    [
      ['Level', report.courseLevel],
      ['Instructor', report.instructorName],
      ['Month', monthName(report.month)],
    ],
  ];

  const height = rows.length * 38 + 10;

  doc.setFillColor(...BAND);
  doc.setDrawColor(...RULE);
  doc.roundedRect(MARGIN, cursor.y, CONTENT_WIDTH, height, 8, 8, 'FD');

  const columnWidth = (CONTENT_WIDTH - 28) / 3;
  let y = cursor.y + 22;

  for (const row of rows) {
    row.forEach(([label, value], index) => {
      const x = MARGIN + 14 + columnWidth * index;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), x, y, { charSpace: 0.6 });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(fit(doc, value || '—', columnWidth - 12, 11), x, y + 14);
    });

    y += 38;
  }

  cursor.y += height + 18;
}

// ── The three rates ─────────────────────────────────────────────────────────

function drawRates(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;
  const attendance = report.attendance;

  const cards: { label: string; value: number; note: string; recorded: boolean }[] = [
    {
      label: 'Attendance',
      value: report.attendanceRate,
      note: attendance.classesHeld
        ? `${attendance.present + attendance.late} of ${attendance.classesHeld} classes`
        : 'No classes this month',
      recorded: attendance.classesHeld > 0,
    },
    {
      label: 'Session tasks',
      value: report.tasksRate,
      note: attendance.tasksAsked
        ? `${attendance.tasksDone} of ${attendance.tasksAsked} set`
        : 'Not recorded',
      recorded: attendance.tasksAsked > 0 || report.tasksRateEdited,
    },
    {
      label: 'Assignments',
      value: report.assignmentsRate,
      note: attendance.assignmentsAsked
        ? `${attendance.assignmentsDone} of ${attendance.assignmentsAsked} set`
        : 'Not recorded',
      recorded: attendance.assignmentsAsked > 0 || report.assignmentsRateEdited,
    },
  ];

  const gap = 12;
  const boxWidth = (CONTENT_WIDTH - gap * 2) / 3;
  const boxHeight = 74;

  cards.forEach((card, index) => {
    const x = MARGIN + (boxWidth + gap) * index;

    doc.setFillColor(...PAPER);
    doc.setDrawColor(...RULE);
    doc.roundedRect(x, cursor.y, boxWidth, boxHeight, 8, 8, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(card.label.toUpperCase(), x + 12, cursor.y + 18, { charSpace: 0.6 });

    if (card.recorded) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(23);
      doc.setTextColor(...BRAND);
      doc.text(`${card.value}%`, x + 12, cursor.y + 44);

      const barWidth = boxWidth - 24;
      doc.setFillColor(...RULE);
      doc.roundedRect(x + 12, cursor.y + 52, barWidth, 5, 2.5, 2.5, 'F');

      if (card.value > 0) {
        doc.setFillColor(...ACCENT);
        doc.roundedRect(
          x + 12,
          cursor.y + 52,
          (barWidth * Math.min(card.value, 100)) / 100,
          5,
          2.5,
          2.5,
          'F'
        );
      }
    } else {
      // A rate nobody recorded is not nought percent. Saying so is the whole
      // difference between an empty month and a bad one.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...MUTED);
      doc.text('Not recorded', x + 12, cursor.y + 42);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(card.note, x + 12, cursor.y + 66);
  });

  cursor.y += boxHeight + 24;
}

// ── What was taught ─────────────────────────────────────────────────────────

function drawOverview(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  heading(cursor, 'Technical topics covered and projects');

  const text = report.technicalOverview?.trim();
  if (!text) {
    muted(cursor, 'No classes were recorded for this month.');
    cursor.y += 10;
    return;
  }

  for (const paragraph of text.split(/\n{2,}/)) {
    // "Session 6 — Neural networks" on its own line, in bold, with the
    // summary beneath it. The label used to run inline with the summary,
    // placed word by word, which cost a space every time a sentence ended.
    const match = /^(Session\s+\d+\s*[—-]\s*[^:]+?)[::.]\s*([\s\S]*)$/.exec(paragraph.trim());
    const label = match ? match[1].trim() : '';
    const body = (match ? match[2] : paragraph).replace(/\s*\n\s*/g, ' ').trim();

    if (label) {
      breakIfNeeded(cursor, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(label, MARGIN, cursor.y);
      cursor.y += 13;
    }

    if (body) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...BODY);

      for (const line of doc.splitTextToSize(body, CONTENT_WIDTH)) {
        breakIfNeeded(cursor, 16);
        doc.text(line, MARGIN, cursor.y);
        cursor.y += 13;
      }
    }

    cursor.y += 9;
  }

  cursor.y += 6;
}

// ── The scored sections ─────────────────────────────────────────────────────

function drawSection(
  cursor: Cursor,
  section: (typeof EVALUATION_SECTIONS)[number],
  report: MonthlyEvaluation
): void {
  const { doc } = cursor;

  // Keep a heading with at least its first two rows; a section title alone at
  // the foot of a page reads as a section with nothing in it.
  breakIfNeeded(cursor, 64 + Math.min(section.metrics.length, 2) * 26);
  heading(cursor, section.title);
  muted(cursor, section.blurb);
  cursor.y += 6;

  const rowHeight = 26;

  section.metrics.forEach((row, index) => {
    breakIfNeeded(cursor, rowHeight + 6);

    if (index % 2 === 0) {
      doc.setFillColor(...BAND);
      doc.rect(MARGIN, cursor.y - 9, CONTENT_WIDTH, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BODY);
    doc.text(row.label, MARGIN + 10, cursor.y + 8);

    const score = starsFor(report, row.metric);

    if (score >= 1) {
      drawStars(doc, PAGE_WIDTH - MARGIN - 112, cursor.y + 2, score);

      // The number as well as the shape: a report is read in black and white
      // as often as in colour, and five grey stars say nothing.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(`${score}/5`, PAGE_WIDTH - MARGIN - 10, cursor.y + 8, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text('Not rated', PAGE_WIDTH - MARGIN - 10, cursor.y + 8, { align: 'right' });
    }

    cursor.y += rowHeight;
  });

  cursor.y += 14;
}

/**
 * Five stars, filled to the score.
 *
 * Drawn rather than typed: Helvetica has no star, and whichever glyph a font
 * substitution picks is as likely to be a box.
 */
function drawStars(doc: jsPDF, x: number, y: number, score: number): void {
  const radius = 5.2;
  const gap = 15;

  for (let i = 0; i < 5; i++) {
    const filled = i < score;
    const centreX = x + gap * i + radius;

    doc.setFillColor(...(filled ? GOLD : RULE));
    doc.setDrawColor(...(filled ? GOLD : RULE));

    const points: [number, number][] = [];
    for (let point = 0; point < 10; point++) {
      const r = point % 2 === 0 ? radius : radius / 2.4;
      const angle = (Math.PI / 5) * point - Math.PI / 2;
      points.push([centreX + r * Math.cos(angle), y + r * Math.sin(angle)]);
    }

    // jsPDF takes a start point and a list of offsets from the point before.
    const [first, ...rest] = points;
    let previous = first;
    const offsets = rest.map((point) => {
      const offset: [number, number] = [point[0] - previous[0], point[1] - previous[1]];
      previous = point;
      return offset;
    });

    doc.lines(offsets, first[0], first[1], [1, 1], 'F', true);
  }
}

// ── What next ───────────────────────────────────────────────────────────────

function drawRecommendation(cursor: Cursor, report: MonthlyEvaluation): void {
  const { doc } = cursor;

  const lines = (report.recommendations ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  breakIfNeeded(cursor, 70 + lines.length * 18);
  heading(cursor, "Instructor's recommendation");

  if (lines.length === 0) {
    muted(cursor, 'No recommendation was given this month.');
    return;
  }

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, CONTENT_WIDTH - 30);
    breakIfNeeded(cursor, wrapped.length * 14 + 8);

    doc.setFillColor(...ACCENT);
    doc.circle(MARGIN + 6, cursor.y - 3, 2.2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...BODY);

    for (const text of wrapped) {
      doc.text(text, MARGIN + 18, cursor.y);
      cursor.y += 14;
    }

    cursor.y += 4;
  }
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function heading(cursor: Cursor, text: string): void {
  const { doc } = cursor;

  breakIfNeeded(cursor, 44);

  doc.setFillColor(...ACCENT);
  doc.roundedRect(MARGIN, cursor.y - 9, 3, 14, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...BRAND);
  doc.text(text, MARGIN + 12, cursor.y + 2);

  cursor.y += 18;
}

function muted(cursor: Cursor, text: string): void {
  const { doc } = cursor;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);

  for (const line of doc.splitTextToSize(text, CONTENT_WIDTH)) {
    doc.text(line, MARGIN, cursor.y);
    cursor.y += 12;
  }
}

/** Starts a new page when what comes next would run off this one. */
function breakIfNeeded(cursor: Cursor, needed: number): void {
  if (cursor.y + needed <= FOOTER_TOP) {
    return;
  }

  cursor.doc.addPage();
  cursor.y = MARGIN + 14;
}

/** The same two lines on every page, so a loose sheet still says whose it is. */
function stampPages(doc: jsPDF, report: MonthlyEvaluation): void {
  const pages = doc.getNumberOfPages();

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);

    doc.setDrawColor(...RULE);
    doc.line(MARGIN, FOOTER_TOP + 12, PAGE_WIDTH - MARGIN, FOOTER_TOP + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `${report.studentName} · ${report.groupName} · ${monthName(report.month)}`,
      MARGIN,
      FOOTER_TOP + 26
    );
    doc.text('Academic & Operations Team — MindValley', PAGE_WIDTH / 2, FOOTER_TOP + 26, {
      align: 'center',
    });
    doc.text(`${page} of ${pages}`, PAGE_WIDTH - MARGIN, FOOTER_TOP + 26, { align: 'right' });
  }
}

function starsFor(report: MonthlyEvaluation, metric: EvaluationMetric): number {
  return report.ratings.find((rating) => rating.metric === metric)?.stars ?? 0;
}

/**
 * The course without its level, since the level has a column of its own.
 * "Artificial Intelligence Level 1" beside "Level 1" is the kind of repetition
 * that makes a reader wonder which one is wrong.
 */
function courseWithoutLevel(report: MonthlyEvaluation): string {
  return report.courseName.replace(/\s*[-–—]?\s*level\s*\d+\s*$/i, '').trim() || report.courseName;
}

/** Shrinks a value until it fits, so a long name cannot run into the next column. */
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
