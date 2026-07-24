import { Role } from "./Role";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  accessToken?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  title?: string;
  groupName?: string
  groupId?: string;
  createdAt?: string
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  groupId?: string;
}

export interface UpdateUserPayload {
  name: string;
  email: string;
  password?: string;
  role: Role;
  groupId?: string;
}