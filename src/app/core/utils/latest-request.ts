import { DestroyRef, inject } from '@angular/core';
import { MonoTypeOperatorFunction, Observable, Subscription } from 'rxjs';

/**
 * Keeps one request of a given kind alive at a time, cancelling the one before.
 *
 * Changing the week, the month or a filter quickly used to start a request per
 * change, and whichever answered last won -- often the older, slower one, so
 * the screen showed last week's classes under this week's heading. Piping a new
 * request through `latest()` unsubscribes the previous one, which aborts it, so
 * only the newest answer ever lands:
 *
 *     this.lms.getSchedule(from, to).pipe(this.scheduleRequest.latest()).subscribe(...)
 */
export class LatestRequest {
  private current?: Subscription;

  latest<T>(): MonoTypeOperatorFunction<T> {
    return (source) =>
      new Observable<T>((subscriber) => {
        this.current?.unsubscribe();
        this.current = subscriber;
        return source.subscribe(subscriber);
      });
  }

  cancel(): void {
    this.current?.unsubscribe();
    this.current = undefined;
  }
}

/**
 * A LatestRequest that is also cancelled when whatever owns it is destroyed.
 * Call in a field initialiser or constructor.
 */
export function latestRequest(): LatestRequest {
  const request = new LatestRequest();
  inject(DestroyRef).onDestroy(() => request.cancel());
  return request;
}
