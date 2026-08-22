import { Role, parseRole } from '../interfaces/Role';
import { MenuItem } from '../interfaces/MenuItem';

/** Literally every role. A route using this is reachable by anyone signed in. */
export const ALL_ROLES: Role[] = [Role.Admin, Role.Instructor, Role.Student, Role.Sales];

/** Everyone who runs the schedule. */
export const OPERATIONS_ROLES: Role[] = [Role.Admin, Role.Instructor];

/** Sales proposes, operations disposes — both need the slot and hold screens. */
export const SALES_ROLES: Role[] = [Role.Admin, Role.Sales];

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
    showInMenu: true,
  },
  {
    path: 'sessions',
    label: 'Session Detail',
    icon: 'pi pi-calendar',
    roles: [Role.Admin, Role.Instructor, Role.Student],
    showInMenu: false,
  },
  {
    path: 'schedule',
    label: 'Schedule',
    icon: 'pi pi-calendar-clock',
    roles: ALL_ROLES,
    showInMenu: true,
  },
  {
    path: 'courses',
    label: 'Courses',
    icon: 'pi pi-book',
    roles: ALL_ROLES,
    showInMenu: true,
  },
  {
    path: 'attendance',
    label: 'Sessions',
    icon: 'pi pi-calendar',
    roles: [Role.Admin, Role.Instructor],
    showInMenu: true,
  },
  {
    path: 'groups',
    label: 'Groups',
    icon: 'pi pi-sitemap',
    roles: OPERATIONS_ROLES,
    showInMenu: true,
  },
  {
    path: 'students',
    label: 'Students',
    icon: 'pi pi-graduation-cap',
    roles: [Role.Admin],
    showInMenu: true,
  },
  {
    path: 'instructors',
    label: 'Instructors',
    icon: 'pi pi-user',
    roles: [Role.Admin],
    showInMenu: true,
  },
  {
    path: 'history',
    label: 'History & Events',
    icon: 'pi pi-history',
    roles: [Role.Admin, Role.Instructor],
    showInMenu: true,
  },
  {
    path: 'session-summaries',
    label: 'Session Summaries',
    icon: 'pi pi-comments',
    roles: ALL_ROLES,
    showInMenu: true,
  },
  {
    path: 'activity-logs',
    label: 'Activity Analytics',
    icon: 'pi pi-chart-line',
    roles: [Role.Admin],
    showInMenu: true,
  },
  {
    path: 'profile',
    label: 'Profile',
    icon: 'pi pi-user',
    roles: ALL_ROLES,
    showInMenu: false,
  },
  {
    path: 'settings',
    label: 'Settings',
    icon: 'pi pi-cog',
    roles: [Role.Admin],
    showInMenu: true,
  },
];

export function getRolesForPath(path: string): Role[] {
  return ROUTE_PERMISSIONS.find((route) => route.path === path)?.roles ?? [];
}

export function getMenuItemsForRole(rawRole: Role | unknown): MenuItem[] {
  const role = parseRole(rawRole);
  return ROUTE_PERMISSIONS.filter(
    (route) => route.showInMenu && route.roles.some((r) => parseRole(r) === role)
  ).map(({ label, icon, roles, path }) => ({
    label,
    icon,
    route: `/${path}`,
    roles,
  }));
}
