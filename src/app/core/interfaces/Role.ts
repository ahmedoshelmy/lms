export enum Role {
  Student = 1,
  Instructor = 2,
  Admin = 3,
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Student]: 'Student',
  [Role.Instructor]: 'Instructor',
  [Role.Admin]: 'Admin',
};
