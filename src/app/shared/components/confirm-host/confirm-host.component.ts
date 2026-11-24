import {
  Component,
  effect,
  inject,
  signal,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ConfirmService } from '../../../core/services/confirm.service';

/**
 * Draws whatever ConfirmService is asking. Rendered once, in the main layout.
 * Closing the dialog any other way -- Escape, the close icon -- is a "no".
 * Focus starts on the safe button, or in the text box when there is one: that
 * is what the question is waiting for, and typing in it commits to nothing.
 */
@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

        @if (q.input; as input) {
          <label class="confirm__label" for="confirm-input">{{ input.label }}</label>
          <!-- PrimeNG looks for [autofocus] in the body before the footer. -->
          <!-- eslint-disable @angular-eslint/template/no-autofocus -->
          <textarea
            autofocus
            id="confirm-input"
            class="confirm__input"
            rows="3"
            [placeholder]="input.placeholder ?? ''"
            [value]="text()"
            (input)="text.set($any($event.target).value)"
          ></textarea>
          <!-- eslint-enable @angular-eslint/template/no-autofocus -->
        }

        <ng-template #footer>
          <div class="confirm__actions">
            <!-- Deliberate: a confirmation opens on its safe choice, as the
                 WAI-ARIA dialog pattern advises. -->
            <!-- eslint-disable @angular-eslint/template/no-autofocus -->
            <button
              type="button"
              class="confirm__btn confirm__btn--reject"
              autofocus
              (click)="q.answer(false)"
            >
              {{ q.rejectLabel ?? 'Keep it' }}
            </button>
            <!-- eslint-enable @angular-eslint/template/no-autofocus -->
            <button
              type="button"
              class="confirm__btn"
              [class.confirm__btn--danger]="q.danger"
              [disabled]="!!q.input?.required && !text().trim()"
              (click)="q.answer(true, text())"
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
    .confirm__label {
      display: block;
      margin: 14px 0 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-secondary);
    }
    .confirm__input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-control);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font: inherit;
      font-size: 14px;
      resize: vertical;
    }
    .confirm__input:focus-visible {
      outline: 2px solid var(--color-secondary);
      outline-offset: 1px;
    }
    .confirm__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .confirm__icon {
      color: var(--color-error-foreground);
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
    /* The solid red: white on the lighter one is too faint, most of all in dark mode. */
    .confirm__btn--danger {
      background: var(--color-error-solid);
      border-color: var(--color-error-solid);
    }
    .confirm__btn:focus-visible {
      outline: 2px solid var(--color-secondary);
      outline-offset: 2px;
    }
  `,
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);

  /** What has been typed into the text box, for the question on screen. */
  protected readonly text = signal('');

  constructor() {
    // Each new question starts with an empty box.
    effect(() => {
      this.confirm.pending();
      untracked(() => this.text.set(''));
    });
  }
}
