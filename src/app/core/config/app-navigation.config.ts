import { Role } from '../interfaces/Role';
import { MenuItem } from '../interfaces/MenuItem';

export const ALL_ROLES: Role[] = [Role.Admin, Role.Instructor, Role.Student];

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
    roles: ALL_ROLES,
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
    roles: [Role.Admin, Role.Instructor],
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
    path: 'activity-logs',
    label: 'Activity Analytics',
    icon: 'pi pi-chart-line',
    roles: [Role.Admin],
    showInMenu: true,
  },
];

export function getRolesForPath(path: string): Role[] {
  return ROUTE_PERMISSIONS.find((route) => route.path === path)?.roles ?? [];
}

export function getMenuItemsForRole(role: Role): MenuItem[] {
  return ROUTE_PERMISSIONS.filter((route) => route.showInMenu && route.roles.includes(role)).map(
    ({ label, icon, roles, path }) => ({
      label,
      icon,
      route: `/${path}`,
      roles,
    })
  );
}
