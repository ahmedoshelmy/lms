import { HttpContextToken } from '@angular/common/http';

/**
 * Status codes a request handles itself, and does not want reported to the user.
 *
 * The error interceptor shouts about every failure, which is right for the
 * unexpected ones. Some are expected: asking for the syllabus of a trial session
 * is a 404 by design, because a trial belongs to no curriculum. Toasting that
 * tells the user something is broken when nothing is.
 *
 * Only the listed codes are silenced, so a 500 from the same endpoint still
 * surfaces.
 */
export const SILENT_STATUSES = new HttpContextToken<number[]>(() => []);
