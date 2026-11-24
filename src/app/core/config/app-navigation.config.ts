import { isDevMode } from '@angular/core';
import { Role, parseRole } from '../interfaces/Role';
import { MenuItem } from '../interfaces/MenuItem';
import { environment } from '../../../environments/environment';

export type FeatureName = keyof typeof environment.features;

/** Whether a feature built ahead of its server endpoints is switched on. */
export function featureEnabled(name: FeatureName | undefined): boolean {
  return !name || environment.features[name];
}

/** Literally every role. A route using this is reachable by anyone signed in. */
export const ALL_ROLES: Role[] = [Role.Admin, Role.Instructor, Role.Student, Role.Sales];

/** Everyone who runs the schedule. */
export const OPERATIONS_ROLES: Role[] = [Role.Admin, Role.Instructor];

/** Sales proposes, operations disposes — both need the slot and hold screens. */
export const SALES_ROLES: Role[] = [Role.Admin, Role.Sales];

/**
 * Everyone whose own week the schedule can show.
 *
 * Sales is not among them, and never was: the query behind the board returns
 * an admin everything, an instructor their own sessions and a student theirs,
 * and falls through to nothing for anybody else. A salesperson opening it saw
 * an empty week. What they actually need — which hours are free — is the slot
 * finder on their own page, which answers it and says why an hour is blocked.
 */
export const SCHEDULE_ROLES: Role[] = [Role.Admin, Role.Instructor, Role.Student];

export interface RoutePermission {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
  showInMenu: boolean;
  /** Shown only in a development build. */
  devOnly?: boolean;
  /**
   * A feature waiting on server endpoints: while it is off the page is in no
   * menu and its route refuses, as if it were not there.
   */
  feature?: FeatureName;
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
    roles: SCHEDULE_ROLES,
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
    path: 'my-learning',
    label: 'My Learning',
    icon: 'pi pi-graduation-cap',
    // A student's own record. Admin keeps it so the page can be checked
    // without borrowing somebody's login.
    roles: [Role.Student, Role.Admin],
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
    path: 'evaluations',
    label: 'Monthly Reports',
    icon: 'pi pi-file-edit',
    // Instructors write their own groups' reports; operations checks and
    // releases them, so both need the page and nobody else does.
    roles: [Role.Admin, Role.Instructor],
    showInMenu: true,
  },
  {
    path: 'instructor-kpis',
    label: 'Instructor KPIs',
    icon: 'pi pi-chart-bar',
    roles: [Role.Admin],
    showInMenu: true,
    feature: 'instructorKpis',
  },
  {
    path: 'my-kpis',
    label: 'My KPIs',
    icon: 'pi pi-chart-bar',
    roles: [Role.Instructor],
    showInMenu: true,
    feature: 'instructorKpis',
  },
  {
    path: 'history',
    label: 'History & Events',
    icon: 'pi pi-history',
    roles: [Role.Admin, Role.Instructor],
    showInMenu: true,
  },
  {
    path: 'sales',
    label: 'Sales',
    icon: 'pi pi-briefcase',
    roles: SALES_ROLES,
    showInMenu: true,
  },
  {
    path: 'availability',
    label: 'Availability',
    icon: 'pi pi-clock',
    // Operations edits it, instructors ask about their own, sales reads it to
    // find a slot. Students have no business here.
    roles: [Role.Admin, Role.Instructor, Role.Sales],
    showInMenu: true,
  },
  {
    path: 'session-summaries',
    label: 'Session Summaries',
    icon: 'pi pi-comments',
    // The whole curriculum, every course and level. Staff and sales browse it
    // to see what is taught; a student wants their own classes, which is what
    // My Learning shows, not all 244 sessions of courses they are not on.
    roles: [Role.Admin, Role.Instructor, Role.Sales],
    showInMenu: true,
  },
  {
    path: 'operations-rota',
    label: 'Operations Rota',
    icon: 'pi pi-users',
    roles: [Role.Admin],
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
    // Nothing here is organisation data: the API endpoint, the connection
    // check and the version are all per-browser. Keeping it admin-only meant
    // anyone else testing against a different server was stuck.
    roles: ALL_ROLES,
    showInMenu: true,
    // Kept out of the menu in a production build. It points the browser at a
    // different server, which is what you want while developing and a way to
    // break your own login otherwise. The route still answers, so anybody
    // talked through it by hand can still get there.
    devOnly: true,
  },
];

export function getRolesForPath(path: string): Role[] {
  const route = ROUTE_PERMISSIONS.find((r) => r.path === path);
  return route && featureEnabled(route.feature) ? route.roles : [];
}

/**
 * Whether a role may open a path, from the same table the routes and the menu
 * are built from. Takes "groups", "/groups" or "/groups/12" -- the first
 * segment decides. A path the table does not know is refused: nothing is open
 * by being forgotten.
 *
 * This only decides what the interface offers. The server decides what anyone
 * may actually read or change.
 */
export function canAccessPath(rawRole: Role | unknown, path: string): boolean {
  if (rawRole === null || rawRole === undefined) return false;
  const role = parseRole(rawRole);
  const first = path.replace(/^\/+/, '').split(/[/?#]/)[0];
  const roles = getRolesForPath(first);
  return roles.some((r) => parseRole(r) === role);
}

export function getMenuItemsForRole(rawRole: Role | unknown): MenuItem[] {
  const role = parseRole(rawRole);
  // isDevMode is read here rather than where the routes are declared, so it is
  // answered when the menu is built rather than whenever this file first loads.
  const showing = isDevMode();

  return ROUTE_PERMISSIONS.filter(
    (route) =>
      route.showInMenu &&
      (showing || !route.devOnly) &&
      featureEnabled(route.feature) &&
      route.roles.some((r) => parseRole(r) === role)
  ).map(({ label, icon, roles, path }) => ({
    label,
    icon,
    route: `/${path}`,
    roles,
  }));
}
