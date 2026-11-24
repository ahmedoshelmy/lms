import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  header: string;
  /** What will happen, in the words the person would use. */
  message: string;
  /** The verb on the button that goes ahead, e.g. "Remove candidate". */
  acceptLabel: string;
  /** The button that backs out. Defaults to "Keep it". */
  rejectLabel?: string;
  /** Styles the go-ahead button as destructive. */
  danger?: boolean;
}

/** A question waiting for an answer, as the dialog host reads it. */
export interface PendingConfirm extends ConfirmOptions {
  answer(confirmed: boolean): void;
}

/**
 * Asks before something that cannot be taken back, in one consistent dialog.
 *
 * Answers with a promise, so a call site reads as
 * `if (!(await confirm.ask(...))) return;`. The dialog is drawn once, by
 * ConfirmHostComponent in the main layout, from the same PrimeNG dialog every
 * other modal here uses -- PrimeNG's own confirm dialog pulled ~6 kB of extra
 * framework code into the first download for this alone.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly current = signal<PendingConfirm | null>(null);

  /** The question on screen, or null. */
  readonly pending = this.current.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    // A second question replaces the first, which counts as "no".
    this.current()?.answer(false);

    return new Promise<boolean>((resolve) => {
      const pending: PendingConfirm = {
        ...options,
        answer: (confirmed) => {
          if (this.current() === pending) {
            this.current.set(null);
          }
          resolve(confirmed);
        },
      };
      this.current.set(pending);
    });
  }
}
