import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromIsoDate, toIsoDate, toIsoMonth, todayIsoDate } from './date.utils';

describe('toIsoDate', () => {
  it('gives the local calendar date, even at local midnight', () => {
    // Local midnight is the previous day in UTC anywhere east of Greenwich,
    // which is exactly what toISOString().slice(0, 10) got wrong.
    expect(toIsoDate(new Date(2026, 10, 24, 0, 0, 0))).toBe('2026-11-24');
    expect(toIsoDate(new Date(2026, 10, 24, 23, 59, 59))).toBe('2026-11-24');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('toIsoMonth', () => {
  it('gives the local month, even in the first minutes of it', () => {
    expect(toIsoMonth(new Date(2026, 11, 1, 0, 30))).toBe('2026-12');
  });
});

describe('todayIsoDate', () => {
  afterEach(() => vi.useRealTimers());

  it('is today on the local calendar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 24, 1, 15));

    expect(todayIsoDate()).toBe('2026-11-24');
  });
});

describe('fromIsoDate', () => {
  it('reads a date as local midnight on that day', () => {
    const date = fromIsoDate('2026-11-24');

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(24);
    expect(date?.getHours()).toBe(0);
  });

  it('round-trips with toIsoDate', () => {
    expect(toIsoDate(fromIsoDate('2026-03-29')!)).toBe('2026-03-29');
  });

  it('refuses anything that is not a date', () => {
    expect(fromIsoDate('')).toBeNull();
    expect(fromIsoDate('24/11/2026')).toBeNull();
  });
});
