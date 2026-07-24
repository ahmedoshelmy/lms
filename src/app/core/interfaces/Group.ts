import { GroupCourse } from './GroupCourse';

export interface GroupStudent {
  studentId: number;
  studentName: string;
  studentEmail: string;
  joinedAt: string;
  leftAt?: string;
}

export interface GroupSchedule {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location?: string;
}

export interface Group {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  location?: string;
  defaultInstructorId: number;
  defaultInstructorName: string;
  defaultInstructorEmail?: string;
  studentCount: number;
  students?: GroupStudent[];
  schedules?: GroupSchedule[];
  courses: GroupCourse[];
}

export interface CreateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: number;
  status?: number;
  location?: string;
  courseIds?: number[];
}

export interface UpdateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: number;
  status: number;
  location?: string;
}
