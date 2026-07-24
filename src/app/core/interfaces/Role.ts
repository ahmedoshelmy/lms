export enum Role {
  Admin = 1,
  Instructor = 2,
  Student = 3,
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Admin]: 'Admin',
  [Role.Instructor]: 'Instructor',
  [Role.Student]: 'Student',
};
