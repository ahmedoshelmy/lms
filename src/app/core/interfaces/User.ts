import { Role } from "./Role";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}
// export interface User {
//   id: string;
//   name: string;
//   email: string;
//   role: Role;
//   phone?: string;
//   bio?: string;
//   avatarUrl?: string;
//   location?: string;
//   title?: string;
// }
