import { describe, expect, it } from 'vitest';
import { ScheduleSession } from '../interfaces/ScheduleSession';
import { hoursCovered, indexSessionsBySlot, slotKey } from './session-slots.utils';

/** Local times on 2026-11-28, as the browser shows them. */
function session(
  id: number,
  start: string,
  end: string | null,
  extra: Partial<ScheduleSession> = {}
): ScheduleSession {
  return {
    id,
    instructorId: 3,
    startsAt: new Date(`2026-11-28T${start}:00`).toISOString(),
    endsAt: end ? new Date(`2026-11-28T${end}:00`).toISOString() : '',
    durationMinutes: 0,
    status: 'Scheduled',
    ...extra,
  } as ScheduleSession;
}

describe('hoursCovered', () => {
  it('counts every hour a class overlaps, not only the one it starts in', () => {
    expect(hoursCovered(session(1, '10:00', '11:30'))).toEqual([10, 11]);
    expect(hoursCovered(session(1, '10:30', '12:00'))).toEqual([10, 11]);
    expect(hoursCovered(session(1, '10:30', '11:00'))).toEqual([10]);
  });

  it('takes a class with no end on record as 90 minutes', () => {
    expect(hoursCovered(session(1, '15:00', null))).toEqual([15, 16]);
    expect(hoursCovered(session(1, '15:00', null, { durationMinutes: 45 }))).toEqual([15]);
  });
});

describe('indexSessionsBySlot', () => {
  it('books the second hour of a 90-minute class', () => {
    const index = indexSessionsBySlot([session(1, '10:00', '11:30')]);

    expect(index.get(slotKey(3, '2026-11-28', 10))).toMatchObject({ starts: true });
    expect(index.get(slotKey(3, '2026-11-28', 11))).toMatchObject({ starts: false });
    expect(index.has(slotKey(3, '2026-11-28', 12))).toBe(false);
  });

  it('leaves a cancelled class out when asked, for availability', () => {
    const cancelled = session(1, '10:00', '11:00', { status: 'Cancelled' });

    expect(indexSessionsBySlot([cancelled]).size).toBe(1);
    expect(indexSessionsBySlot([cancelled], { skipCancelled: true }).size).toBe(0);
  });

  it('shows the class that starts in a shared hour over one running on into it', () => {
    const long = session(1, '10:00', '11:30');
    const next = session(2, '11:00', '12:00');

    const index = indexSessionsBySlot([long, next]);

    expect(index.get(slotKey(3, '2026-11-28', 11))?.session.id).toBe(2);
  });
});
