import { describe, expect, it } from 'vitest';
import {
  canApproveMonth,
  formatPercent,
  indicatorBasis,
  kpiPhase,
  monthsBefore,
  recentMonths,
  weightsAreValid,
} from './kpi.utils';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10);

describe('kpiPhase', () => {
  it('is live to the 28th, in review from the 29th, closed once the month is over', () => {
    expect(kpiPhase('2026-11', day(2026, 11, 28))).toBe('Live');
    expect(kpiPhase('2026-11', day(2026, 11, 29))).toBe('Review');
    expect(kpiPhase('2026-11', day(2026, 11, 30))).toBe('Review');
    expect(kpiPhase('2026-11', day(2026, 12, 1))).toBe('Closed');
    expect(kpiPhase('2026-12', day(2026, 11, 30))).toBe('Future');
  });

  it('opens the review in a short February too', () => {
    expect(kpiPhase('2027-02', day(2027, 2, 28))).toBe('Live');
    expect(kpiPhase('2027-02', day(2027, 3, 1))).toBe('Closed');
  });

  it('allows approval only once the month has ended: reports are due on its last day', () => {
    expect(canApproveMonth('2026-11', day(2026, 11, 30))).toBe(false);
    expect(canApproveMonth('2026-11', day(2026, 12, 1))).toBe(true);
  });
});

describe('months', () => {
  it('counts back across the turn of the year', () => {
    expect(recentMonths(day(2027, 2, 10), 4)).toEqual(['2027-02', '2027-01', '2026-12', '2026-11']);
    expect(monthsBefore('2027-01', 5)).toBe('2026-08');
  });
});

describe('formatPercent', () => {
  it('drops a needless .0, keeps one decimal, and dashes a missing figure', () => {
    expect(formatPercent(95)).toBe('95%');
    expect(formatPercent(92.46)).toBe('92.5%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('indicatorBasis', () => {
  it('says what each figure was counted from', () => {
    expect(indicatorBasis('reports', { due: 12, onTime: 10, late: 1, missing: 1 })).toBe(
      '10 of 12 on time (1 late, 1 missing)'
    );
    expect(
      indicatorBasis('registers', { taught: 20, onTime: 20, late: 0, recordedByAdmin: 0, never: 0 })
    ).toBe('20 of 20 on time');
    expect(indicatorBasis('cancellations', { assigned: 40, cancelledByThem: 2 })).toBe(
      '2 of 40 cancelled by them'
    );
    expect(indicatorBasis('cancellations', { assigned: 0, cancelledByThem: 0 })).toBe(
      'No classes assigned'
    );
  });
});

describe('weightsAreValid', () => {
  it('wants whole numbers adding up to 100', () => {
    expect(weightsAreValid({ reports: 40, registers: 40, cancellations: 20 })).toBe(true);
    expect(weightsAreValid({ reports: 40, registers: 40, cancellations: 10 })).toBe(false);
    expect(weightsAreValid({ reports: 33.5, registers: 33.5, cancellations: 33 })).toBe(false);
    expect(weightsAreValid({ reports: 110, registers: -10, cancellations: 0 })).toBe(false);
  });
});
