import { GroupCourse, GroupCourseAssignDto, GroupCourseUpdateItemDto } from './GroupCourse';

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
