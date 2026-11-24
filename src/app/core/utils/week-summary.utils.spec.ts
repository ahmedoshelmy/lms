import { describe, expect, it } from 'vitest';
import { ScheduleSession } from '../interfaces/ScheduleSession';
import { busiestAndQuietest, summariseWeek } from './week-summary.utils';

/** A class on a local date and time, so the test means the same in any time zone. */
function session(day: number, hour: number, extra: Partial<ScheduleSession> = {}): ScheduleSession {
  const start = new Date(2026, 10, day, hour, 0, 0);
  return {
    id: day * 100 + hour,
    instructorId: 1,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 90 * 60_000).toISOString(),
    durationMinutes: 90,
    status: 'Scheduled',
    ...extra,
  } as ScheduleSession;
}

// Saturday 21 November 2026 starts the week.
const WEEK_START = new Date(2026, 10, 21);

describe('summariseWeek', () => {
  it('reports an empty week as empty rather than filling it in', () => {
    const days = summariseWeek([], WEEK_START);

    expect(days).toHaveLength(7);
    expect(days.every((d) => d.classes === 0 && d.teachingMinutes === 0)).toBe(true);
    expect(days[0].dayName).toBe('Saturday');
  });

  it('counts classes, cancellations, instructors and teaching time per day', () => {
    const days = summariseWeek(
      [
        session(21, 10, { instructorId: 1 }),
        session(21, 12, { instructorId: 2 }),
        session(21, 14, { instructorId: 2, status: 'Cancelled' }),
        session(23, 10, { instructorId: 3, durationMinutes: 60 }),
      ],
      WEEK_START
    );

    expect(days[0]).toMatchObject({
      classes: 2,
      cancelled: 1,
      instructors: 2,
      teachingMinutes: 180,
    });
    expect(days[1]).toMatchObject({ classes: 0, cancelled: 0 });
    expect(days[2]).toMatchObject({ classes: 1, instructors: 1, teachingMinutes: 60 });
  });

  it('ignores sessions outside the week', () => {
    const days = summariseWeek([session(28, 10), session(20, 10)], WEEK_START);

    expect(days.reduce((n, d) => n + d.classes, 0)).toBe(0);
  });
});

describe('busiestAndQuietest', () => {
  it('names the busiest day and the quietest day that still has classes', () => {
    const days = summariseWeek(
      [
        session(21, 10),
        session(21, 12),
        session(21, 14),
        session(22, 10),
        session(24, 9),
        session(24, 11),
      ],
      WEEK_START
    );

    const { busiest, quietest } = busiestAndQuietest(days);

    expect(busiest?.dayName).toBe('Saturday');
    expect(quietest?.dayName).toBe('Sunday');
  });

  it('names nothing for an empty week', () => {
    expect(busiestAndQuietest(summariseWeek([], WEEK_START))).toEqual({
      busiest: null,
      quietest: null,
    });
  });
});
