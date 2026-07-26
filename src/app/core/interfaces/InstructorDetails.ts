import { ScheduleSession } from './ScheduleSession';

export interface InstructorGroupCourse {
  title: string;
  topic: string;
  level: string;
}

export interface InstructorGroup {
  id: number;
  name: string;
  status: string;
  studentCount: number;
  courses: InstructorGroupCourse[];
}

export interface InstructorDetails {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  groups: InstructorGroup[];
  sessions: ScheduleSession[];
}

export interface InstructorStats {
  instructorId: number;
  instructorName: string;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  totalHours: number;
  totalSessions: number;
  totalGroups: number;
  totalStudents: number;
}
