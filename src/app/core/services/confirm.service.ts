import { Injectable, signal } from '@angular/core';

/** A text box in the confirmation, for a reason or a note. */
export interface ConfirmInput {
  label: string;
  placeholder?: string;
  /** The go-ahead button stays disabled until something is typed. */
  required?: boolean;
}

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
  /** Shows a text box; use askText() to read what was typed. */
  input?: ConfirmInput;
}

/** A question waiting for an answer, as the dialog host reads it. */
export interface PendingConfirm extends ConfirmOptions {
  answer(confirmed: boolean, text?: string): void;
}

interface Answer {
  confirmed: boolean;
  text: string;
}

/**
 * Asks before something that cannot be taken back, in one consistent dialog.
 *
 * Answers with a promise, so a call site reads as
 * `if (!(await confirm.ask(...))) return;`. The dialog is drawn once, by
 * ConfirmHostComponent in the main layout, from the same PrimeNG dialog every
 * other modal here uses -- PrimeNG's own confirm dialog pulled ~6 kB of extra
 * framework code into the first download for this alone.
 *
 * askText() is the same dialog with a text box, in place of window.prompt():
 * the browser's prompt cannot be styled, ignores the theme, and blocks the page.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly current = signal<PendingConfirm | null>(null);

  /** The question on screen, or null. */
  readonly pending = this.current.asReadonly();

  async ask(options: ConfirmOptions): Promise<boolean> {
    return (await this.open(options)).confirmed;
  }

  /** What was typed (trimmed, possibly empty), or null if they backed out. */
  async askText(options: ConfirmOptions & { input: ConfirmInput }): Promise<string | null> {
    const { confirmed, text } = await this.open(options);
    return confirmed ? text.trim() : null;
  }

  private open(options: ConfirmOptions): Promise<Answer> {
    // A second question replaces the first, which counts as "no".
    this.current()?.answer(false);

    return new Promise<Answer>((resolve) => {
      const pending: PendingConfirm = {
        ...options,
        answer: (confirmed, text = '') => {
          if (this.current() === pending) {
            this.current.set(null);
          }
          resolve({ confirmed, text });
        },
      };
      this.current.set(pending);
    });
  }
}
