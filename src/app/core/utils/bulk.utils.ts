import { Observable, catchError, from, map, mergeMap, of, toArray } from 'rxjs';

export interface BulkResult<T> {
  succeeded: T[];
  failed: T[];
}

/**
 * Runs one request per item and reports which worked, without stopping at the
 * first failure.
 *
 * Bulk actions used forkJoin, which gives up on the first error: the items
 * after it may or may not have been done, the page never reloaded, and nobody
 * was told which ones. This finishes them all, a few at a time so a long
 * selection does not open dozens of connections at once, and answers with the
 * two lists. Each failure is still reported by the error interceptor.
 */
export function runBulk<T>(
  items: readonly T[],
  call: (item: T) => Observable<unknown>,
  concurrency = 4
): Observable<BulkResult<T>> {
  if (!items.length) {
    return of({ succeeded: [], failed: [] });
  }

  return from(items).pipe(
    mergeMap(
      (item) =>
        call(item).pipe(
          map(() => ({ item, ok: true })),
          catchError(() => of({ item, ok: false }))
        ),
      concurrency
    ),
    toArray(),
    map((results) => ({
      succeeded: results.filter((r) => r.ok).map((r) => r.item),
      failed: results.filter((r) => !r.ok).map((r) => r.item),
    }))
  );
}
