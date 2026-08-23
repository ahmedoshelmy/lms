/**
 * Turning a time into something a person reads.
 *
 * Pure on purpose. Which clock somebody prefers is Angular's business —
 * a signal, remembered in the browser — but how 16:30 becomes "4:30 pm" is
 * arithmetic, and arithmetic should be testable without standing up a
 * component to ask it.
 */

/**
 * A wall-clock string — "16:30" or "16:30:00", the shape the schedule and
 * availability tables store — rather than a moment in time.
 *
 * Kept apart from {@link formatMoment} because turning one into a Date needs a
 * date to attach it to, and picking today silently moves the reading across a
 * daylight-saving boundary twice a year.
 */
export function formatClockString(value: string | null | undefined, use12Hour: boolean): string {
  if (!value) return '';

  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour);

  // Better to show the raw value than an empty cell, which hides a data fault
  // behind something that looks deliberate.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return value;

  const minute = (rawMinute ?? '00').padStart(2, '0');

  if (!use12Hour) {
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  // 12 % 12 is 0, which is how midday becomes "0:30 pm" and midnight
  // disappears entirely.
  const twelve = hour % 12 === 0 ? 12 : hour % 12;

  return `${twelve}:${minute} ${hour < 12 ? 'am' : 'pm'}`;
}

/** A moment in time as a clock reading. */
export function formatMoment(value: string | Date | null | undefined, use12Hour: boolean): string {
  if (!value) return '';

  const when = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(when.getTime())) return '';

  return when.toLocaleTimeString('en-GB', {
    hour: use12Hour ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12: use12Hour,
  });
}
