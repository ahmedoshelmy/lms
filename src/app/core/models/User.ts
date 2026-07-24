import { Role } from '../interfaces/Role';

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
}
