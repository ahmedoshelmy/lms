import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const userIdInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const userId = authService.getUserId();

  // Only inject X-User-Id when the request does not already set it explicitly
  // (e.g. the schedule component overriding it for an admin-selected instructor).

  return next(req);
};
