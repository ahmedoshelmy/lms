import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { KPI_INDICATORS, KpiSettings } from '../../core/interfaces/InstructorKpi';
import { KpiService } from '../../core/services/kpi.service';
import { LoadErrorComponent } from '../../shared/components/load-error/load-error.component';
import { weightsAreValid } from '../../core/utils/kpi.utils';

/** The three weights as whole numbers adding up to 100. */
function weightsAddUp(group: AbstractControl): ValidationErrors | null {
  const v = group.value as { reports: number; registers: number; cancellations: number };
  return weightsAreValid({
    reports: Number(v.reports),
    registers: Number(v.registers),
    cancellations: Number(v.cancellations),
  })
    ? null
    : { weights: true };
}

/** Excellent above Good, both within 0-100. */
function bandsInOrder(group: AbstractControl): ValidationErrors | null {
  const { excellent, good } = group.value as { excellent: number; good: number };
  const ok =
    [excellent, good].every((n) => n !== null && n >= 0 && n <= 100) &&
    Number(excellent) > Number(good);
  return ok ? null : { bands: true };
}

/**
 * How the overall score is weighted, where the bands start, and who "Send to
 * owner" goes to. Applies to open months; an approved month keeps the
 * settings it was approved with.
 */
@Component({
  selector: 'app-kpi-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule, LoadErrorComponent],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: 'min(480px, 95vw)' }"
      header="KPI settings"
    >
      @if (loadFailed()) {
        <app-load-error title="The settings could not be loaded" (retry)="load()" />
      } @else if (loading()) {
        <p class="text-sm text-[var(--color-text-muted)]">Loading…</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-5">
          <fieldset formGroupName="weights" class="flex flex-col gap-2">
            <legend class="text-sm font-bold text-[var(--color-text-primary)] mb-1">
              Weight of each indicator in the overall score
            </legend>
            @for (ind of indicators; track ind.key) {
              <div class="flex items-center justify-between gap-3">
                <label
                  [attr.for]="'kpi-weight-' + ind.key"
                  class="text-sm text-[var(--color-text-secondary)]"
                  >{{ ind.label }}</label
                >
                <span class="flex items-center gap-1">
                  <input
                    [id]="'kpi-weight-' + ind.key"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    [formControlName]="ind.key"
                    class="w-20 px-2 py-1.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm text-right"
                  />
                  <span class="text-sm text-[var(--color-text-muted)]" aria-hidden="true">%</span>
                </span>
              </div>
            }
            <p
              class="text-xs"
              [class.text-error-foreground]="form.controls.weights.invalid"
              [class.text-[var(--color-text-muted)]]="form.controls.weights.valid"
              aria-live="polite"
            >
              Total {{ weightTotal() }}% — whole numbers adding up to 100.
            </p>
          </fieldset>

          <fieldset formGroupName="bands" class="flex flex-col gap-2">
            <legend class="text-sm font-bold text-[var(--color-text-primary)] mb-1">Bands</legend>
            <div class="flex items-center justify-between gap-3">
              <label for="kpi-band-excellent" class="text-sm text-[var(--color-text-secondary)]"
                >Excellent from</label
              >
              <input
                id="kpi-band-excellent"
                type="number"
                min="0"
                max="100"
                formControlName="excellent"
                class="w-20 px-2 py-1.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm text-right"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <label for="kpi-band-good" class="text-sm text-[var(--color-text-secondary)]"
                >Good from (below: Needs attention)</label
              >
              <input
                id="kpi-band-good"
                type="number"
                min="0"
                max="100"
                formControlName="good"
                class="w-20 px-2 py-1.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm text-right"
              />
            </div>
            @if (form.controls.bands.invalid) {
              <p class="text-xs text-error-foreground" role="alert">
                Excellent has to start above Good, both between 0 and 100.
              </p>
            }
          </fieldset>

          <div>
            <label
              for="kpi-owner-email"
              class="block text-sm font-bold text-[var(--color-text-primary)] mb-1"
              >Owner's email, for "Send to owner"</label
            >
            <input
              id="kpi-owner-email"
              type="email"
              formControlName="ownerEmail"
              autocomplete="off"
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              [attr.aria-invalid]="form.controls.ownerEmail.invalid"
            />
            @if (form.controls.ownerEmail.invalid && form.controls.ownerEmail.touched) {
              <span class="mt-1 block text-xs text-error-foreground">Enter a valid email.</span>
            }
          </div>

          <p class="text-xs text-[var(--color-text-muted)]">
            Changes apply to months not yet approved. An approved month keeps the settings it was
            approved with.
          </p>

          <div class="flex justify-end gap-2">
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
              {{ saving() ? 'Saving…' : 'Save settings' }}
            </button>
          </div>
        </form>
      }
    </p-dialog>
  `,
})
export class KpiSettingsDialogComponent {
  readonly visible = model(false);
  readonly saved = output<KpiSettings>();

  private readonly kpis = inject(KpiService);
  private readonly fb = inject(FormBuilder);

  protected readonly indicators = KPI_INDICATORS;
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly weightTotal = signal(0);

  readonly form = this.fb.group({
    weights: this.fb.nonNullable.group(
      { reports: 40, registers: 40, cancellations: 20 },
      { validators: weightsAddUp }
    ),
    bands: this.fb.nonNullable.group({ excellent: 90, good: 75 }, { validators: bandsInOrder }),
    ownerEmail: this.fb.control<string | null>(null, [Validators.email]),
  });

  constructor() {
    this.form.controls.weights.valueChanges.subscribe((w) =>
      this.weightTotal.set(
        Number(w.reports ?? 0) + Number(w.registers ?? 0) + Number(w.cancellations ?? 0)
      )
    );
    // Fresh from the server each time it opens: another admin may have changed them.
    effect(() => {
      if (this.visible()) untracked(() => this.load());
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.kpis.getSettings().subscribe({
      next: (settings) => {
        this.form.reset({
          weights: settings.weights,
          bands: settings.bands,
          ownerEmail: settings.ownerEmail,
        });
        this.weightTotal.set(
          settings.weights.reports + settings.weights.registers + settings.weights.cancellations
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const settings: KpiSettings = {
      weights: {
        reports: Number(v.weights.reports),
        registers: Number(v.weights.registers),
        cancellations: Number(v.weights.cancellations),
      },
      bands: { excellent: Number(v.bands.excellent), good: Number(v.bands.good) },
      ownerEmail: v.ownerEmail?.trim() || null,
    };
    this.saving.set(true);
    this.kpis.saveSettings(settings).subscribe({
      next: (stored) => {
        this.saving.set(false);
        this.visible.set(false);
        this.saved.emit(stored);
      },
      // The error interceptor says what went wrong; the dialog stays open.
      error: () => this.saving.set(false),
    });
  }
}
