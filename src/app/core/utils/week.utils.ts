/**
 * The school week, defined once.
 *
 * It runs Saturday to Friday, as the schedule has always shown it. Three
 * screens used to work it out three ways -- Saturday on the schedule, Monday
 * in the session editors' "is this a later week?" check, Sunday in the
 * attendance list's "this week" filter -- so moving a class from Saturday to
 * the Monday of the same school week was treated as a move into next week.
 *
 * To change the first day, change SCHOOL_WEEK_STARTS_ON here.
 */

/** Day of the week the school week starts on, as Date.getDay() counts (0 = Sunday). */
export const SCHOOL_WEEK_STARTS_ON = 6; // Saturday

/** Local midnight at the start of the school week that contains `date`. */
export function startOfSchoolWeek(date: Date): Date {
  const start = new Date(date);
  const back = (start.getDay() - SCHOOL_WEEK_STARTS_ON + 7) % 7;
  start.setDate(start.getDate() - back);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Whether two moments fall in the same school week. */
export function isSameSchoolWeek(a: Date, b: Date): boolean {
  return startOfSchoolWeek(a).getTime() === startOfSchoolWeek(b).getTime();
}
