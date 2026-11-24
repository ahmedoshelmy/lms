import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error-interceptor';

import { providePrimeNG } from 'primeng/config';
import { LmsPreset } from './core/config/prime-preset';
import { NotificationService } from './core/services/notification.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AppErrorHandler } from './core/errors/app-error-handler';
import { referenceCacheInterceptor } from './core/services/reference-cache.service';
import { PageTitleStrategy } from './core/services/page-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    MessageService,
    NotificationService,
    { provide: ErrorHandler, useClass: AppErrorHandler },
    providePrimeNG({
      // Use data-theme="dark" so PrimeNG and the CSS token system stay in sync
      theme: { preset: LmsPreset, options: { darkModeSelector: '[data-theme="dark"]' } },
    }),
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, authInterceptor, referenceCacheInterceptor])
    ),
  ],
};
