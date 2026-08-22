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
