import { ScheduleSession } from '../interfaces/ScheduleSession';
import { toIsoDate } from './date.utils';

/** A class without an end or a length on record is taken to be the usual 90 minutes. */
const DEFAULT_MINUTES = 90;

/** Where a session ends: its recorded end, else its start plus its length. */
export function sessionEnd(session: ScheduleSession): Date {
  if (session.endsAt) return new Date(session.endsAt);
  const start = new Date(session.startsAt).getTime();
  return new Date(start + (session.durationMinutes || DEFAULT_MINUTES) * 60_000);
}

export function isCancelledSession(session: ScheduleSession): boolean {
  return (session.status ?? '').toLowerCase().includes('cancel');
}

/**
 * The hours of its day a session takes up, as local clock hours: every hour
 * [h:00, h+1:00) it overlaps. 10:00-11:30 is [10, 11]; 10:30-11:00 is [10].
 *
 * The matrices used to look only at the hour a class starts, so the second
 * hour of a 90-minute class showed as free -- to sales looking for a slot too.
 */
export function hoursCovered(session: ScheduleSession): number[] {
  const start = new Date(session.startsAt);
  const end = sessionEnd(session);
  const first = start.getHours();
  // An end on the hour does not reach into that hour.
  const endsOnTheHour = end.getMinutes() === 0 && end.getSeconds() === 0;
  const sameDay = toIsoDate(end) === toIsoDate(start);
  const last = sameDay ? end.getHours() - (endsOnTheHour ? 1 : 0) : 23;

  const hours: number[] = [];
  for (let h = first; h <= Math.max(first, last); h++) hours.push(h);
  return hours;
}

export function slotKey(instructorId: number, date: Date | string, hour: number): string {
  const day = typeof date === 'string' ? date : toIsoDate(date);
  return `${instructorId}|${day}|${hour}`;
}

export interface SlotEntry {
  session: ScheduleSession;
  /** This is the hour the session begins in, rather than one it runs on into. */
  starts: boolean;
}

/**
 * Every (instructor, day, hour) a session occupies, for looking cells up in a
 * matrix. Built once per change of the sessions, instead of each cell
 * searching every session -- for a week view, 7 days x 13 hours x every
 * session, again on each render.
 *
 * Where two sessions share a cell (a double booking), the one that begins in
 * that hour wins, and otherwise the first in the list -- as before.
 */
export function indexSessionsBySlot(
  sessions: readonly ScheduleSession[],
  options: { skipCancelled?: boolean } = {}
): Map<string, SlotEntry> {
  const index = new Map<string, SlotEntry>();
  for (const session of sessions) {
    if (!session.startsAt || !session.instructorId) continue;
    if (options.skipCancelled && isCancelledSession(session)) continue;

    const day = toIsoDate(new Date(session.startsAt));
    hoursCovered(session).forEach((hour, i) => {
      const key = slotKey(session.instructorId, day, hour);
      const existing = index.get(key);
      const starts = i === 0;
      if (!existing || (!existing.starts && starts)) {
        index.set(key, { session, starts });
      }
    });
  }
  return index;
}
