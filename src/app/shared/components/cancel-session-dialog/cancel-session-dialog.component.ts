import { Component, computed, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CancellationCause, CancelSessionPayload } from '../../../core/interfaces/History';

interface CauseChoice {
  value: CancellationCause;
  label: string;
  hint: string;
  icon: string;
  /** Whether the person cancelling still has to say what happened. */
  needsDetail: boolean;
}

/**
 * The one place a class is called off.
 *
 * Two screens cancel classes and both used to do it with a single red button
 * and no question asked, so the only record of why was whatever somebody
 * happened to type into the edit box afterwards — which meant the school could
 * see that forty classes were lost in a month and never why. The cause is now
 * asked for first, and it is the part that gets counted.
 */
@Component({
  selector: 'app-cancel-session-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './cancel-session-dialog.component.html',
})
export class CancelSessionDialogComponent {
  /** Open state, two-way so the host can close it after a successful save. */
  visible = model(false);

  /** What is being cancelled, for the sentence at the top. */
  sessionLabel = input('this class');

  /** Whether the group has later classes that could move back a week. */
  canShift = input(true);

  saving = input(false);

  confirmed = output<CancelSessionPayload>();

  protected readonly choices: CauseChoice[] = [
    {
      value: 'Instructor',
      label: 'Instructor',
      hint: 'They could not teach it',
      icon: 'pi pi-user',
      needsDetail: true,
    },
    {
      value: 'Parents',
      label: 'Parents',
      hint: 'The family called it off',
      icon: 'pi pi-home',
      needsDetail: true,
    },
    {
      value: 'Holiday',
      label: 'Holiday',
      hint: 'A public holiday or a break',
      icon: 'pi pi-calendar-times',
      needsDetail: false,
    },
  ];

  protected cause = signal<CancellationCause | null>(null);
  protected detail = signal('');
  protected shift = signal(true);
  protected showErrors = signal(false);

  /** A holiday is its own reason; anything else needs one in writing. */
  protected readonly needsDetail = computed(
    () => this.choices.find((c) => c.value === this.cause())?.needsDetail ?? false
  );

  protected readonly missingDetail = computed(() => this.needsDetail() && !this.detail().trim());

  protected readonly detailLabel = computed(() =>
    this.cause() === 'Parents'
      ? 'What did the family give as their reason?'
      : 'What kept the instructor from teaching it?'
  );

  protected choose(cause: CancellationCause): void {
    this.cause.set(cause);
    this.showErrors.set(false);

    // Typing an explanation and then picking Holiday would otherwise keep the
    // text on screen beside a question nobody is being asked any more.
    if (!this.needsDetail()) {
      this.detail.set('');
    }
  }

  protected submit(): void {
    if (!this.cause() || this.missingDetail()) {
      this.showErrors.set(true);
      return;
    }

    this.confirmed.emit({
      shiftUpcomingSchedule: this.canShift() && this.shift(),
      cause: this.cause(),
      reason: this.needsDetail() ? this.detail().trim() : null,
    });
  }

  protected close(): void {
    this.visible.set(false);
  }

  /** Every answer forgotten between openings, so the next one starts clean. */
  protected onVisibleChange(open: boolean): void {
    if (!open) {
      this.cause.set(null);
      this.detail.set('');
      this.shift.set(true);
      this.showErrors.set(false);
    }
  }
}
