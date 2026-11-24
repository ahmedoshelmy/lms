import { ScheduleSession } from '../interfaces/ScheduleSession';

/** What one day of the loaded week actually holds. */
export interface DaySummary {
  date: Date;
  dayName: string;
  /** Classes going ahead: everything on the day that is not cancelled. */
  classes: number;
  cancelled: number;
  /** Different instructors teaching at least one of those classes. */
  instructors: number;
  /** Minutes of teaching in those classes. */
  teachingMinutes: number;
}

function isCancelled(session: ScheduleSession): boolean {
  return (session.status ?? '').toLowerCase().includes('cancel');
}

function minutesOf(session: ScheduleSession): number {
  if (session.durationMinutes && session.durationMinutes > 0) {
    return session.durationMinutes;
  }
  const start = new Date(session.startsAt).getTime();
  const end = session.endsAt ? new Date(session.endsAt).getTime() : NaN;
  return Number.isFinite(end) && end > start ? Math.round((end - start) / 60_000) : 0;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Seven days from the week's first day, counted only from the sessions given.
 *
 * Nothing is filled in. This replaces a summary that showed fixed figures
 * ("Saturday: 19") on any day it found empty and assumed every instructor was
 * free nine hours a day, so a quiet week read as a busy one.
 */
export function summariseWeek(sessions: readonly ScheduleSession[], weekStart: Date): DaySummary[] {
  const first = new Date(weekStart);
  first.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(first);
    date.setDate(first.getDate() + offset);

    const onDay = sessions.filter((s) => sameLocalDay(new Date(s.startsAt), date));
    const going = onDay.filter((s) => !isCancelled(s));

    return {
      date,
      dayName: date.toLocaleDateString('en-GB', { weekday: 'long' }),
      classes: going.length,
      cancelled: onDay.length - going.length,
      instructors: new Set(going.map((s) => s.instructorId).filter((id) => !!id)).size,
      teachingMinutes: going.reduce((sum, s) => sum + minutesOf(s), 0),
    };
  });
}

/**
 * The busiest day, and the quietest day that still has classes -- a day with
 * none, such as the weekly day off, says nothing about how the week is spread.
 * Both are null when the week is empty. Ties go to the earlier day.
 */
export function busiestAndQuietest(days: readonly DaySummary[]): {
  busiest: DaySummary | null;
  quietest: DaySummary | null;
} {
  const teaching = days.filter((d) => d.classes > 0);
  if (!teaching.length) {
    return { busiest: null, quietest: null };
  }

  return {
    busiest: teaching.reduce((a, b) => (b.classes > a.classes ? b : a)),
    quietest: teaching.reduce((a, b) => (b.classes < a.classes ? b : a)),
  };
}
