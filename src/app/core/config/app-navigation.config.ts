import { Role } from '../interfaces/Role';
import { MenuItem } from '../interfaces/MenuItem';

export const ALL_ROLES: Role[] = [
  Role.Admin,
  Role.Operation,
  Role.Instructor,
  Role.Student,
];

export interface RoutePermission {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
  showInMenu: boolean;
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  {
    path: 'dashboard',
    label: 'Overview',
    icon: 'pi pi-th-large',
    roles: ALL_ROLES,
    showInMenu: false,
  },
  {
    path: 'courses',
    label: 'Courses',
    icon: 'pi pi-book',
    roles: ALL_ROLES,
    showInMenu: false,
  },
  {
    path: 'users',
    label: 'Users & Staff',
    icon: 'pi pi-users',
    roles: [Role.Admin, Role.Operation],
    showInMenu: false,
  },
  {
    path: 'progress',
    label: 'Progress',
    icon: 'pi pi-chart-line',
    roles: ALL_ROLES,
    showInMenu: false,
  },
  {
    path: 'attendance',
    label: 'Attendance',
    icon: 'pi pi-calendar',
    roles: [Role.Admin, Role.Operation, Role.Instructor],
    showInMenu: false,
  },
  {
    path: 'resources',
    label: 'Resources',
    icon: 'pi pi-folder',
    roles: ALL_ROLES,
    showInMenu: false,
  },
  {
    path: 'schedule',
    label: 'Weekly Schedule',
    icon: 'pi pi-calendar-clock',
    roles: ALL_ROLES,
    showInMenu: true,
  },
];

export function getRolesForPath(path: string): Role[] {
  return ROUTE_PERMISSIONS.find((route) => route.path === path)?.roles ?? [];
}

export function getMenuItemsForRole(role: Role): MenuItem[] {
  return ROUTE_PERMISSIONS.filter(
    (route) => route.showInMenu && route.roles.includes(role),
  ).map(({ label, icon, roles, path }) => ({
    label,
    icon,
    route: `/${path}`,
    roles,
  }));
}
