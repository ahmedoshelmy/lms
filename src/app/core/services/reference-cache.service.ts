import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Observable, catchError, finalize, map, shareReplay, throwError } from 'rxjs';

/** Long enough to cover a working session's page-to-page moves, short enough to pick up others' edits. */
const TTL_MS = 5 * 60_000;

interface Entry {
  expires: number;
  value$: Observable<unknown>;
}

/**
 * Lists that change rarely and are asked for on page after page: topics (and
 * the courses and levels read from them), instructors, rooms. Each used to be
 * fetched again on every page that needed it -- /topics alone from ten places.
 *
 * - Kept for five minutes; a failed request is not kept.
 * - Each caller gets its own copy of the list, so sorting one cannot reorder
 *   another page's.
 * - Any write to the same resource clears it (referenceCacheInterceptor), as do
 *   signing out and changing the API address.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceCache {
  private readonly entries = new Map<string, Entry>();

  get<T>(key: string, load: () => Observable<T[]>): Observable<T[]> {
    const now = Date.now();
    let entry = this.entries.get(key);
    if (!entry || entry.expires <= now) {
      const value$ = load().pipe(
        catchError((error) => {
          this.entries.delete(key);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      entry = { expires: now + TTL_MS, value$ };
      this.entries.set(key, entry);
    }
    return (entry.value$ as Observable<T[]>).pipe(map((list) => (list ? [...list] : list)));
  }

  /** Clears whatever a write to this URL may have changed. */
  invalidateFor(url: string): void {
    const path = url.toLowerCase();
    const touched: string[] = [];
    if (path.includes('/topics')) touched.push('topics');
    if (path.includes('/users') || path.includes('instructor')) touched.push('instructors');
    if (path.includes('/availability/rooms')) touched.push('rooms');
    if (!touched.length) return;
    for (const key of [...this.entries.keys()]) {
      if (touched.some((t) => key.startsWith(t + ':'))) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

/** After any write -- whether it worked or not -- the lists it may have changed are fetched afresh. */
export const referenceCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET') return next(req);
  const cache = inject(ReferenceCache);
  return next(req).pipe(finalize(() => cache.invalidateFor(req.url)));
};
