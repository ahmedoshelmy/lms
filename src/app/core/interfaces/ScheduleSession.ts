export interface SessionAttendanceItem {
  id: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  status: string;
}

export interface ScheduleSession {
  id: number;
  groupCourseId?: number;
  courseLevelId?: number;
  courseId?: number;
  courseTitle: string;
  groupName: string;
  groupId?: number;
  topic: string;
  sessionNumber: number;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  instructorId: number;
  instructorName: string;
  instructorEmail?: string;
  location?: string;
  status: string;
  orderIndex: number;
  currentSessionNumber: number;
  totalSessions: number;
  type: string;
  cancellationReason?: string;
  attendances?: SessionAttendanceItem[];
}

export interface CreateStandaloneSessionPayload {
  instructorId: number;
  type: number | string; // 2 = MakeupSession, 3 = TrialSession, 4 = RecapSession
  startsAt: string;
  endsAt: string;
  topic: string;
  location?: string;
  studentIds?: number[];
  groupCourseId?: number;
}

export interface UpdateSessionPayload {
  topic?: string;
  instructorId?: number;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  status?: number | string;
}

export interface ApplySessionForwardPayload {
  topic?: string;
  instructorId?: number;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  status?: number | string;
  updateWeeklySchedule: boolean;
}

/** A request to tell instructors about their week, now rather than on Thursday. */
export interface SendScheduleDigest {
  /**
   * Only instructors whose classes have moved. The weekly one goes to
   * everybody on purpose; a reminder sent after rearranging two groups usually
   * should not reach the eight people it did not touch.
   */
  onlyChanged: boolean;
  /** A line from operations, put above the usual text. */
  note?: string | null;
}

export interface ScheduleDigestResult {
  notified: number;
  /** Left out because nothing of theirs had changed. */
  skipped: number;
}
