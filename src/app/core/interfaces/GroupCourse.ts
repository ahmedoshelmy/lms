export interface GroupCourse {
  id: number;
  courseId: number;
  title: string;
  topic: string;
  level: string;
  sessionCount: string;
  orderIndex: number;
  currentSessionNumber: number;
  totalSessions: number;
  remainingSessions: number;
  isCompleted: boolean;
  scheduledSessionCount: number;
}
