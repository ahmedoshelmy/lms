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
  initialCurrentSessionNumber?: number;
  status?: GroupCourseStatus;
}

export interface GroupCourseUpdateItemDto {
  id?: number;
  courseLevelId: number;
  orderIndex: number;
  status: GroupCourseStatus;
  currentSessionNumber?: number;
  totalSessions?: number;
}

export interface UpdateCurrentSessionNumberDto {
  newCurrentSessionNumber: number;
  confirmDeleteUpcomingSessions?: boolean;
}
