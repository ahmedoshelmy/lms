import { Component, inject, afterNextRender, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { purgeLegacyAttendanceCache } from './core/utils/legacy-storage.utils';
import { PwaService } from './core/services/pwa.service';
import { PwaStatusComponent } from './shared/components/pwa-status/pwa-status.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterOutlet, PwaStatusComponent],
  template: `<router-outlet></router-outlet><app-pwa-status />`,
  styles: '',
})
export class AppComponent {
  private readonly themeService = inject(ThemeService);
  private readonly pwa = inject(PwaService);

  constructor() {
    // Apply the persisted / OS-preferred theme as early as possible
    afterNextRender(() => {
      this.themeService.applyTheme();

      // Register copies older versions kept in the browser. Runs in the browser
      // only, like everything in afterNextRender.
      purgeLegacyAttendanceCache(localStorage);

      // Offline and update notices, the install offer, and the service worker.
      this.pwa.start();
    });
  }
}
