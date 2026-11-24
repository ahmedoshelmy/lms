import { describe, expect, it } from 'vitest';
import { kpiMonthCsv } from './kpi-csv';
import { kpiMonth, kpiRow } from './kpi-test-data';

describe('kpiMonthCsv', () => {
  it('starts with a byte-order mark, so Excel reads Arabic names', () => {
    expect(kpiMonthCsv(kpiMonth()).startsWith('﻿')).toBe(true);
  });

  it('keeps a comma or quote inside its own column, and prints the adjustment reason', () => {
    const row = kpiRow({ instructorName: 'Adel, "Mona"' });
    row.reports = {
      ...row.reports,
      value: 90,
      override: { value: 90, reason: 'Two reports, one family', byName: 'Admin', at: '' },
    };
    const lines = kpiMonthCsv(kpiMonth({ instructors: [row] })).split('\r\n');

    expect(lines[1].startsWith('"Adel, ""Mona"""')).toBe(true);
    expect(lines[1]).toContain(
      '"90","8 of 10 on time (1 late, 1 missing)","80","Two reports, one family"'
    );
  });

  it('does not let a name start a spreadsheet formula', () => {
    const csv = kpiMonthCsv(
      kpiMonth({ instructors: [kpiRow({ instructorName: '=HYPERLINK()' })] })
    );
    expect(csv).toContain(`"'=HYPERLINK()"`);
  });

  it('leaves a missing figure empty rather than writing 0', () => {
    const row = kpiRow({ overall: null, band: null });
    expect(kpiMonthCsv(kpiMonth({ instructors: [row] }))).toMatch(/,"",""\r\n$/);
  });
});
