export enum Role {
  Student = 1,
  Instructor = 2,
  Operation = 3,
  Admin = 4,
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Student]: 'Student',
  [Role.Instructor]: 'Instructor',
  [Role.Operation]: 'Operation',
  [Role.Admin]: 'Admin',
};
