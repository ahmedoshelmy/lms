import { GroupCourse } from './GroupCourse';

export interface Group {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  location?: string;
  defaultInstructorId: number;
  defaultInstructorName: string;
  studentCount: number;
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
