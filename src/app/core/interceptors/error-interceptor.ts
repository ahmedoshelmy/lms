import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';

import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { NotificationService } from '../services/notification.service';
import { SILENT_STATUSES } from './silent-statuses.token';

/**
 * What to tell the person. When the request never reached the server (status
 * 0: offline, DNS, CORS, the server down) say that first -- the browser fills
 * in its own message for those ("Failed to fetch"), which explains nothing.
 * Otherwise the server's own message, or a general one.
 */
export function errorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (error.error?.message) return error.error.message;
  return 'Something went wrong';
}

/** How long the same message is not repeated. */
export const REPEAT_QUIET_MS = 4_000;

/**
 * Remembers the last message shown, so a burst of failures says it once.
 *
 * A page that loads five things at once, with the network down, used to stack
 * five identical toasts down the screen -- more on a busy page. One is the
 * news; the rest are noise covering the page.
 */
export class RepeatFilter {
  private last = '';
  private at = 0;

  shouldShow(message: string, now = Date.now()): boolean {
    if (message === this.last && now - this.at < REPEAT_QUIET_MS) {
      return false;
    }
    this.last = message;
    this.at = now;
    return true;
  }
}

const repeats = new RepeatFilter();

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const handledByCaller = req.context.get(SILENT_STATUSES).includes(error.status);

      if (error.status !== 401 && !handledByCaller && !req.url.includes('/auth/')) {
        const message = errorMessage(error);
        if (repeats.shouldShow(message)) {
          notification.showError(message);
        }
      }

      return throwError(() => error);
    })
  );
};
