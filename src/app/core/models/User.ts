import { Role } from "../interfaces/Role";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
