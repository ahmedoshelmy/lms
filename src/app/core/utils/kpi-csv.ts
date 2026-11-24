import { KPI_BAND_LABELS, KPI_INDICATORS, KpiMonth } from '../interfaces/InstructorKpi';
import { indicatorBasis } from './kpi.utils';

/**
 * A month's KPIs as CSV, one row per instructor.
 *
 * Starts with a byte-order mark: without it Excel reads the file as the
 * machine's legacy code page and Arabic names come out as gibberish. Every
 * field is quoted, so a name or a reason with a comma or a quote in it stays
 * in its own column.
 */
export function kpiMonthCsv(month: KpiMonth): string {
  const header = ['Instructor', 'Month', 'Status'];
  for (const { label } of KPI_INDICATORS) {
    header.push(`${label} (%)`, `${label}: counted from`, `${label}: calculated (%)`);
    header.push(`${label}: adjustment reason`);
  }
  header.push('Overall (%)', 'Band');

  const rows = month.instructors.map((kpi) => {
    const row: (string | number | null)[] = [kpi.instructorName, month.month, month.status];
    for (const { key } of KPI_INDICATORS) {
      const indicator = kpi[key];
      row.push(
        indicator.value,
        indicatorBasis(key, indicator.detail as never),
        indicator.calculated,
        indicator.override?.reason ?? ''
      );
    }
    row.push(kpi.overall, kpi.band ? KPI_BAND_LABELS[kpi.band] : '');
    return row;
  });

  return '﻿' + [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export function kpiCsvFileName(month: string): string {
  return `instructor-kpis-${month}.csv`;
}

function csvField(value: string | number | null): string {
  if (value === null || value === undefined) return '""';
  const text = typeof value === 'number' ? String(Math.round(value * 10) / 10) : value;
  // A leading =, +, - or @ would be run as a formula by a spreadsheet.
  const safe = /^[=+\-@]/.test(text) && typeof value === 'string' ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
