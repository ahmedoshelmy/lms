export interface StudentDetails {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  currentGroup: StudentGroup | null;
  groupHistory: StudentGroup[];
  attendanceHistory: StudentAttendanceRecord[];
  upcomingSessions: StudentUpcomingSession[];
}

export interface StudentGroup {
  groupId: number;
  groupName: string;
  status: string;
  joinedAt: string;
  leftAt: string | null;
  /** Who teaches it. Printed on the certificate. */
  instructorName: string | null;
  /** Classes a week, which is what turns a session count into a length. */
  sessionsPerWeek: number;
  courses: StudentCourse[];
}

export interface StudentCourse {
  groupCourseId: number;
  title: string;
  topic: string;
  level: string;
  /** How far the group has got, and how long the course runs. */
  currentSessionNumber: number;
  totalSessions: number;
  isCompleted: boolean;
  /** The day the last class was taught. Null while the course is still running. */
  completedAt: string | null;
}

export interface StudentAttendanceRecord {
  sessionId: number;
  topic: string;
  startsAt: string;
  endsAt: string;
  sessionStatus: string;
  attendanceStatus: string;
  courseTitle: string;
  groupName: string;
  instructorName: string;
}

export interface StudentUpcomingSession {
  sessionId: number;
  topic: string;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  location: string | null;
  courseTitle: string;
  groupName: string;
  instructorName: string;
}
