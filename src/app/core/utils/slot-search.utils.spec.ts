import { describe, expect, it } from 'vitest';
import { slotSearchQuery } from './slot-search.utils';

/**
 * The sales desk sets a filter and expects the answer to respect it. Every
 * one of these is a filter that was once set on screen and never sent.
 */
describe('slotSearchQuery', () => {
  it('sends a named start time', () => {
    expect(slotSearchQuery({ startTime: '19:00' })).toContain('startTime=19%3A00');
  });

  it('sends every filter that was set', () => {
    const query = slotSearchQuery({
      fromDate: '2026-10-04',
      weeks: 12,
      instructorId: 7,
      dayOfWeek: 1,
      roomId: 3,
      maxBlockedWeeks: 0,
      startTime: '19:00',
      allStartTimes: true,
    });

    expect(query).toBe(
      '?fromDate=2026-10-04&weeks=12&instructorId=7&dayOfWeek=1&roomId=3' +
        '&maxBlockedWeeks=0&startTime=19%3A00&allStartTimes=true'
    );
  });

  it('keeps Sunday, which is nought', () => {
    expect(slotSearchQuery({ dayOfWeek: 0 })).toBe('?dayOfWeek=0');
  });

  it('asks nothing when nothing was set', () => {
    expect(slotSearchQuery({})).toBe('');
  });

  it('leaves out the filters that were not set', () => {
    const query = slotSearchQuery({ fromDate: '2026-10-04', weeks: 12 });

    expect(query).not.toContain('startTime');
    expect(query).not.toContain('instructorId');
    expect(query).not.toContain('allStartTimes');
  });
});
