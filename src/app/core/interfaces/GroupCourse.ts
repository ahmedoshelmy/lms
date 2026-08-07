export type GroupCourseStatus = 'Pending' | 'Active' | 'Completed';

export interface GroupCourse {
  id: number;
  courseLevelId: number;
  courseId: number;
  title: string;
  topic: string;
  level: number;
  sessionCount: number;
  orderIndex: number;
  status: GroupCourseStatus;
  currentSessionNumber: number;
  totalSessions: number;
  remainingSessions: number;
  isCompleted: boolean;
  scheduledSessionCount: number;
}

export interface GroupCourseAssignDto {
  courseLevelId: number;
  courseId?: number;
  initialCurrentSessionNumber?: number;
  currentSessionNumber?: number;
  status?: GroupCourseStatus;
  isActive?: boolean;
}

export interface GroupCourseUpdateItemDto {
  id?: number;
  groupCourseId?: number;
  courseLevelId?: number;
  orderIndex?: number;
  status?: GroupCourseStatus;
  currentSessionNumber?: number;
  totalSessions?: number;
  isActive?: boolean;
}

export interface UpdateCurrentSessionNumberDto {
  newCurrentSessionNumber: number;
  confirmDeleteUpcomingSessions?: boolean;
}
