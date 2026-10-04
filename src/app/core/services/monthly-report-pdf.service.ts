import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MonthlyEvaluation } from '../interfaces/MonthlyEvaluation';
import {
  MonthlyReportAssets,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  drawMonthlyReport,
  monthlyReportFileName,
} from '../utils/monthly-report-pdf';

const LOGO_URL = '/report/mindvalley-logo.png';

/**
 * Builds the monthly report PDF in the browser.
 *
 * jsPDF is loaded on demand, as the certificates do: it is a large library and
 * most people open the reports list without ever saving one.
 */
@Injectable({ providedIn: 'root' })
export class MonthlyReportPdfService {
  private readonly platformId = inject(PLATFORM_ID);
  private assets: MonthlyReportAssets | null = null;

  async save(report: MonthlyEvaluation): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const [{ jsPDF }, assets] = await Promise.all([import('jspdf'), this.loadAssets()]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [PAGE_WIDTH, PAGE_HEIGHT],
      compress: true,
    });

    drawMonthlyReport(doc, report, assets);
    doc.save(monthlyReportFileName(report));
  }

  /**
   * The school's mark, fetched once and kept.
   *
   * A missing logo is survivable — the masthead falls back to the wordmark —
   * and a report that will not save because an image is missing would be a
   * worse failure than a report without a picture on it.
   */
  private async loadAssets(): Promise<MonthlyReportAssets> {
    if (this.assets) return this.assets;

    try {
      this.assets = { logo: await loadImage(LOGO_URL) };
    } catch {
      this.assets = {};
    }

    return this.assets;
  }
}

async function loadImage(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const dataUrl = `data:image/png;base64,${toBase64(buffer)}`;

  // Measured rather than assumed, so the mark keeps its proportions if it is
  // ever replaced with a differently shaped one.
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`Could not read ${url}`));
    image.src = dataUrl;
  });

  return { dataUrl, ...size };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  // Chunked to keep the argument list well inside the call-stack limit.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}
