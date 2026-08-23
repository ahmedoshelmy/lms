import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { LmsService } from '../../../core/services/lms.service';
import { RegisterCompliance, RegisterComplianceReport } from '../../../core/interfaces/Attendance';

/**
 * How each instructor kept their registers, month by month.
 *
 * Derived from the attendance rows themselves rather than counted as it
 * happens, so it answers for months that passed before anybody thought to
 * measure it — and cannot drift out of step with the records it describes.
 */
@Component({
  selector: 'app-register-compliance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-compliance.component.html',
  styleUrl: './register-compliance.component.scss',
})
export class RegisterComplianceComponent implements OnInit {
  private lms = inject(LmsService);

  readonly loading = signal(false);
  readonly report = signal<RegisterComplianceReport | null>(null);

  readonly rows = computed<RegisterCompliance[]>(() => this.report()?.instructors ?? []);

  /**
   * When the month asked for starts before the school began keeping registers
   * here, the figures only cover part of it. Saying so is the difference
   * between a fair number and an accusation.
   */
  readonly partialFrom = computed(() => {
    const report = this.report();
    if (!report) return null;

    // Clamped when the answer starts later than the month asked for.
    const asked = new Date(`${this.month()}-01T00:00:00Z`).getTime();
    return new Date(report.from).getTime() > asked ? report.from : null;
  });

  readonly partialLabel = computed(() => {
    const from = this.partialFrom();
    return from
      ? new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
      : null;
  });

  /**
   * The month being looked at, as `yyyy-MM`. Opens on the current one.
   *
   * The month just gone would be the natural choice for a review, and is what
   * the monthly email reports on — but it is empty until the school has a full
   * month of records behind it, and a page that greets you with nothing is
   * worse than one showing a month still in progress.
   */
  readonly month = signal(RegisterComplianceComponent.monthOf(new Date()));

  private static monthOf(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  readonly monthLabel = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  });

  // ── The totals across everybody ──────────────────────────────────────────

  readonly taught = computed(() => this.rows().reduce((n, r) => n + r.sessionsTaught, 0));
  readonly onTime = computed(() => this.rows().reduce((n, r) => n + r.onTime, 0));
  readonly byOps = computed(() => this.rows().reduce((n, r) => n + r.recordedByAdmin, 0));
  readonly missing = computed(() => this.rows().reduce((n, r) => n + r.neverRegistered, 0));

  readonly overallRate = computed(() => {
    const total = this.taught();
    return total === 0 ? null : Math.round((this.onTime() / total) * 100);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const [year, month] = this.month().split('-').map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const to = new Date(Date.UTC(year, month, 1)).toISOString();

    this.loading.set(true);
    this.lms
      .getRegisterCompliance(from, to)
      .pipe(catchError(() => of(null)))
      .subscribe((report) => {
        this.report.set(report);
        this.loading.set(false);
      });
  }

  step(months: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const moved = new Date(year, month - 1 + months, 1);
    this.month.set(`${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`);
    this.load();
  }

  /** Whether stepping forward would land on a month that has not happened. */
  readonly atLatest = computed(
    () => this.month() >= RegisterComplianceComponent.monthOf(new Date())
  );

  /**
   * Whether the month being looked at ended before anybody was being measured.
   * Distinct from a quiet month: nothing was expected then, so an empty table
   * is the right answer rather than a worrying one.
   */
  readonly beforeMeasuring = computed(() => {
    const report = this.report();
    if (!report || this.rows().length) return false;

    const monthEnd = new Date(`${this.month()}-01T00:00:00Z`);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    return monthEnd.getTime() <= new Date(report.measuredFrom).getTime();
  });

  readonly measuredFromLabel = computed(() => {
    const from = this.report()?.measuredFrom;
    return from
      ? new Date(from).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
  });

  rateClass(rate: number): string {
    if (rate >= 95) return 'rate--good';
    if (rate >= 80) return 'rate--fair';
    return 'rate--poor';
  }
}
