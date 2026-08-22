import { InstructorAvailability, InstructorTimeOff, toDayNumber } from '../interfaces/Availability';

/**
 * Whether an instructor has declared themselves available for a given hour.
 *
 * The schedule matrices used to assume 09:00-18:00 for everybody, which could
 * not tell "free" apart from "not working that day" — the distinction the whole
 * availability feature exists to record. This reads what was actually declared.
 */
export function isDeclaredAvailable(
  windows: InstructorAvailability[],
  instructorId: number,
  date: Date,
  hour: number
): boolean {
  const day = date.getDay();
  const iso = toIsoDate(date);

  return windows.some((w) => {
    if (w.instructorId !== instructorId) return false;
    if (toDayNumber(w.dayOfWeek) !== day) return false;
    // A window that had not started, or has since ended, does not apply.
    if (w.effectiveFrom > iso) return false;
    if (w.effectiveTo && w.effectiveTo < iso) return false;

    // The hour counts as covered when the window overlaps any of it, so a
    // window ending at 16:30 still colours the 16:00 cell.
    return minutesOf(w.startTime) < (hour + 1) * 60 && minutesOf(w.endTime) > hour * 60;
  });
}

/** Whether leave covers this hour — a whole day, or part of one. */
export function isOnLeave(
  timeOff: InstructorTimeOff[],
  instructorId: number,
  date: Date,
  hour: number
): boolean {
  const iso = toIsoDate(date);

  return timeOff.some((t) => {
    if (t.instructorId !== instructorId) return false;
    if (t.fromDate > iso || t.toDate < iso) return false;
    if (!t.startTime || !t.endTime) return true;
    return minutesOf(t.startTime) < (hour + 1) * 60 && minutesOf(t.endTime) > hour * 60;
  });
}

/** Local calendar date as "YYYY-MM-DD", matching how the API sends dates. */
export function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
