export enum Role {
  Student = 1,
  Instructor = 2,
  Admin = 3,
  /**
   * Sales. Holds slots against instructor availability and builds candidate
   * groups; converting a hold into a running group is an operations action.
   */
  Sales = 4,
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Student]: 'Student',
  [Role.Instructor]: 'Instructor',
  [Role.Admin]: 'Admin',
  [Role.Sales]: 'Sales',
};

export function parseRole(val: unknown): Role {
  if (typeof val === 'number') {
    return val as Role;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!isNaN(Number(trimmed)) && trimmed !== '') {
      return Number(trimmed) as Role;
    }
    const lower = trimmed.toLowerCase();
    if (lower === 'admin') return Role.Admin;
    if (lower === 'instructor') return Role.Instructor;
    if (lower === 'student') return Role.Student;
    if (lower === 'sales') return Role.Sales;
  }
  return val as Role;
}
