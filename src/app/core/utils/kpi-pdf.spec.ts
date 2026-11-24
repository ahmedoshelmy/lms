import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { PAGE_HEIGHT, PAGE_WIDTH, drawMonthReport, stampPages } from './kpi-pdf';
import { kpiMonth, kpiRow } from './kpi-test-data';

function render(month = kpiMonth()) {
  const doc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, PAGE_HEIGHT], compress: false });
  drawMonthReport(doc, month);
  stampPages(doc, new Date(2026, 11, 1));
  return { doc, text: doc.output() };
}

describe('the all-instructors KPI PDF', () => {
  it('has the summary page, then a page for each instructor', () => {
    const month = kpiMonth({
      instructors: [kpiRow(), kpiRow({ instructorId: 8, instructorName: 'Ali Hassan' })],
    });
    expect(render(month).doc.getNumberOfPages()).toBe(3);
  });

  it('prints every adjustment with the figure it replaced and why', () => {
    const row = kpiRow();
    row.reports = {
      ...row.reports,
      value: 100,
      override: {
        value: 100,
        reason: 'Reports were late because of the outage',
        byName: 'Sara',
        at: '2026-11-30T10:00:00Z',
      },
    };
    const { text } = render(kpiMonth({ instructors: [row] }));
    expect(text).toContain('Adjusted from 80% by Sara');
    expect(text).toContain('Reports were late because of the outage');
  });

  it('says on its face when the month is not approved yet', () => {
    expect(render().text).toContain('NOT YET APPROVED');
    expect(render(kpiMonth({ status: 'Approved' })).text).not.toContain('NOT YET APPROVED');
  });
});
