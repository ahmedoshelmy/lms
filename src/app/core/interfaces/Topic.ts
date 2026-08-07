import { CourseLevel } from './CourseLevel';

export interface Topic {
  id: number;
  code: string;
  name: string;
  description?: string;
  createdAt?: string;
  levels?: CourseLevel[];
}

export interface CreateTopicPayload {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateTopicPayload {
  code: string;
  name: string;
  description?: string;
}
