import { Component, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ConfirmService } from '../../../core/services/confirm.service';

/**
 * Draws whatever ConfirmService is asking. Rendered once, in the main layout.
 * Closing the dialog any other way -- Escape, the close icon -- is a "no".
 * Focus starts on the safe button.
 */
@Component({
  selector: 'app-confirm-host',
  standalone: true,
  imports: [DialogModule],
  template: `
    @if (confirm.pending(); as q) {
      <p-dialog
        [visible]="true"
        (visibleChange)="!$event && q.answer(false)"
        [header]="q.header"
        [modal]="true"
        [closeOnEscape]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: 'min(28rem, calc(100vw - 2rem))' }"
        appendTo="body"
      >
        <p class="confirm__message">
          @if (q.danger) {
            <i class="pi pi-exclamation-triangle confirm__icon" aria-hidden="true"></i>
          }
          <span>{{ q.message }}</span>
        </p>

        <ng-template #footer>
          <div class="confirm__actions">
            <button
              type="button"
              class="confirm__btn confirm__btn--reject"
              autofocus
              (click)="q.answer(false)"
            >
              {{ q.rejectLabel ?? 'Keep it' }}
            </button>
            <button
              type="button"
              class="confirm__btn"
              [class.confirm__btn--danger]="q.danger"
              (click)="q.answer(true)"
            >
              {{ q.acceptLabel }}
            </button>
          </div>
        </ng-template>
      </p-dialog>
    }
  `,
  styles: `
    .confirm__message {
      display: flex;
      gap: 10px;
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text-primary);
    }
    .confirm__icon {
      color: var(--color-error);
      margin-top: 3px;
    }
    .confirm__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .confirm__btn {
      min-height: 40px;
      padding: 8px 16px;
      border-radius: 10px;
      border: 1px solid var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-content);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .confirm__btn--reject {
      background: var(--color-surface);
      border-color: var(--color-border);
      color: var(--color-text-primary);
    }
    .confirm__btn--danger {
      background: var(--color-error);
      border-color: var(--color-error);
    }
    .confirm__btn:focus-visible {
      outline: 2px solid var(--color-secondary);
      outline-offset: 2px;
    }
  `,
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
}
