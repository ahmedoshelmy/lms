import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { errorMessage } from './error-interceptor';

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

  it('falls back to a general message otherwise', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500 }))).toBe('Something went wrong');
  });
});
