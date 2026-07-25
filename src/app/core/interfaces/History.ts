export interface GroupCourseHistoryItem {
  groupCourseId: number;
  courseId: number;
  courseTitle: string;
  topic: string;
  level: string;
  orderIndex: number;
  currentSessionNumber: number;
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  progressPercentage: number;
  isCompleted: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface GroupHistory {
  groupId: number;
  groupName: string;
  currentStatus: string;
  defaultInstructorId: number;
  defaultInstructorName: string;
  courseHistory: GroupCourseHistoryItem[];
}

export interface PromoteGroupNextLevelPayload {
  targetCourseId?: number;
  startDate?: string;
  autoGenerateSessions?: boolean;
}

export interface CancelSessionPayload {
  shiftUpcomingSchedule: boolean;
  reason?: string;
}

export interface SessionHistoryFilter {
  groupId?: number;
  instructorId?: number;
  status?: string;
  from?: string;
  to?: string;
}
