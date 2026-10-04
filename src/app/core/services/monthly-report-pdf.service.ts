import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MonthlyEvaluation } from '../interfaces/MonthlyEvaluation';
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  drawMonthlyReport,
  monthlyReportFileName,
} from '../utils/monthly-report-pdf';

/**
 * Builds the monthly report PDF in the browser.
 *
 * jsPDF is loaded on demand, as the certificates do: it is a large library and
 * most people open the reports list without ever saving one.
 */
@Injectable({ providedIn: 'root' })
export class MonthlyReportPdfService {
  private readonly platformId = inject(PLATFORM_ID);

  async save(report: MonthlyEvaluation): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [PAGE_WIDTH, PAGE_HEIGHT],
      compress: true,
    });

    drawMonthlyReport(doc, report);
    doc.save(monthlyReportFileName(report));
  }
}
