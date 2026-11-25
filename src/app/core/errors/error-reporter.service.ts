import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Role } from '../interfaces/Role';
import { AuthService } from '../services/auth.service';

/** Where reports go; null switches reporting off. From the environment. */
export const ERROR_REPORT_URL = new InjectionToken<string | null>('ERROR_REPORT_URL', {
  providedIn: 'root',
  factory: () => environment.errorReportUrl,
});

/** The most one page load sends: one fault can throw on every change. */
export const MAX_REPORTS_PER_LOAD = 20;

/** One error, as sent. The contract is docs/client-errors.api.md. */
export interface ClientErrorReport {
  message: string;
  stack: string | null;
  /** The page, its ids masked and without the query: /students/:id */
  path: string;
  /** The build, from the main script's hashed name. */
  release: string | null;
  role: string | null;
  userAgent: string;
  at: string;
}

/**
 * Reports errors nobody caught to the school's own server, so a fault is
 * known before somebody rings about it.
 *
 * Nothing personal goes in a report: no names, emails, ids, typed text or
 * query strings -- the page path has its ids masked, and the person is known
 * only by their role. The same error is sent once a page load, and no more
 * than MAX_REPORTS_PER_LOAD in all.
 */
@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private readonly url = inject(ERROR_REPORT_URL);
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthService);
  private readonly sent = new Set<string>();

  report(error: unknown): void {
    const win = this.document.defaultView;
    if (!this.url || !win || this.sent.size >= MAX_REPORTS_PER_LOAD) return;

    const { message, stack } = describe(error);
    const key = `${message}\n${stack?.split('\n')[1] ?? ''}`;
    if (this.sent.has(key)) return;
    this.sent.add(key);

    const role = this.auth.currentRole();
    const report: ClientErrorReport = {
      message: message.slice(0, 500),
      stack: stack ? stack.split('\n').slice(0, 20).join('\n').slice(0, 4000) : null,
      path: maskIds(win.location.pathname),
      release: this.release(),
      role: role === null ? null : Role[role],
      userAgent: win.navigator.userAgent.slice(0, 300),
      at: new Date().toISOString(),
    };

    // A beacon outlives the page, and needs no answer. No credentials go with
    // it: the endpoint takes reports from anybody, and rate-limits them.
    const body = new Blob([JSON.stringify(report)], { type: 'application/json' });
    try {
      if (win.navigator.sendBeacon?.(this.url, body)) return;
    } catch {
      // Falls through to fetch.
    }
    win
      .fetch(this.url, { method: 'POST', body, keepalive: true, credentials: 'omit' })
      .catch(() => undefined);
  }

  /** main-ABCD1234.js names the build exactly. */
  private release(): string | null {
    const src = this.document.querySelector('script[src*="main-"]')?.getAttribute('src');
    return src ? (/main-([A-Z0-9]+)\.js/.exec(src)?.[1] ?? null) : null;
  }
}

function describe(error: unknown): { message: string; stack: string | null } {
  const inner =
    error && typeof error === 'object' && 'rejection' in error
      ? (error as { rejection: unknown }).rejection
      : error;
  if (inner instanceof Error) return { message: inner.message, stack: inner.stack ?? null };
  return { message: String(inner), stack: null };
}

/** /students/21/edit -> /students/:id/edit; long hex or GUID segments too. */
export function maskIds(path: string): string {
  return path
    .split('/')
    .map((part) => (/^\d+$|^[0-9a-f-]{16,}$/i.test(part) ? ':id' : part))
    .join('/');
}
