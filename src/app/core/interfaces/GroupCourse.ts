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

  /**
   * Every class this course has on the group's timetable, whatever its
   * standing. This is what removing the course deletes. Optional because a
   * server older than this field does not send it.
   */
  timetabledSessionCount?: number;

  /** How many of those have been taught and marked. */
  taughtSessionCount?: number;
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
