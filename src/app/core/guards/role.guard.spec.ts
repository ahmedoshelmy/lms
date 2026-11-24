import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Role } from '../interfaces/Role';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

function run(roles: Role[] | undefined, userRole: Role | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isLoggedIn: () => userRole !== null,
          hasAnyRole: (allowed: Role[]) => userRole !== null && allowed.includes(userRole),
        },
      },
    ],
  });
  const route = { data: roles ? { roles } : {} } as unknown as ActivatedRouteSnapshot;
  const result = TestBed.runInInjectionContext(() =>
    roleGuard(route, { url: '/somewhere' } as RouterStateSnapshot)
  );
  const router = TestBed.inject(Router);
  return result instanceof UrlTree ? router.serializeUrl(result) : result;
}

describe('roleGuard', () => {
  it('lets a permitted role in', () => {
    expect(run([Role.Admin, Role.Sales], Role.Sales)).toBe(true);
  });

  it('sends anyone else to the unauthorized page', () => {
    expect(run([Role.Admin], Role.Instructor)).toBe('/unauthorized');
  });

  it('refuses a route nobody gave any roles to, instead of opening it to everyone', () => {
    expect(run([], Role.Admin)).toBe('/unauthorized');
    expect(run(undefined, Role.Admin)).toBe('/unauthorized');
  });

  it('sends somebody signed out to the login page', () => {
    expect(run([Role.Admin], null)).toBe('/login?returnUrl=%2Fsomewhere');
  });
});
