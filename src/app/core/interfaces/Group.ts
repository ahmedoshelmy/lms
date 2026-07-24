import { GroupCourse } from "./GroupCourse";

export interface Group {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  location?: string;
  defaultInstructorId: string;
  defaultInstructorName: string;
  studentCount: number;
  courses: GroupCourse[];
}


export interface CreateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: string;
  status?: number;
  location?: string;
  courseIds?: string[];
}

export interface UpdateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: string;
  status: number;
  location?: string;
}
