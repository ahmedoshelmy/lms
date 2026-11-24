import { environment } from '../../../environments/environment';

/** Where a development build keeps an overridden API address. */
export const API_URL_STORAGE_KEY = 'lms_api_url';

export interface ApiUrlSettings {
  apiUrl: string;
  allowApiUrlOverride: boolean;
}

/**
 * The API address, from one place.
 *
 * The built-in address, unless this is a build that allows overriding it and
 * one has been saved. A production build ignores a saved override -- and
 * removes it, so an address somebody was talked into saving does not wait
 * there for a later build that would honour it.
 *
 * Read on every call rather than once, because a development build can change
 * it from Settings while running.
 */
export function resolveApiUrl(
  settings: ApiUrlSettings = environment,
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage
): string {
  if (!storage) {
    return settings.apiUrl;
  }

  if (!settings.allowApiUrlOverride) {
    storage.removeItem(API_URL_STORAGE_KEY);
    return settings.apiUrl;
  }

  return storage.getItem(API_URL_STORAGE_KEY) || settings.apiUrl;
}
