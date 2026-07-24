import { Role } from "./Role";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  accessToken: string;
}
