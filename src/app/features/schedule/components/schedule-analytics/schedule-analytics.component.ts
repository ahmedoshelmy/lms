import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { ScheduleSession } from '../../../../core/interfaces/ScheduleSession';
import { busiestAndQuietest, summariseWeek } from '../../../../core/utils/week-summary.utils';

/**
 * The loaded week in numbers, counted from the sessions on screen and nothing
 * else.
 *
 * It used to show fixed figures ("Saturday Peak (19 Sessions)", "15 Free") on
 * any day it found empty, and worked out free capacity by assuming every
 * instructor was free nine hours a day. Free hours are an availability
 * question; the availability views answer it from what instructors declared.
 */
@Component({
  selector: 'app-schedule-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="space-y-6">
      <section
        class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
        aria-labelledby="week-summary-title"
      >
        <div class="mb-4 border-b border-[var(--color-border)] pb-3">
          <h3
            id="week-summary-title"
            class="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <i class="pi pi-table text-[var(--color-brand-text)]" aria-hidden="true"></i>
            This week by day
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Counted from the classes on this week's schedule. For free hours, use the availability
            views.
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-xs">
            <thead>
              <tr
                class="bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] font-semibold border-b border-[var(--color-border)]"
              >
                <th scope="col" class="px-4 py-3">Day</th>
                <th scope="col" class="px-4 py-3 text-center">Classes</th>
                <th scope="col" class="px-4 py-3 text-center">Cancelled</th>
                <th scope="col" class="px-4 py-3 text-center">Instructors teaching</th>
                <th scope="col" class="px-4 py-3 text-center">Teaching hours</th>
              </tr>
            </thead>
            <tbody>
              @for (day of days(); track day.date.getTime()) {
                <tr class="border-b border-[var(--color-border)]">
                  <th scope="row" class="px-4 py-3 font-semibold text-[var(--color-text-primary)]">
                    {{ day.dayName }}
                    <span class="text-[10px] font-normal text-[var(--color-text-muted)]">
                      ({{ shortDate(day.date) }})
                    </span>
                  </th>
                  <td class="px-4 py-3 text-center font-bold text-[var(--color-brand-text)]">
                    {{ day.classes }}
                  </td>
                  <td class="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                    {{ day.cancelled }}
                  </td>
                  <td class="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                    {{ day.instructors }}
                  </td>
                  <td class="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                    {{ hours(day.teachingMinutes) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section
        class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
        aria-labelledby="week-chart-title"
      >
        <div class="mb-4 border-b border-[var(--color-border)] pb-3">
          <h3
            id="week-chart-title"
            class="text-md font-bold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <i class="pi pi-chart-bar text-[var(--color-brand-text)]" aria-hidden="true"></i>
            Classes per day
          </h3>
        </div>

        @if (extremes().busiest; as busiest) {
          <!-- The table above carries the same numbers for anyone not seeing the bars. -->
          <div
            class="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-[var(--color-border)]"
            aria-hidden="true"
          >
            @for (day of days(); track day.date.getTime()) {
              @let pct = (day.classes / busiest.classes) * 100;
              <div class="flex-1 flex flex-col items-center h-full justify-end">
                <span class="text-[11px] font-bold mb-1 text-[var(--color-text-secondary)]">
                  {{ day.classes }}
                </span>
                <div
                  class="w-full max-w-[36px] rounded-t-md"
                  [class]="
                    day === busiest ? 'bg-[var(--color-chart-peak)]' : 'bg-[var(--color-primary)]'
                  "
                  [style.height.%]="day.classes ? (pct > 5 ? pct : 5) : 0"
                ></div>
              </div>
            }
          </div>
          <div
            class="flex justify-between gap-3 px-2 pt-2 text-[11px] font-semibold text-[var(--color-text-muted)]"
            aria-hidden="true"
          >
            @for (day of days(); track day.date.getTime()) {
              <div class="flex-1 text-center">{{ day.dayName.slice(0, 3) }}</div>
            }
          </div>

          <p
            class="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-secondary)] p-2.5 rounded-lg border border-[var(--color-border)]"
          >
            <span>
              Busiest: <strong>{{ busiest.dayName }}</strong> ({{ plural(busiest.classes) }})
            </span>
            @if (extremes().quietest; as quietest) {
              @if (quietest !== busiest) {
                <span>
                  Quietest with classes: <strong>{{ quietest.dayName }}</strong> ({{
                    plural(quietest.classes)
                  }})
                </span>
              }
            }
          </p>
        } @else {
          <p class="py-10 text-center text-sm text-[var(--color-text-muted)]">
            No classes on the schedule this week.
          </p>
        }
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ScheduleAnalyticsComponent {
  sessions = input<ScheduleSession[]>([]);
  currentWeekStart = input<Date>(new Date());

  readonly days = computed(() => summariseWeek(this.sessions(), this.currentWeekStart()));
  readonly extremes = computed(() => busiestAndQuietest(this.days()));

  shortDate(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  hours(minutes: number): string {
    if (!minutes) return '0';
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h}` : h.toFixed(1);
  }

  plural(classes: number): string {
    return `${classes} ${classes === 1 ? 'class' : 'classes'}`;
  }
}
