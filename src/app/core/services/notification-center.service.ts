import { DOCUMENT, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { AppNotification, NotificationFeed } from '../interfaces/Notification';
import { AuthService } from './auth.service';
import { LmsService } from './lms.service';

/**
 * The bell's state, kept in one place.
 *
 * Polled rather than pushed. A websocket would arrive a minute sooner and cost
 * a hub, reconnection handling and hosting that keeps connections alive; for
 * "your Saturday class was cancelled" a minute is not the difference, and the
 * email is what actually reaches somebody who is not looking at the page.
 *
 * Root-provided so the bell can appear in more than one place — the sidebar and
 * the mobile header — without each copy running its own timer.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  /** Often enough to feel live, rarely enough to be invisible on a phone bill. */
  private static readonly PollMs = 60_000;

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly lms = inject(LmsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  private readonly feed = signal<NotificationFeed>({ items: [], unreadCount: 0 });
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;

  readonly items = computed<AppNotification[]>(() => this.feed().items);
  readonly unreadCount = computed(() => this.feed().unreadCount);
  readonly loading = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.start();

    // Coming back to a tab that has been in the background for an hour should
    // show the truth immediately, not a minute later.
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        this.refresh();
      }
    });
  }

  private start(): void {
    this.refresh();

    this.timer ??= setInterval(() => {
      // Nothing is gained by polling a tab nobody is looking at, and a laptop
      // left open for a week would make a thousand pointless requests.
      if (this.document.visibilityState === 'visible') {
        this.refresh();
      }
    }, NotificationCenterService.PollMs);
  }

  /**
   * Fetches the list and the count. Never surfaces an error: a bell that
   * cannot reach the server should sit quietly, not throw a toast over
   * whatever the person is actually doing.
   */
  refresh(): void {
    if (!this.auth.isLoggedIn() || this.inFlight) {
      return;
    }

    this.inFlight = true;
    this.http
      .get<NotificationFeed>(`${this.apiUrl()}/notifications`)
      .pipe(catchError(() => of(null)))
      .subscribe((feed) => {
        this.inFlight = false;
        if (feed) {
          this.feed.set(feed);
        }
      });
  }

  markRead(notification: AppNotification): void {
    if (notification.isRead) {
      return;
    }

    // Moved locally first so the badge responds to the click rather than to
    // the round trip; the response replaces it either way.
    this.applyLocally(notification.id);

    this.http
      .post<NotificationFeed>(`${this.apiUrl()}/notifications/${notification.id}/read`, {})
      .pipe(catchError(() => of(null)))
      .subscribe((feed) => feed && this.feed.set(feed));
  }

  markAllRead(): void {
    if (!this.unreadCount()) {
      return;
    }

    this.loading.set(true);
    this.http
      .post<NotificationFeed>(`${this.apiUrl()}/notifications/read-all`, {})
      .pipe(catchError(() => of(null)))
      .subscribe((feed) => {
        this.loading.set(false);
        if (feed) {
          this.feed.set(feed);
        }
      });
  }

  /** Empties the bell on sign-out, so the next person does not see it. */
  clear(): void {
    this.feed.set({ items: [], unreadCount: 0 });
  }

  private applyLocally(id: number): void {
    const now = new Date().toISOString();
    this.feed.update((feed) => ({
      items: feed.items.map((item) =>
        item.id === id ? { ...item, readAt: now, isRead: true } : item
      ),
      unreadCount: Math.max(0, feed.unreadCount - 1),
    }));
  }

  /** The base URL is per-browser and changeable from Settings, so it is asked
   *  for on every call rather than captured once. */
  private apiUrl(): string {
    return this.lms.getApiUrl();
  }
}
