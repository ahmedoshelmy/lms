/**
 * Calendar dates as the school means them: the day on the wall calendar where
 * the person is, not the day in Greenwich.
 *
 * `toISOString().slice(0, 10)` reads like a date but is the UTC date. East of
 * Greenwich -- Cairo is UTC+2 or +3 -- a local midnight is the previous day in
 * UTC, so a trial offered for Tuesday was booked for Monday, and any "today"
 * worked out between midnight and two or three in the morning was yesterday.
 * Use these instead.
 */

/** Local calendar date as "YYYY-MM-DD", matching how the API sends dates. */
export function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Local calendar month as "YYYY-MM". */
export function toIsoMonth(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}

/** Today's local date as "YYYY-MM-DD". */
export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

/**
 * A "YYYY-MM-DD" value -- from a date input, say -- as local midnight on that
 * day, or null if it is not one. `new Date("YYYY-MM-DD")` would read it as UTC
 * midnight instead, which is the previous evening anywhere west of Greenwich.
 */
export function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}
