export interface ScheduleSession {
  id: number;
  courseTitle: string;
  groupName: string;
  groupId: number;
  topic: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  instructorId: number;
  instructorName: string;
  location?: string;
  status: string;
  orderIndex: number;
  currentSessionNumber: number;
  totalSessions: number;
  type: string;
}

export interface UpdateSessionPayload {
  instructorId?: number;
  status?: string;
}
