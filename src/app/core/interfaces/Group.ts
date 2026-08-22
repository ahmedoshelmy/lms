import { GroupCourse, GroupCourseAssignDto, GroupCourseUpdateItemDto } from './GroupCourse';

/**
 * Must match GroupStatus on the API exactly.
 *
 * Both edit screens carried their own copy of this numbered from zero, so
 * saving a Running group sent 0 — not a value the enum has — and saving a
 * Stopped one sent 1, which the API reads as Running. Every status save was
 * wrong by one step. Defined once here so the two cannot drift again.
 */
export const GROUP_STATUS: Record<string, number> = {
  Running: 1,
  Stopped: 2,
  Completed: 3,
  Archived: 4,
};

/** For a status dropdown. Derived from the map so the two cannot disagree. */
export const GROUP_STATUS_OPTIONS: { label: string; value: number }[] = Object.entries(
  GROUP_STATUS
).map(([label, value]) => ({ label, value }));

export const GROUP_STATUS_LABELS: Record<number, string> = {
  1: 'Running',
  2: 'Stopped',
  3: 'Completed',
  4: 'Archived',
};

export interface GroupStudent {
  studentId: number;
  studentName: string;
  studentEmail: string;
  joinedAt: string;
  leftAt?: string;
}

export interface GroupSchedule {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location?: string;
}

/**
 * Why a running group has nothing on the schedule. Null when it has.
 *
 * Three causes wanting three different answers, which is why the group says
 * which one rather than leaving operations to work it out.
 */
export type StalledReason = 'Overdue' | 'Finished' | 'NoCourse' | 'NoSchedule' | 'Owed';

export const STALLED_COPY: Record<StalledReason, { title: string; fix: string }> = {
  Overdue: {
    title: 'Sessions never marked',
    fix: 'Classes sit in the past still marked scheduled. Take the register if they happened, or move them forward if they did not.',
  },
  Finished: {
    title: 'Course taught out',
    fix: 'Every session has been taught. Mark the group completed.',
  },
  NoCourse: {
    title: 'No course assigned',
    fix: 'Nothing can be scheduled until this group has a course.',
  },
  NoSchedule: {
    title: 'No weekly slot',
    fix: 'Give the group a day and time before generating its sessions.',
  },
  Owed: {
    title: 'Sessions missing',
    fix: 'Its progress says sessions remain but they were never created.',
  },
};

export interface Group {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  location?: string;
  defaultInstructorId: number;
  defaultInstructorName: string;
  defaultInstructorEmail?: string;
  studentCount: number;
  /** Set only when a running group has nothing coming up. */
  stalledReason?: StalledReason | null;
  sessionsOwed?: number | null;
  nextSessionAt?: string | null;
  /** Past their date and still marked scheduled. Counted on every group. */
  overdueSessions?: number;
  /**
   * Where the group's progress should be, read off the sessions it has
   * actually taught, when that disagrees with what it records. Absent when
   * they agree, which is the normal case.
   */
  progressShouldBe?: number | null;
  /** What that same course records today. Sent alongside progressShouldBe. */
  progressRecorded?: number | null;
  /** The room the group's weekly slot occupies, where it has one. */
  roomName?: string | null;
  /** How many that room seats. Null when nothing about it caps the group. */
  roomStudentCapacity?: number | null;
  students?: GroupStudent[];
  schedules?: GroupSchedule[];
  courses: GroupCourse[];
  currentCourseTitle?: string;
  currentCourseLevel?: string;
  currentCourseRemainingSessions?: number;
  nextCourseTitle?: string;
  nextCourseLevel?: string;
  nextCourseTotalSessions?: number;
}

/**
 * How far a group's roll has outgrown the room it meets in, or null when it
 * has not, or when nothing about the room caps it: online, a partner site, or
 * a room whose seating nobody has recorded.
 *
 * Nothing refuses an enrolment over this. A class of thirteen in a room of
 * twelve is a chair to find, not a sale to turn away — but it should not be a
 * surprise on the morning either.
 */
export function seatsOverBy(group: Group): number | null {
  const seats = group.roomStudentCapacity;
  if (seats == null) return null;
  const over = group.studentCount - seats;
  return over > 0 ? over : null;
}

export interface GroupScheduleSlot {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location?: string;
}

export interface CreateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: number;
  status?: number;
  location?: string;
  courses?: GroupCourseAssignDto[];
  courseLevels?: GroupCourseAssignDto[];
  schedules?: GroupScheduleSlot[];
  generateSessions?: boolean;
  sessionsStartFrom?: string;
}

export interface UpdateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: number;
  status: number;
  location?: string;
  schedules?: GroupScheduleSlot[];
  courses?: GroupCourseUpdateItemDto[];
  updateUpcomingSessions?: boolean;
}

export interface UpdateGroupSchedulePayload {
  schedules: GroupScheduleSlot[];
  updateUpcomingSessions: boolean;
}

export interface GenerateCustomSessionsPayload {
  groupCourseId: number;
  count?: number;
  startFromDate?: string;
  includeTodayIfMatching: boolean;
}

export interface CancelUpcomingSessionsPayload {
  groupCourseId?: number;
  count?: number;
  holdUntilDate?: string;
  reason?: string;
}

export interface CancelUpcomingSessionsResult {
  cancelledCount: number;
  substitutesCreated: number;
  shiftedCount: number;
  cancelledSessionIds: number[];
  substituteSessionIds: number[];
}
