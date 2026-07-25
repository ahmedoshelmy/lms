import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return true;
  }

  const returnUrl = route.queryParams['returnUrl'];
  if (returnUrl && typeof returnUrl === 'string' && returnUrl.startsWith('/')) {
    return router.createUrlTree([returnUrl]);
  }

  return router.createUrlTree(['/']);
};
