import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { Role } from '../interfaces/Role';
import { roleGuard } from '../guards/role.guard';
import { ROUTE_PERMISSIONS, canAccessPath, getMenuItemsForRole } from './app-navigation.config';

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
      expect(route.data?.['roles'], route.path).toEqual(table.roles);
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
