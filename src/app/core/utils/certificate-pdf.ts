import type { jsPDF } from 'jspdf';
import { Certificate } from '../interfaces/Certificate';

/**
 * Draws certificates onto a jsPDF document.
 *
 * The geometry here is the same geometry the on-screen sheet uses, expressed in
 * the units it was measured in. The original template is an A4 landscape page
 * of 842x595pt, and every figure below is a point coordinate taken from it —
 * the SCSS converts the same numbers to cqw/% for the browser
 * (`certificate-dialog.component.scss`). Change one and change the other.
 *
 * jsPDF puts the origin at the top left and places text on its baseline, which
 * is exactly how these were measured, so they are used as-is.
 */

export const CERT_PAGE_WIDTH = 842;
export const CERT_PAGE_HEIGHT = 595;

const CENTER = CERT_PAGE_WIDTH / 2;

/** Colours sampled from the original artwork. */
const INK: [number, number, number] = [0x23, 0x1f, 0x20];
const BODY: [number, number, number] = [0, 0, 0];
const ACCENT: [number, number, number] = [0x6b, 0x31, 0x72];

/** Font registered into the document for the two signature lines. */
export const SIGNATURE_FONT = 'Pacifico';

const LAYOUT = {
  title: { baseline: 136.8, size: 49.3, center: CENTER },
  subtitle: { baseline: 177.7, size: 25.5, center: CENTER },
  // Nudged right to sit centred on the rule drawn in the artwork.
  presented: { baseline: 199.2, size: 14.0, center: 427, charSpace: 1.05 },
  recipient: { baseline: 263.4, size: 47.8, center: CENTER, maxWidth: 740 },
  // Baselines are centred on this point so a longer sentence grows evenly
  // instead of running into the line below.
  body: { center: CENTER, midBaseline: 372.15, leading: 25.3, size: 15.3, maxWidth: 741 },
  facts: { baseline: 410.0, size: 15.3, center: CENTER },
  role: { baseline: 454.3, size: 11.7, charSpace: 0.35 },
  signature: { baseline: 482.5, size: 19.0, maxWidth: 200 },
  /** Centres of the two signature rules drawn in the artwork. */
  columns: { instructor: 271.55, supervisor: 577.05 },
} as const;

export interface CertificatePdfAssets {
  /** Data URL for the background artwork. */
  background: string;
  /** Base64 TTF for the signature font, omitted to fall back to Helvetica. */
  signatureFontBase64?: string;
}

/** Shrinks a size until the text fits, so a long name cannot run off the page. */
function fitSize(doc: jsPDF, text: string, maxWidth: number, size: number): number {
  let current = size;
  doc.setFontSize(current);
  while (current > 8 && doc.getTextWidth(text) > maxWidth) {
    current -= 0.5;
    doc.setFontSize(current);
  }
  return current;
}

function setColor(doc: jsPDF, [r, g, b]: readonly [number, number, number]): void {
  doc.setTextColor(r, g, b);
}

/** Matches the `date: 'longDate'` pipe used by the on-screen preview. */
export function formatCertificateDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** The sentence in the middle of the certificate. */
export function certificateSentence(certificate: Certificate): string {
  // The course title already carries its level ("Python level 1"), so the level
  // is deliberately not repeated here.
  return `This Certificate is awarded to ${certificate.studentName} for the successful completion of the ${certificate.courseTitle} course.`;
}

/** Draws the "Duration: N weeks, Awarded on: date" line, bolding the labels. */
function drawFacts(doc: jsPDF, certificate: Certificate): void {
  const segments: { text: string; bold: boolean }[] = [];

  if (certificate.printedDurationWeeks) {
    segments.push({ text: 'Duration: ', bold: true });
    segments.push({ text: `${certificate.printedDurationWeeks} weeks, `, bold: false });
  }
  segments.push({ text: 'Awarded on: ', bold: true });
  segments.push({ text: formatCertificateDate(certificate.printedDate), bold: false });

  doc.setFontSize(LAYOUT.facts.size);
  setColor(doc, BODY);

  const widths = segments.map((segment) => {
    doc.setFont('helvetica', segment.bold ? 'bold' : 'normal');
    return doc.getTextWidth(segment.text);
  });

  let x = LAYOUT.facts.center - widths.reduce((sum, w) => sum + w, 0) / 2;
  segments.forEach((segment, index) => {
    doc.setFont('helvetica', segment.bold ? 'bold' : 'normal');
    doc.text(segment.text, x, LAYOUT.facts.baseline);
    x += widths[index];
  });
}

/** Draws one certificate onto the current page. */
export function drawCertificatePage(
  doc: jsPDF,
  certificate: Certificate,
  assets: CertificatePdfAssets,
  hasSignatureFont: boolean
): void {
  // A single alias keeps one copy of the artwork in the file no matter how many
  // pages it is drawn on.
  doc.addImage(
    assets.background,
    'PNG',
    0,
    0,
    CERT_PAGE_WIDTH,
    CERT_PAGE_HEIGHT,
    'cert-bg',
    'FAST'
  );

  doc.setFont('helvetica', 'normal');
  setColor(doc, INK);

  doc.setFontSize(LAYOUT.title.size);
  doc.text('CERTIFICATE', LAYOUT.title.center, LAYOUT.title.baseline, { align: 'center' });

  doc.setFontSize(LAYOUT.subtitle.size);
  doc.text('OF EXCELLENCE', LAYOUT.subtitle.center, LAYOUT.subtitle.baseline, { align: 'center' });

  doc.setFontSize(LAYOUT.presented.size);
  doc.setCharSpace(LAYOUT.presented.charSpace);
  doc.text('PROUDLY PRESENTED TO', LAYOUT.presented.center, LAYOUT.presented.baseline, {
    align: 'center',
  });
  doc.setCharSpace(0);

  setColor(doc, ACCENT);
  fitSize(doc, certificate.studentName, LAYOUT.recipient.maxWidth, LAYOUT.recipient.size);
  doc.text(certificate.studentName, LAYOUT.recipient.center, LAYOUT.recipient.baseline, {
    align: 'center',
  });

  setColor(doc, BODY);
  doc.setFontSize(LAYOUT.body.size);
  const lines: string[] = doc.splitTextToSize(
    certificateSentence(certificate),
    LAYOUT.body.maxWidth
  );
  const firstBaseline = LAYOUT.body.midBaseline - ((lines.length - 1) * LAYOUT.body.leading) / 2;
  lines.forEach((line, index) => {
    doc.text(line, LAYOUT.body.center, firstBaseline + index * LAYOUT.body.leading, {
      align: 'center',
    });
  });

  drawFacts(doc, certificate);

  doc.setFont('helvetica', 'normal');
  setColor(doc, INK);
  doc.setFontSize(LAYOUT.role.size);
  doc.setCharSpace(LAYOUT.role.charSpace);
  doc.text('INSTRUCTOR', LAYOUT.columns.instructor, LAYOUT.role.baseline, { align: 'center' });
  doc.text('SUPERVISOR', LAYOUT.columns.supervisor, LAYOUT.role.baseline, { align: 'center' });
  doc.setCharSpace(0);

  setColor(doc, ACCENT);
  doc.setFont(hasSignatureFont ? SIGNATURE_FONT : 'helvetica', 'normal');
  const signatures: [string, number][] = [
    [certificate.instructorName || '', LAYOUT.columns.instructor],
    [certificate.supervisorName, LAYOUT.columns.supervisor],
  ];
  signatures.forEach(([name, center]) => {
    if (!name) return;
    fitSize(doc, name, LAYOUT.signature.maxWidth, LAYOUT.signature.size);
    doc.text(name, center, LAYOUT.signature.baseline, { align: 'center' });
  });
}

/** Fills a document with one page per certificate. */
export function drawCertificateDocument(
  doc: jsPDF,
  certificates: Certificate[],
  assets: CertificatePdfAssets
): void {
  let hasSignatureFont = false;
  if (assets.signatureFontBase64) {
    doc.addFileToVFS('Pacifico-Regular.ttf', assets.signatureFontBase64);
    doc.addFont('Pacifico-Regular.ttf', SIGNATURE_FONT, 'normal');
    hasSignatureFont = true;
  }

  certificates.forEach((certificate, index) => {
    if (index > 0) {
      doc.addPage([CERT_PAGE_WIDTH, CERT_PAGE_HEIGHT], 'landscape');
    }
    drawCertificatePage(doc, certificate, assets, hasSignatureFont);
  });
}

/**
 * Characters reserved in filenames on Windows: < > : " / \ | ? *
 * Listed by code point so the set carries no escape sequences of its own.
 */
const RESERVED_FILENAME_CODES = new Set([60, 62, 58, 34, 47, 92, 124, 63, 42]);

/** Strips characters that are not allowed in a filename on Windows or macOS. */
function sanitizeFilePart(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && !RESERVED_FILENAME_CODES.has(code);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filename for one certificate, e.g. `Certificate - Ahmed Saeed - Python level 1 - 3F9A.pdf`.
 *
 * The trailing token is the check segment of the serial. A student can hold the
 * same course title in two different groups, so name and course alone are not
 * unique — that token keeps one download from overwriting another.
 */
export function certificateFileName(certificate: Certificate): string {
  const token = certificate.serial.split('-').pop() || '';
  const parts = [
    'Certificate',
    sanitizeFilePart(certificate.studentName),
    sanitizeFilePart(certificate.courseTitle),
    token,
  ].filter(Boolean);
  return `${parts.join(' - ')}.pdf`;
}
