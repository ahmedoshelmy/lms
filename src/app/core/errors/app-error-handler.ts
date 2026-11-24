import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from '../services/notification.service';

/**
 * Where errors nobody caught end up.
 *
 * Angular's default only writes them to the console, so a bug in, say, a filter
 * left the page quietly not responding and the person none the wiser. This
 * still logs everything, and tells the person once -- at most every few
 * seconds, because one fault often throws on every change detection. A failed
 * request is not repeated here: the error interceptor has already said it.
 *
 * The place to send errors to a monitoring service when there is one (R-02).
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private static readonly QuietMs = 5_000;

  private readonly notify = inject(NotificationService);
  private lastNotice = 0;

  handleError(error: unknown): void {
    console.error(error);

    if (unwrap(error) instanceof HttpErrorResponse) {
      return;
    }

    const now = Date.now();
    if (now - this.lastNotice < AppErrorHandler.QuietMs) {
      return;
    }
    this.lastNotice = now;

    this.notify.showError(
      'Something went wrong on this page. If it keeps happening, reload the page.'
    );
  }
}

/** Errors thrown inside a promise arrive wrapped in `rejection`. */
function unwrap(error: unknown): unknown {
  if (error && typeof error === 'object' && 'rejection' in error) {
    return (error as { rejection: unknown }).rejection;
  }
  return error;
}
