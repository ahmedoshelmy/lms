import { Role } from './Role';

export interface User {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  accessToken?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  title?: string;
  groupName?: string;
  groupId?: number;
  createdAt?: string;
  /** Instructors only: the most they should teach in a week, in minutes. */
  weeklyCapacityMinutes?: number | null;
}

export interface CreateUserPayload {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  role: Role;
  groupId?: number;
}

export interface UpdateUserPayload {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: Role;
  groupId?: number;
}
