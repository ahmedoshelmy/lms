/**
 * How far a course has got — the one place the front end works it out.
 *
 * `currentSessionNumber` is the session the course **owes next**, not the count
 * it has taught. That single field was read three different ways across eight
 * screens: correctly on the group page and the student's own record, as a
 * count of completed sessions on the groups list, and as a percentage of the
 * course on the weekly schedule. So the groups tab and the group's own page
 * reported different numbers for the same group, and both looked plausible.
 *
 * The server has the same rules in LMS.Core.CourseProgress. These mirror them,
 * and nothing else should do this arithmetic inline.
 */

/** The fields these rules need. Anything course-shaped satisfies it. */
export interface CourseProgressLike {
  currentSessionNumber?: number | null;
  totalSessions?: number | null;
  sessionCount?: number | null;
  isCompleted?: boolean | null;
}

/** A course's length, whichever field carries it. */
export function courseLength(course: CourseProgressLike): number {
  return Math.max(0, course.totalSessions || course.sessionCount || 0);
}

/**
 * How many sessions are behind it.
 *
 * A finished course has taught all of them — its progress sits one past the
 * length, which is how "the last one is due" and "they are all done" stopped
 * sharing a value.
 */
export function sessionsTaught(course: CourseProgressLike): number {
  const total = courseLength(course);
  if (course.isCompleted) return total;

  const taught = (course.currentSessionNumber || 0) - 1;
  return Math.min(Math.max(taught, 0), total || Math.max(taught, 0));
}

/**
 * How many are still to come, counting the one owed now: a course at 11 of 12
 * has both 11 and 12 ahead of it, not just 12.
 */
export function sessionsRemaining(course: CourseProgressLike): number {
  const total = courseLength(course);
  if (total === 0 || course.isCompleted) return 0;
  return Math.max(0, total - sessionsTaught(course));
}

/** The session a course owes next, or null once it owes nothing. */
export function nextSessionNumber(course: CourseProgressLike): number | null {
  if (course.isCompleted || sessionsRemaining(course) === 0) return null;
  return sessionsTaught(course) + 1;
}

/** Taught and total across a group's whole curriculum. */
export function courseTotals(courses: readonly CourseProgressLike[] | null | undefined): {
  taught: number;
  total: number;
} {
  let taught = 0;
  let total = 0;

  for (const course of courses || []) {
    taught += sessionsTaught(course);
    total += courseLength(course);
  }

  return { taught, total };
}

/** Whole-curriculum progress, 0–100. */
export function progressPercent(
  courses: readonly CourseProgressLike[] | null | undefined
): number {
  const { taught, total } = courseTotals(courses);
  if (total === 0) return 0;
  return Math.min(100, Math.round((taught / total) * 100));
}
