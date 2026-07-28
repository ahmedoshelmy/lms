import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';

import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 && !req.url.includes('/auth/')) {
        notification.showError(error.error?.message || 'Something went wrong');
      }

      return throwError(() => error);
    })
  );
};
