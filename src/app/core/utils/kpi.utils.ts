import {
  CancellationsDetail,
  KpiIndicatorKey,
  KpiWeights,
  RegistersDetail,
  ReportsDetail,
} from '../interfaces/InstructorKpi';
import { toIsoMonth } from './date.utils';

/** The day each month's review opens. */
export const KPI_REVIEW_DAY = 29;

/**
 * Where a month stands on a given day.
 *
 * - Future: not begun.
 * - Live: the 1st to the 28th -- figures are still moving.
 * - Review: the 29th to the month's last day -- admins look, adjust, prepare.
 * - Closed: the month is over and every deadline in it has passed (reports
 *   are due by the last day), so it can be approved.
 */
export type KpiPhase = 'Future' | 'Live' | 'Review' | 'Closed';

export function kpiPhase(month: string, today: Date): KpiPhase {
  const current = toIsoMonth(today);
  if (month > current) return 'Future';
  if (month < current) return 'Closed';
  return today.getDate() >= KPI_REVIEW_DAY ? 'Review' : 'Live';
}

/**
 * When a month can be approved: the 2nd of the next month. Its last classes'
 * registers can be taken for a day after it ends, and approving before then
 * would freeze them as never taken. The server refuses it earlier too.
 */
export function approvalOpens(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 2);
}

export function canApproveMonth(month: string, today: Date): boolean {
  return kpiPhase(month, today) === 'Closed' && today >= approvalOpens(month);
}

/** `count` months, newest first, ending with the month `today` is in. */
export function recentMonths(today: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(toIsoMonth(new Date(today.getFullYear(), today.getMonth() - i, 1)));
  }
  return out;
}

/** The month `n` months before `month` (YYYY-MM). */
export function monthsBefore(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return toIsoMonth(new Date(y, m - 1 - n, 1));
}

/** "November 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** "95%", "92.5%", or a dash when there was nothing to measure. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

type DetailFor = {
  reports: ReportsDetail;
  registers: RegistersDetail;
  cancellations: CancellationsDetail;
};

/**
 * What a figure was counted from, in a line: a percentage means little
 * without it -- 100% of one class is not 100% of forty.
 */
export function indicatorBasis<K extends KpiIndicatorKey>(key: K, detail: DetailFor[K]): string {
  switch (key) {
    case 'reports': {
      const d = detail as ReportsDetail;
      if (!d.due) return 'No reports due';
      const extra = [d.late && `${d.late} late`, d.missing && `${d.missing} missing`].filter(
        Boolean
      );
      return `${d.onTime} of ${d.due} on time` + (extra.length ? ` (${extra.join(', ')})` : '');
    }
    case 'registers': {
      const d = detail as RegistersDetail;
      if (!d.taught) return 'No classes taught';
      const extra = [d.late && `${d.late} late`, d.never && `${d.never} never taken`].filter(
        Boolean
      );
      return `${d.onTime} of ${d.taught} on time` + (extra.length ? ` (${extra.join(', ')})` : '');
    }
    default: {
      const d = detail as CancellationsDetail;
      if (!d.assigned) return 'No classes assigned';
      return d.cancelledByThem
        ? `${d.cancelledByThem} of ${d.assigned} cancelled by them`
        : `All ${d.assigned} kept`;
    }
  }
}

/** Whole numbers from 0 to 100 that add up to 100. */
export function weightsAreValid(weights: KpiWeights): boolean {
  const values = [weights.reports, weights.registers, weights.cancellations];
  return (
    values.every((v) => Number.isInteger(v) && v >= 0 && v <= 100) &&
    values.reduce((a, b) => a + b, 0) === 100
  );
}
