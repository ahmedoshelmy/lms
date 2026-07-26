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
  courses: StudentCourse[];
}

export interface StudentCourse {
  title: string;
  topic: string;
  level: string;
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
