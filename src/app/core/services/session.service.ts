import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';
import { LmsService } from './lms.service';
import { NotificationCenterService } from './notification-center.service';
import { OperationsService } from './operations.service';

/**
 * Ending a session, in one place.
 *
 * Signing out used to be written out three times (sidebar, "access denied",
 * the outstanding-work window), and the fourth way a session ends -- the
 * server refusing to renew it -- left the bell and the outstanding-work list
 * filled in for the next person on the machine. Another tab signing out did
 * nothing here at all.
 *
 * Whatever ends a session, this clears up after it: it watches for the
 * signed-in user going away rather than relying on every way out to remember.
 * Started by the main layout, so it costs nothing on the login page.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthService);
  private readonly lms = inject(LmsService);
  private readonly router = inject(Router);
  private readonly bell = inject(NotificationCenterService);
  private readonly operations = inject(OperationsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      if (!this.auth.isLoggedIn()) {
        untracked(() => this.clearLeftovers());
      }
    });

    const view = this.document.defaultView;
    if (isPlatformBrowser(this.platformId) && view) {
      const listener = (event: StorageEvent) => this.onStorage(event);
      view.addEventListener('storage', listener);
      inject(DestroyRef).onDestroy(() => view.removeEventListener('storage', listener));
    }
  }

  /** The person chose to sign out: tell the server, then end it here. */
  signOut(): void {
    const finish = () => this.endHere();
    this.lms.logout().subscribe({ next: finish, error: finish });
  }

  private endHere(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** What a session leaves behind in memory, emptied when it ends. */
  private clearLeftovers(): void {
    this.bell.clear();
    this.operations.clear();
  }

  /** Another tab signed out, or signed in as somebody else. */
  private onStorage(event: StorageEvent): void {
    if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return;

    const stored = this.document.defaultView?.localStorage.getItem(AUTH_STORAGE_KEY) ?? null;
    if (!stored) {
      if (this.auth.isLoggedIn()) this.endHere();
      return;
    }

    let storedId: number | null = null;
    try {
      storedId = (JSON.parse(stored) as { id?: number }).id ?? null;
    } catch {
      storedId = null;
    }

    // A different person now owns this browser's session. Start again as
    // them rather than show one person's page with another's permissions.
    if (this.auth.isLoggedIn() && storedId !== this.auth.getUserId()) {
      this.reload();
    }
  }

  /** Separate so tests can see it without reloading the test runner. */
  protected reload(): void {
    this.document.defaultView?.location.reload();
  }
}
