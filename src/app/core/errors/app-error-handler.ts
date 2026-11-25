import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from '../services/notification.service';
import { ErrorReporter } from './error-reporter.service';

/**
 * Where errors nobody caught end up.
 *
 * Angular's default only writes them to the console, so a bug in, say, a filter
 * left the page quietly not responding and the person none the wiser. This
 * still logs everything, and tells the person once -- at most every few
 * seconds, because one fault often throws on every change detection. A failed
 * request is not repeated here: the error interceptor has already said it.
 *
 * And it reports them to the school's server (ErrorReporter, R-02), when an
 * address is set for that: failed requests aside, which the server logs itself.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private static readonly QuietMs = 5_000;

  private readonly notify = inject(NotificationService);
  private readonly reporter = inject(ErrorReporter);
  private lastNotice = 0;

  handleError(error: unknown): void {
    if (isNotOurs(error)) {
      // A browser extension's script, or the browser's own notice: logged, and
      // nothing said to the person, who could do nothing about it.
      console.warn(error);
      return;
    }

    console.error(error);

    if (unwrap(error) instanceof HttpErrorResponse) {
      return;
    }

    // Reporting must not cost the person the message below.
    try {
      this.reporter.report(error);
    } catch {
      // Nothing to be done about it here.
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

/**
 * Errors the app did not cause, which reach the handler since the global
 * listeners were switched on:
 * - "Script error.": a script from another origin, a browser extension's for
 *   one, whose details the browser hides;
 * - an error event with no error object behind it;
 * - the browser saying a ResizeObserver could not deliver every notice in one
 *   frame, which is not an error in any page.
 */
function isNotOurs(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/^Script error\.?$/.test(message)) return true;
  if (/ResizeObserver loop/.test(message)) return true;
  const cause = error instanceof Error ? error.cause : undefined;
  return typeof ErrorEvent !== 'undefined' && cause instanceof ErrorEvent && !cause.error;
}

/** Errors thrown inside a promise arrive wrapped in `rejection`. */
function unwrap(error: unknown): unknown {
  if (error && typeof error === 'object' && 'rejection' in error) {
    return (error as { rejection: unknown }).rejection;
  }
  return error;
}
