import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../interfaces/Role';

export const roleGuard: CanActivateFn = (route, state) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data['roles'] as Role[] | undefined;

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  // Deny by default. A route that reached here with no roles was forgotten in
  // ROUTE_PERMISSIONS, and used to be open to everyone signed in.
  if (roles?.length && auth.hasAnyRole(roles)) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
