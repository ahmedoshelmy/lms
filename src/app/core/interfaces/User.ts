import { Role } from './Role';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  accessToken?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  title?: string;
  groupName?: string;
  groupId?: number;
  createdAt?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  groupId?: number;
}

export interface UpdateUserPayload {
  name: string;
  email: string;
  password?: string;
  role: Role;
  groupId?: number;
}
