import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { formatClockString, formatMoment } from '../utils/clock.utils';

export type ClockFormat = '24h' | '12h';

/**
 * Whether times read as 16:30 or 4:30 pm, everywhere.
 *
 * A per-browser preference like the theme, not an account setting: it is about
 * how one person reads a screen, and two people sharing a laptop in the office
 * should not have to agree.
 *
 * Everything on the site goes through here rather than calling
 * toLocaleTimeString on its own, because a schedule that shows 16:30 in one
 * panel and 4:30 pm in the next is worse than either on its own.
 */
@Injectable({ providedIn: 'root' })
export class ClockFormatService {
  private static readonly Key = 'lms_clock_format';

  private readonly platformId = inject(PLATFORM_ID);
  private readonly format = signal<ClockFormat>(this.restore());

  readonly current = this.format.asReadonly();
  readonly is12Hour = computed(() => this.format() === '12h');

  private restore(): ClockFormat {
    if (!isPlatformBrowser(this.platformId)) return '24h';
    return localStorage.getItem(ClockFormatService.Key) === '12h' ? '12h' : '24h';
  }

  set(format: ClockFormat): void {
    this.format.set(format);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(ClockFormatService.Key, format);
    }
  }

  toggle(): void {
    this.set(this.is12Hour() ? '24h' : '12h');
  }

  /**
   * A moment in time as a clock reading. Bound as a field so it can be called
   * straight from a template.
   */
  readonly time = (value: string | Date | null | undefined): string =>
    formatMoment(value, this.is12Hour());

  /** A stored wall-clock string, such as "16:30:00". */
  readonly clock = (value: string | null | undefined): string =>
    formatClockString(value, this.is12Hour());

  /** "09:00–10:30", either way round. */
  readonly range = (from: string | null | undefined, to: string | null | undefined): string =>
    `${this.clock(from)}–${this.clock(to)}`;
}
