import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { REPEAT_QUIET_MS, RepeatFilter, errorMessage } from './error-interceptor';

describe('errorMessage', () => {
  it("uses the server's own message when there is one", () => {
    expect(
      errorMessage(new HttpErrorResponse({ status: 409, error: { message: 'Room is full.' } }))
    ).toBe('Room is full.');
  });

  it('says the server could not be reached when the request never arrived', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain(
      'Could not reach the server'
    );
  });

  it("prefers that over the browser's own wording for a failed fetch", () => {
    // fetch() failures carry a TypeError whose message is "Failed to fetch".
    const offline = new HttpErrorResponse({ status: 0, error: new TypeError('Failed to fetch') });

    expect(errorMessage(offline)).toContain('Could not reach the server');
  });

  it('falls back to a general message otherwise', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500 }))).toBe('Something went wrong');
  });
});

describe('RepeatFilter', () => {
  it('shows a burst of the same message once', () => {
    const filter = new RepeatFilter();

    expect(filter.shouldShow('Could not reach the server', 1_000)).toBe(true);
    expect(filter.shouldShow('Could not reach the server', 1_200)).toBe(false);
    expect(filter.shouldShow('Could not reach the server', 1_400)).toBe(false);
  });

  it('shows a different message straight away', () => {
    const filter = new RepeatFilter();
    filter.shouldShow('Room is full.', 1_000);

    expect(filter.shouldShow('Group not found.', 1_100)).toBe(true);
  });

  it('shows the same message again once things have been quiet', () => {
    const filter = new RepeatFilter();
    filter.shouldShow('Room is full.', 1_000);

    expect(filter.shouldShow('Room is full.', 1_000 + REPEAT_QUIET_MS + 1)).toBe(true);
  });
});
