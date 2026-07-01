import { Role } from "../interfaces/Role";

export interface User {
    id: number;
    name: string;
    email: string;
    role: Role;
}