import { Route } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';
import { Role } from '../interfaces/Role';
import { roleGuard } from '../guards/role.guard';
import {
  ROUTE_PERMISSIONS,
  canAccessPath,
  featureEnabled,
  getMenuItemsForRole,
} from './app-navigation.config';

/** Every route behind roleGuard, with its first path segment. */
function guardedRoutes(list: Route[], out: Route[] = []): Route[] {
  for (const route of list) {
    if (route.canActivate?.includes(roleGuard)) out.push(route);
    if (route.children) guardedRoutes(route.children, out);
  }
  return out;
}

describe('route permissions', () => {
  it('has an entry for every page behind the role guard', () => {
    const known = new Set(ROUTE_PERMISSIONS.map((p) => p.path));
    const missing = guardedRoutes(routes)
      .map((r) => (r.path ?? '').split('/')[0])
      .filter((first) => !known.has(first));

    expect(missing).toEqual([]);
  });

  it('gives every guarded route the roles the table lists for it', () => {
    for (const route of guardedRoutes(routes)) {
      const first = (route.path ?? '').split('/')[0];
      const table = ROUTE_PERMISSIONS.find((p) => p.path === first)!;
      // A feature waiting on its endpoints is refused to everyone until it is on.
      const expected = featureEnabled(table.feature) ? table.roles : [];
      expect(route.data?.['roles'], route.path).toEqual(expected);
    }
  });
});

describe('canAccessPath', () => {
  it('reads the first segment of any form of path', () => {
    expect(canAccessPath(Role.Instructor, 'groups')).toBe(true);
    expect(canAccessPath(Role.Instructor, '/groups/12')).toBe(true);
    expect(canAccessPath(Role.Instructor, '/students/4')).toBe(false);
  });

  it('refuses paths the table does not know, and nobody signed in', () => {
    expect(canAccessPath(Role.Admin, '/no-such-page')).toBe(false);
    expect(canAccessPath(null, '/dashboard')).toBe(false);
  });

  it('accepts roles as the API sends them, by name or number', () => {
    expect(canAccessPath('Sales', 'sales')).toBe(true);
    expect(canAccessPath('4', 'sales')).toBe(true);
  });
});

describe('the menu each role sees', () => {
  const paths = (role: Role) => getMenuItemsForRole(role).map((m) => m.route);

  it('never offers a page the role would be refused', () => {
    for (const role of [Role.Admin, Role.Instructor, Role.Sales, Role.Student]) {
      for (const route of paths(role)) {
        expect(canAccessPath(role, route), `${Role[role]} → ${route}`).toBe(true);
      }
    }
  });

  it('keeps staff pages out of the sales and student menus', () => {
    for (const role of [Role.Sales, Role.Student]) {
      expect(paths(role)).not.toContain('/groups');
      expect(paths(role)).not.toContain('/students');
      expect(paths(role)).not.toContain('/attendance');
    }
  });
});

describe('features waiting on the server', () => {
  const saved = environment.features.instructorKpis;
  afterEach(() => (environment.features.instructorKpis = saved));

  function offered(on: boolean) {
    environment.features.instructorKpis = on;
    return {
      admin: canAccessPath(Role.Admin, '/instructor-kpis'),
      instructor: canAccessPath(Role.Instructor, '/my-kpis'),
      adminMenu: getMenuItemsForRole(Role.Admin).some((m) => m.route === '/instructor-kpis'),
      instructorMenu: getMenuItemsForRole(Role.Instructor).some((m) => m.route === '/my-kpis'),
    };
  }

  it('are refused, and in no menu, while switched off', () => {
    expect(offered(false)).toEqual({
      admin: false,
      instructor: false,
      adminMenu: false,
      instructorMenu: false,
    });
  });

  it('are offered to their roles once switched on', () => {
    expect(offered(true)).toEqual({
      admin: true,
      instructor: true,
      adminMenu: true,
      instructorMenu: true,
    });
    // And to nobody else.
    expect(canAccessPath(Role.Instructor, '/instructor-kpis')).toBe(false);
    expect(canAccessPath(Role.Sales, '/my-kpis')).toBe(false);
  });
});
