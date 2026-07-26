export interface Course {
  id: number;
  title: string;
  description: string;
  topic: string;
  level: string;
  sessionCount: string;
  createdAt: string;
  groupCount: number;
  studentCount: number;
}

export interface CreateCoursePayload {
  title: string;
  description: string;
  topic: string;
  level: string;
  sessionCount: string;
}

export interface UpdateCoursePayload extends CreateCoursePayload {}
