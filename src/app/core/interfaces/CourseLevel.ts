export interface CourseLevel {
  id: number;
  topicId: number;
  level: number;
  sessionCount: number;
  title: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
  topicCode?: string;
  topicName?: string;
}

export interface CreateCourseLevelPayload {
  topicId?: number;
  level: number;
  sessionCount: number;
  title: string;
  description: string;
}

export interface UpdateCourseLevelPayload {
  level: number;
  sessionCount: number;
  title: string;
  description: string;
}
