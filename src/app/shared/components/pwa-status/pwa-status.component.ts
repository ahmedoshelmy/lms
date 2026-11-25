import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaService } from '../../../core/services/pwa.service';

/**
 * The two things the installed app has to say on its own: that the connection
 * is gone, and that a new version is ready. Both sit at the foot of the screen,
 * over every page, the sign-in page included.
 */
@Component({
  selector: 'app-pwa-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="pwa-status" role="status" aria-live="polite">
      @if (!pwa.online()) {
        <p class="pwa-bar pwa-bar--offline">
          <i class="pi pi-wifi" aria-hidden="true"></i>
          <span
            >You're offline. You can look around, but nothing can be saved until you're back.</span
          >
        </p>
      }
      @if (pwa.updateReady()) {
        <p class="pwa-bar">
          <i class="pi pi-refresh" aria-hidden="true"></i>
          <span>A new version of the app is ready.</span>
          <button type="button" class="pwa-bar__action" (click)="pwa.reload()">Reload</button>
        </p>
      }
    </div>
  `,
  styles: `
    .pwa-status {
      position: fixed;
      left: 50%;
      bottom: calc(1rem + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: 1500;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: min(34rem, calc(100vw - 1.5rem));
      pointer-events: none;
    }
    .pwa-bar {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin: 0;
      padding: 0.625rem 0.875rem;
      border-radius: 12px;
      background: var(--color-primary);
      color: var(--color-primary-content);
      font-size: 0.8125rem;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      pointer-events: auto;
    }
    .pwa-bar--offline {
      background: var(--color-warning-solid);
    }
    .pwa-bar span {
      flex: 1;
    }
    .pwa-bar__action {
      padding: 0.375rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--color-primary-content);
      background: transparent;
      color: var(--color-primary-content);
      font-weight: 700;
      cursor: pointer;
    }
    .pwa-bar__action:focus-visible {
      outline: 2px solid var(--color-primary-content);
      outline-offset: 2px;
    }
  `,
})
export class PwaStatusComponent {
  protected readonly pwa = inject(PwaService);
}
