import { Component, inject, afterNextRender, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { purgeLegacyAttendanceCache } from './core/utils/legacy-storage.utils';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: '',
})
export class AppComponent {
  private readonly themeService = inject(ThemeService);

  constructor() {
    // Apply the persisted / OS-preferred theme as early as possible
    afterNextRender(() => {
      this.themeService.applyTheme();

      // Register copies older versions kept in the browser. Runs in the browser
      // only, like everything in afterNextRender.
      purgeLegacyAttendanceCache(localStorage);
    });
  }
}
