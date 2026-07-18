import { Component, inject, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
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
    });
  }
}
