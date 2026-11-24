import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { runBulk } from './bulk.utils';

describe('runBulk', () => {
  it('finishes every item and says which failed, instead of stopping at the first', async () => {
    const done: number[] = [];
    const result = await firstValueFrom(
      runBulk([1, 2, 3, 4], (id) => {
        if (id === 2) return throwError(() => new Error('refused'));
        done.push(id);
        return of(null);
      })
    );

    expect(done.sort()).toEqual([1, 3, 4]);
    expect(result.succeeded.sort()).toEqual([1, 3, 4]);
    expect(result.failed).toEqual([2]);
  });

  it('answers at once for nothing to do', async () => {
    expect(await firstValueFrom(runBulk([], () => of(null)))).toEqual({
      succeeded: [],
      failed: [],
    });
  });
});
