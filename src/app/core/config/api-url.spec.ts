import { afterEach, describe, expect, it } from 'vitest';
import { API_URL_STORAGE_KEY, resolveApiUrl } from './api-url';

const BUILT_IN = 'https://api.example.test/api';

describe('resolveApiUrl', () => {
  afterEach(() => localStorage.clear());

  it('ignores and removes a saved address in a build that does not allow one', () => {
    localStorage.setItem(API_URL_STORAGE_KEY, 'https://somewhere-else.test/api');

    const url = resolveApiUrl({ apiUrl: BUILT_IN, allowApiUrlOverride: false }, localStorage);

    expect(url).toBe(BUILT_IN);
    expect(localStorage.getItem(API_URL_STORAGE_KEY)).toBeNull();
  });

  it('uses a saved address in a build that allows one', () => {
    localStorage.setItem(API_URL_STORAGE_KEY, 'http://localhost:5000/api');

    expect(resolveApiUrl({ apiUrl: BUILT_IN, allowApiUrlOverride: true }, localStorage)).toBe(
      'http://localhost:5000/api'
    );
  });

  it('falls back to the built-in address when nothing is saved', () => {
    expect(resolveApiUrl({ apiUrl: BUILT_IN, allowApiUrlOverride: true }, localStorage)).toBe(
      BUILT_IN
    );
  });

  it('uses the built-in address where there is no storage, as on a server', () => {
    expect(resolveApiUrl({ apiUrl: BUILT_IN, allowApiUrlOverride: true }, null)).toBe(BUILT_IN);
  });
});
