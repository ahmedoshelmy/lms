/**
 * Production settings. `environment.development.ts` replaces this file in a
 * development build (see `fileReplacements` in angular.json).
 */
export const environment = {
  production: true,

  /** The API every request goes to. */
  apiUrl: 'https://mv-api.inite.tech/api',

  /**
   * Whether Settings may point this browser at a different API. Never in
   * production: the sign-in form and every token would follow whatever
   * address was stored, so anybody talked into typing one in would be sending
   * their password to it.
   */
  allowApiUrlOverride: false,

  /**
   * Features built ahead of the server endpoints they need. Each stays off here
   * until its endpoints are live; nothing stands in for a missing one.
   */
  /**
   * Where the app reports errors nobody caught (docs/client-errors.api.md).
   * Null switches reporting off. Its host has to be allowed by connect-src in
   * nginx-security-headers.conf and vercel.json.
   */
  errorReportUrl: 'https://mv-api.inite.tech/api/client-errors' as string | null,

  features: {
    /** docs/instructor-kpis.api.md; the server has had it since backend cc476e8. */
    instructorKpis: true,
  },
};
