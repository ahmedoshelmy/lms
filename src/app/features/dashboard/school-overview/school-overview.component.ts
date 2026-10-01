import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LmsService } from '../../../core/services/lms.service';
import { DashboardOverview } from '../../../core/interfaces/DashboardOverview';

/** One cause of cancellation, with the colour it keeps across the page. */
interface CauseSlice {
  cause: string;
  count: number;
  percent: number;
  colour: string;
}

/**
 * What the school looks like today, for whoever runs it.
 *
 * Every figure comes from one call that counts them on the server. The page
 * used to fetch every group, every student and a month of classes and add them
 * up in the browser, which is how it came to say 56 running groups beside 62
 * classes a week and leave nobody able to say which was wrong.
 */
@Component({
  selector: 'app-school-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './school-overview.component.html',
  styleUrl: './school-overview.component.scss',
})
export class SchoolOverviewComponent implements OnInit {
  private lms = inject(LmsService);

  protected loading = signal(true);
  protected overview = signal<DashboardOverview | null>(null);

  /**
   * Hours asked of the school against hours it is allowed to give, as a
   * percentage. Over 100 means the groups running need more teaching than the
   * limits on the instructors' accounts permit.
   */
  protected readonly loadPercent = computed(() => {
    const o = this.overview();
    if (!o || o.instructorCapacityHoursPerWeek <= 0) return 0;
    return Math.round((o.runningGroupHoursPerWeek / o.instructorCapacityHoursPerWeek) * 100);
  });

  protected readonly overCapacity = computed(() => {
    const o = this.overview();
    return !!o && o.instructorCapacityHoursPerWeek > 0
      ? o.runningGroupHoursPerWeek > o.instructorCapacityHoursPerWeek
      : false;
  });

  /** Hours offered that nothing has been booked into. Negative when oversold. */
  protected readonly spareHours = computed(() => {
    const o = this.overview();
    if (!o) return 0;
    return Math.round((o.instructorCapacityHoursPerWeek - o.runningGroupHoursPerWeek) * 10) / 10;
  });

  /** The widest bar in the subject list, so the rest can be drawn against it. */
  protected readonly busiestTopic = computed(() =>
    Math.max(...(this.overview()?.groupsByTopic ?? []).map((t) => t.groups), 1)
  );

  /**
   * A fixed colour per cause, so the same reason is the same colour in the bar
   * and in the key beside it. Anything unattributed is deliberately grey: it is
   * the absence of an answer, not an answer of its own.
   */
  private readonly causeColours: Record<string, string> = {
    Instructor: 'var(--color-warning)',
    Parents: 'var(--color-secondary)',
    Holiday: 'var(--color-success)',
  };

  protected readonly causes = computed<CauseSlice[]>(() =>
    (this.overview()?.cancellationCauses ?? []).map((slice) => ({
      ...slice,
      colour: this.causeColours[slice.cause] ?? 'var(--color-text-muted)',
    }))
  );

  ngOnInit(): void {
    this.lms.getDashboardOverview().subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
