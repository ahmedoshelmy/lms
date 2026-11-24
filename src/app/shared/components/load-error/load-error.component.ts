import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

/**
 * What a page shows when what it needed could not be loaded.
 *
 * Pages used to show nothing at all in that case, or their empty state --
 * "No classes were taught in March", "Nobody in the pipeline" -- which reads
 * as a fact about the school rather than a failed request. The interceptor has
 * already said what went wrong; this says the page is incomplete and offers to
 * try again without reloading the app.
 */
@Component({
  selector: 'app-load-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="load-error" role="alert">
      <i class="pi pi-exclamation-circle load-error__icon" aria-hidden="true"></i>
      <p class="load-error__title">{{ title() }}</p>
      <p class="load-error__detail">{{ detail() }}</p>
      <button type="button" class="load-error__retry" (click)="retry.emit()">
        <i class="pi pi-refresh" aria-hidden="true"></i> Try again
      </button>
    </div>
  `,
  styles: `
    .load-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 40px 20px;
      text-align: center;
      border: 1px dashed var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
    }
    .load-error__icon {
      font-size: 28px;
      color: var(--color-error);
    }
    .load-error__title {
      margin: 4px 0 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .load-error__detail {
      margin: 0;
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .load-error__retry {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 40px;
      margin-top: 10px;
      padding: 8px 16px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .load-error__retry:hover {
      background: var(--color-surface-hover);
    }
    .load-error__retry:focus-visible {
      outline: 2px solid var(--color-secondary);
      outline-offset: 2px;
    }
  `,
})
export class LoadErrorComponent {
  readonly title = input('This could not be loaded');
  readonly detail = input('Check your connection, then try again.');
  readonly retry = output<void>();
}
