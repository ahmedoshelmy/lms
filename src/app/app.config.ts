import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { provideAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error-interceptor';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { NotificationService } from './core/services/notification.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    MessageService,
    NotificationService,
    providePrimeNG({
      theme: { preset: Aura, options: { darkModeSelector: '.p-dark' } },
    }),
    provideAnimations(),
    provideHttpClient(withInterceptors([errorInterceptor])),
  ],
};
