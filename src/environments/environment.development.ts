/** Development settings; replaces `environment.ts` in a development build. */
export const environment = {
  production: false,
  apiUrl: 'https://mv-api.inite.tech/api',

  /** Lets Settings point this browser at a local or staging API while developing. */
  allowApiUrlOverride: true,

  /** Not reported while developing: the console has them. */
  errorReportUrl: null as string | null,

  /** On while developing, to work on them; see environment.ts. */
  features: {
    instructorKpis: true,
  },
};
