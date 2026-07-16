import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const userIdInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const userId = authService.getUserId();

  if (userId) {
    req = req.clone({
      setHeaders: {
        'X-User-Id': userId,
      },
    });
  }

  return next(req);
};
