import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  InstructorKpi,
  KPI_BAND_LABELS,
  KPI_INDICATORS,
  KpiIndicatorKey,
} from '../../core/interfaces/InstructorKpi';
import { KpiService } from '../../core/services/kpi.service';
import { toIsoMonth } from '../../core/utils/date.utils';
import {
  formatPercent,
  indicatorBasis,
  monthLabel,
  monthsBefore,
} from '../../core/utils/kpi.utils';
import { LoadErrorComponent } from '../../shared/components/load-error/load-error.component';

/**
 * An instructor's own KPIs: approved months only, so nothing they see here
 * can still change under them. The latest in full, the year before it as a
 * table.
 */
@Component({
  selector: 'app-my-kpis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LoadErrorComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto flex flex-col gap-5">
      <div>
        <h1 class="text-2xl font-extrabold text-[var(--color-text-primary)]">My KPIs</h1>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">
          Your months once the school has approved them: monthly reports on time, registers on time
          and classes kept.
        </p>
      </div>

      @if (loadFailed()) {
        <app-load-error title="Your KPIs could not be loaded" (retry)="load()" />
      } @else if (loading()) {
        <p class="text-sm text-[var(--color-text-muted)]" aria-live="polite">Loading…</p>
      } @else if (latest(); as kpi) {
        <section
          class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col gap-4"
          [attr.aria-label]="monthLabel(kpi.month)"
        >
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-lg font-bold text-[var(--color-text-primary)]">
              {{ monthLabel(kpi.month) }}
            </h2>
            <div class="text-right">
              <p class="text-2xl font-extrabold text-[var(--color-text-primary)]">
                {{ formatPercent(kpi.overall) }}
              </p>
              @if (kpi.band) {
                <p class="text-xs font-bold text-[var(--color-text-secondary)]">
                  {{ bandLabels[kpi.band] }}
                </p>
              }
            </div>
          </div>
          <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            @for (ind of indicators; track ind.key) {
              <div class="rounded-xl bg-[var(--color-surface-secondary)] p-3">
                <dt class="text-xs font-semibold text-[var(--color-text-muted)]">
                  {{ ind.label }}
                </dt>
                <dd class="text-xl font-extrabold text-[var(--color-text-primary)]">
                  {{ formatPercent(kpi[ind.key].value) }}
                </dd>
                <dd class="text-xs text-[var(--color-text-muted)]">{{ basis(kpi, ind.key) }}</dd>
                @if (kpi[ind.key].override; as o) {
                  <dd class="text-xs text-[var(--color-text-secondary)] mt-1">
                    Adjusted from {{ formatPercent(kpi[ind.key].calculated) }}: “{{ o.reason }}”
                  </dd>
                }
              </div>
            }
          </dl>
        </section>

        @if (earlier().length) {
          <div
            class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <table class="w-full min-w-[520px] text-sm text-left">
              <caption class="sr-only">
                Earlier months
              </caption>
              <thead>
                <tr
                  class="border-b border-[var(--color-border)] text-xs font-bold uppercase text-[var(--color-text-muted)]"
                >
                  <th scope="col" class="px-4 py-3">Month</th>
                  @for (ind of indicators; track ind.key) {
                    <th scope="col" class="px-4 py-3">{{ ind.short }}</th>
                  }
                  <th scope="col" class="px-4 py-3">Overall</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--color-border)]">
                @for (row of earlier(); track row.month) {
                  <tr>
                    <th
                      scope="row"
                      class="px-4 py-2.5 font-semibold text-[var(--color-text-primary)]"
                    >
                      {{ monthLabel(row.month) }}
                    </th>
                    @for (ind of indicators; track ind.key) {
                      <td class="px-4 py-2.5">{{ formatPercent(row[ind.key].value) }}</td>
                    }
                    <td class="px-4 py-2.5 font-bold">
                      {{ formatPercent(row.overall) }}
                      @if (row.band) {
                        <span class="font-normal text-[var(--color-text-muted)]">
                          · {{ bandLabels[row.band] }}</span
                        >
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <div
          class="rounded-2xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-text-muted)]"
        >
          No approved months yet. They appear here once the school has reviewed them, early in the
          following month.
        </div>
      }
    </div>
  `,
})
export class MyKpisComponent implements OnInit {
  private readonly kpis = inject(KpiService);

  protected readonly rows = signal<InstructorKpi[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);

  protected readonly indicators = KPI_INDICATORS;
  protected readonly bandLabels = KPI_BAND_LABELS;
  protected readonly formatPercent = formatPercent;
  protected readonly monthLabel = monthLabel;

  private readonly sorted = computed(() =>
    [...this.rows()].sort((a, b) => b.month.localeCompare(a.month))
  );
  protected readonly latest = computed(() => this.sorted()[0] ?? null);
  protected readonly earlier = computed(() => this.sorted().slice(1));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const to = toIsoMonth(new Date());
    this.loading.set(true);
    this.loadFailed.set(false);
    this.kpis.getMine(monthsBefore(to, 11), to).subscribe({
      next: (rows) => {
        this.rows.set(rows ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected basis(kpi: InstructorKpi, key: KpiIndicatorKey): string {
    return indicatorBasis(key, kpi[key].detail as never);
  }
}
