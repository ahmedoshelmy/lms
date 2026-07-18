import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly THEME_KEY = 'lms_theme';

  private themeSignal = signal<Theme>(this.resolveInitialTheme());
  readonly theme$ = this.themeSignal.asReadonly();
  readonly isDark = computed(() => this.themeSignal() === 'dark');

  private resolveInitialTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) return 'light';
    const stored = localStorage.getItem(this.THEME_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    // Default to light mode regardless of OS preference
    return 'light';
  }

  /** Apply the current theme to the <html> element. Call once on app bootstrap. */
  applyTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.setThemeOnDom(this.themeSignal());
  }

  toggleTheme(): void {
    const next: Theme = this.themeSignal() === 'dark' ? 'light' : 'dark';
    this.themeSignal.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.THEME_KEY, next);
      this.setThemeOnDom(next);
    }
  }

  setTheme(theme: Theme): void {
    this.themeSignal.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.THEME_KEY, theme);
      this.setThemeOnDom(theme);
    }
  }

  private setThemeOnDom(theme: Theme): void {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    // Keep PrimeNG in sync — its darkModeSelector is [data-theme="dark"]
    if (theme === 'dark') {
      html.classList.add('p-dark');
    } else {
      html.classList.remove('p-dark');
    }
  }
}
