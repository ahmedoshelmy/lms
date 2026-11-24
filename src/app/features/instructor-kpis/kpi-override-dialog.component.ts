import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import {
  InstructorKpi,
  KPI_INDICATORS,
  KpiIndicatorKey,
} from '../../core/interfaces/InstructorKpi';
import { formatPercent, indicatorBasis } from '../../core/utils/kpi.utils';

/** At least a sentence: the owner reads this next to the changed figure. */
export const MIN_REASON_LENGTH = 10;

/** Counted without the spaces around it: ten spaces are not a reason. */
function minTrimmedLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null =>
    String(control.value ?? '').trim().length >= min ? null : { minTrimmedLength: min };
}

export interface KpiOverrideTarget {
  kpi: InstructorKpi;
  indicator: KpiIndicatorKey;
}

/**
 * Adjusting one indicator for one instructor and month. The calculated figure
 * stays on screen and on record; the adjustment needs a reason, and the reason
 * is printed with it on the owner's report.
 */
@Component({
  selector: 'app-kpi-override-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: 'min(440px, 95vw)' }"
      [header]="header()"
    >
      @if (target(); as t) {
        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
          <p class="text-sm text-[var(--color-text-secondary)]">
            Calculated: <strong>{{ calculated() }}</strong> — {{ basis() }}
          </p>

          <div>
            <label
              for="kpi-override-value"
              class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
              >New figure (%)</label
            >
            <input
              id="kpi-override-value"
              type="number"
              min="0"
              max="100"
              step="0.1"
              formControlName="value"
              class="w-32 px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              [attr.aria-invalid]="showError('value')"
              [attr.aria-describedby]="showError('value') ? 'kpi-override-value-error' : null"
            />
            @if (showError('value')) {
              <span id="kpi-override-value-error" class="mt-1 block text-xs text-error-foreground"
                >Enter a figure from 0 to 100.</span
              >
            }
          </div>

          <div>
            <label
              for="kpi-override-reason"
              class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
              >Why? The owner's report prints this next to the figure.</label
            >
            <textarea
              id="kpi-override-reason"
              rows="3"
              formControlName="reason"
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              [attr.aria-invalid]="showError('reason')"
              [attr.aria-describedby]="showError('reason') ? 'kpi-override-reason-error' : null"
            ></textarea>
            @if (showError('reason')) {
              <span id="kpi-override-reason-error" class="mt-1 block text-xs text-error-foreground"
                >Give a reason of at least {{ minReason }} characters.</span
              >
            }
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
            @if (t.kpi[t.indicator].override) {
              <button
                type="button"
                class="mr-auto text-xs font-semibold text-error-foreground hover:underline"
                [disabled]="saving()"
                (click)="cleared.emit()"
              >
                Remove the adjustment
              </button>
            }
            <button
              type="button"
              class="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-primary)]"
              (click)="visible.set(false)"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-content)] text-sm font-semibold disabled:opacity-50"
              [disabled]="saving()"
            >
              {{ saving() ? 'Saving…' : 'Save adjustment' }}
            </button>
          </div>
        </form>
      }
    </p-dialog>
  `,
})
export class KpiOverrideDialogComponent {
  readonly visible = model(false);
  readonly target = input<KpiOverrideTarget | null>(null);
  readonly saving = input(false);

  readonly saved = output<{ value: number; reason: string }>();
  readonly cleared = output<void>();

  protected readonly minReason = MIN_REASON_LENGTH;
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    value: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
    reason: ['', [Validators.required, minTrimmedLength(MIN_REASON_LENGTH)]],
  });

  private readonly label = computed(() => {
    const t = this.target();
    return t ? KPI_INDICATORS.find((i) => i.key === t.indicator)!.label : '';
  });

  protected readonly header = computed(() => {
    const t = this.target();
    return t ? `${this.label()} — ${t.kpi.instructorName}` : '';
  });

  protected readonly calculated = computed(() => {
    const t = this.target();
    return t ? formatPercent(t.kpi[t.indicator].calculated) : '';
  });

  protected readonly basis = computed(() => {
    const t = this.target();
    return t ? indicatorBasis(t.indicator, t.kpi[t.indicator].detail as never) : '';
  });

  constructor() {
    // Each opening starts from what is on record: the current adjustment, or
    // an empty form.
    effect(() => {
      const t = this.target();
      if (!this.visible() || !t) return;
      const current = t.kpi[t.indicator].override;
      this.form.reset({ value: current?.value ?? null, reason: current?.reason ?? '' });
    });
  }

  protected showError(name: 'value' | 'reason'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { value, reason } = this.form.getRawValue();
    this.saved.emit({ value: Math.round(Number(value) * 10) / 10, reason: reason.trim() });
  }
}
