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

/**
 * Whose doing it was that a class did not happen. Kept apart from the written
 * reason because this is the part that can be counted: "Ahmed was ill" and
 * "instructor sick" are the same cause written two ways.
 */
export type CancellationCause = 'Instructor' | 'Parents' | 'Holiday';

export interface CancelSessionPayload {
  shiftUpcomingSchedule: boolean;
  /** Required for anything counted against somebody; a holiday needs none. */
  cause?: CancellationCause | null;
  /** What happened, in the words of whoever cancelled it. */
  reason?: string | null;
}

export interface SessionHistoryFilter {
  groupId?: number;
  instructorId?: number;
  status?: string;
  from?: string;
  to?: string;
}
