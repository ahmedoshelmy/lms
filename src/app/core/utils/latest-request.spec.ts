import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { LatestRequest } from './latest-request';

describe('LatestRequest', () => {
  it('drops the answer to a request that was overtaken', () => {
    const request = new LatestRequest();
    const lastWeek = new Subject<string>();
    const thisWeek = new Subject<string>();
    const shown: string[] = [];

    lastWeek.pipe(request.latest()).subscribe((v) => shown.push(v));
    thisWeek.pipe(request.latest()).subscribe((v) => shown.push(v));

    // This week answers first, then last week's slower answer arrives.
    thisWeek.next('this week');
    lastWeek.next('last week');

    expect(shown).toEqual(['this week']);
    expect(lastWeek.observed).toBe(false);
  });

  it('lets a request that was not overtaken finish normally', () => {
    const request = new LatestRequest();
    const source = new Subject<number>();
    const shown: number[] = [];
    let completed = false;

    source.pipe(request.latest()).subscribe({
      next: (v) => shown.push(v),
      complete: () => (completed = true),
    });
    source.next(1);
    source.complete();

    expect(shown).toEqual([1]);
    expect(completed).toBe(true);
  });

  it('stops listening when cancelled', () => {
    const request = new LatestRequest();
    const source = new Subject<number>();
    const shown: number[] = [];

    source.pipe(request.latest()).subscribe((v) => shown.push(v));
    request.cancel();
    source.next(1);

    expect(shown).toEqual([]);
  });
});
