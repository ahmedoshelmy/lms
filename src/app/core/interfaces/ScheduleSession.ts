export interface ScheduleSession {
  id: string;
  courseTitle: string;
  groupName: string;
  groupId: string;
  topic: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  instructorId: string;
  instructorName: string;
  location?: string;
  status: string;
  orderIndex: number;
  currentSessionNumber: number;
  totalSessions: number;
  type: string;
}
