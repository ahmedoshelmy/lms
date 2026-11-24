import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceCache, referenceCacheInterceptor } from './reference-cache.service';

describe('ReferenceCache', () => {
  let cache: ReferenceCache;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cache = TestBed.inject(ReferenceCache);
  });

  it('asks once for a list several pages want', async () => {
    const load = vi.fn(() => of([3, 1, 2]));

    await firstValueFrom(cache.get('topics:x', load));
    await firstValueFrom(cache.get('topics:x', load));

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("gives each caller its own copy, so one page's sort cannot reorder another's", async () => {
    const first = await firstValueFrom(cache.get('topics:x', () => of([3, 1, 2])));
    first.sort();

    expect(await firstValueFrom(cache.get('topics:x', () => of([])))).toEqual([3, 1, 2]);
  });

  it('does not keep a failure: the next caller asks again', async () => {
    const load = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValueOnce(of(['ok']));

    await expect(firstValueFrom(cache.get('rooms:x', load))).rejects.toThrow('down');
    expect(await firstValueFrom(cache.get('rooms:x', load))).toEqual(['ok']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('forgets a list after five minutes', async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn(() => of([1]));
      await firstValueFrom(cache.get('topics:x', load));
      vi.advanceTimersByTime(5 * 60_000 + 1);
      await firstValueFrom(cache.get('topics:x', load));
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears only the lists a write may have changed', async () => {
    const topics = vi.fn(() => of([1]));
    const rooms = vi.fn(() => of([1]));
    await firstValueFrom(cache.get('topics:x', topics));
    await firstValueFrom(cache.get('rooms:false:x', rooms));

    cache.invalidateFor('http://api.test/topics/4/levels');
    await firstValueFrom(cache.get('topics:x', topics));
    await firstValueFrom(cache.get('rooms:false:x', rooms));

    expect(topics).toHaveBeenCalledTimes(2);
    expect(rooms).toHaveBeenCalledTimes(1);
  });
});

describe('referenceCacheInterceptor', () => {
  it('clears the instructors after a user is changed, and leaves them for a read', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([referenceCacheInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const cache = TestBed.inject(ReferenceCache);
    const spy = vi.spyOn(cache, 'invalidateFor');
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);

    http.get('http://api.test/users').subscribe();
    backend.expectOne('http://api.test/users').flush([]);
    expect(spy).not.toHaveBeenCalled();

    http.put('http://api.test/users/4', {}).subscribe();
    backend.expectOne('http://api.test/users/4').flush({});
    expect(spy).toHaveBeenCalledWith('http://api.test/users/4');
  });
});
