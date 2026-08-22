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
