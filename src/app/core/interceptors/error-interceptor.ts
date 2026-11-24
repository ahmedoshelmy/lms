import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';

import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { NotificationService } from '../services/notification.service';
import { SILENT_STATUSES } from './silent-statuses.token';

/**
 * What to tell the person. The server's own message when it sent one; when the
 * request never reached it (status 0: offline, DNS, CORS, the server down),
 * say that, rather than a "Something went wrong" that sounds like a bug.
 */
export function errorMessage(error: HttpErrorResponse): string {
  if (error.error?.message) return error.error.message;
  if (error.status === 0) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const handledByCaller = req.context.get(SILENT_STATUSES).includes(error.status);

      if (error.status !== 401 && !handledByCaller && !req.url.includes('/auth/')) {
        notification.showError(errorMessage(error));
      }

      return throwError(() => error);
    })
  );
};
