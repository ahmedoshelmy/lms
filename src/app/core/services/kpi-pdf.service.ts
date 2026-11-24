import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { InstructorKpi, KpiHistoryPoint, KpiMonth } from '../interfaces/InstructorKpi';
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  drawInstructorSheet,
  drawMonthReport,
  kpiMonthFileName,
  kpiSheetFileName,
  stampPages,
} from '../utils/kpi-pdf';

export interface KpiPdf {
  blob: Blob;
  fileName: string;
}

/**
 * KPI reports as PDF, made in the browser. jsPDF is loaded on demand, as for
 * certificates and monthly reports. The same file is saved or sent to the
 * owner, so what the admin checked is what the owner gets.
 */
@Injectable({ providedIn: 'root' })
export class KpiPdfService {
  private readonly platformId = inject(PLATFORM_ID);

  async instructorSheet(
    month: KpiMonth,
    kpi: InstructorKpi,
    history: KpiHistoryPoint[] = []
  ): Promise<KpiPdf> {
    const doc = await this.newDocument();
    drawInstructorSheet(doc, month, kpi, history);
    stampPages(doc, new Date());
    return { blob: doc.output('blob'), fileName: kpiSheetFileName(kpi) };
  }

  async monthReport(month: KpiMonth): Promise<KpiPdf> {
    const doc = await this.newDocument();
    drawMonthReport(doc, month);
    stampPages(doc, new Date());
    return { blob: doc.output('blob'), fileName: kpiMonthFileName(month.month) };
  }

  /** Hands the browser a file to save: a PDF from here, or the CSV. */
  download(blob: Blob, fileName: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // After the click has been handled, not before: revoking at once can
    // cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async newDocument() {
    const { jsPDF } = await import('jspdf');
    return new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [PAGE_WIDTH, PAGE_HEIGHT],
      compress: true,
    });
  }
}
