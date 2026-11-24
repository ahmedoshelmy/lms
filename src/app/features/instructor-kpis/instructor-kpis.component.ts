import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
  InstructorKpi,
  KPI_BAND_LABELS,
  KPI_INDICATORS,
  KpiBand,
  KpiIndicatorKey,
  KpiMonth,
} from '../../core/interfaces/InstructorKpi';
import { KpiService } from '../../core/services/kpi.service';
import { KpiPdf, KpiPdfService } from '../../core/services/kpi-pdf.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { latestRequest } from '../../core/utils/latest-request';
import {
  KPI_REVIEW_DAY,
  canApproveMonth,
  formatPercent,
  indicatorBasis,
  kpiPhase,
  monthLabel,
  monthsBefore,
  recentMonths,
} from '../../core/utils/kpi.utils';
import { kpiCsvFileName, kpiMonthCsv } from '../../core/utils/kpi-csv';
import { LoadErrorComponent } from '../../shared/components/load-error/load-error.component';
import { KpiOverrideDialogComponent, KpiOverrideTarget } from './kpi-override-dialog.component';
import { KpiSettingsDialogComponent } from './kpi-settings-dialog.component';

/**
 * Each instructor's month in three indicators -- monthly reports on time,
 * registers on time, classes kept -- and an overall score.
 *
 * The month is reviewed from the 29th: admins adjust a figure where the
 * system could not know better (always with a reason, and the calculated
 * figure kept), and approve it once the month is over, which freezes it. The
 * owner gets a PDF of one instructor or of everyone, or a CSV.
 */
@Component({
  selector: 'app-instructor-kpis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LoadErrorComponent, KpiOverrideDialogComponent, KpiSettingsDialogComponent],
  templateUrl: './instructor-kpis.component.html',
})
export class InstructorKpisComponent implements OnInit {
  private readonly kpis = inject(KpiService);
  private readonly pdf = inject(KpiPdfService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly monthRequest = latestRequest();

  /** Read once: a page left open over midnight on the 28th says so on reload. */
  protected readonly today = new Date();
  protected readonly months = recentMonths(this.today, 12);
  protected readonly month = signal(this.months[0]);

  protected readonly data = signal<KpiMonth | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);

  /** What is in hand: approving, exporting, sending, or one instructor's row. */
  protected readonly busy = signal<string | null>(null);

  protected readonly overrideTarget = signal<KpiOverrideTarget | null>(null);
  protected readonly overrideOpen = signal(false);
  protected readonly savingOverride = signal(false);
  protected readonly settingsOpen = signal(false);

  protected readonly indicators = KPI_INDICATORS;
  protected readonly bandLabels = KPI_BAND_LABELS;
  protected readonly formatPercent = formatPercent;
  protected readonly monthLabel = monthLabel;

  protected readonly phase = computed(() => kpiPhase(this.month(), this.today));
  protected readonly approved = computed(() => this.data()?.status === 'Approved');
  protected readonly canApprove = computed(
    () => !this.approved() && canApproveMonth(this.month(), this.today)
  );
  /**
   * Adjusting opens with the review on the 29th, while the figures have stopped
   * moving much, and closes with approval: an approved month is reopened first.
   */
  protected readonly editable = computed(
    () =>
      !!this.data() && !this.approved() && (this.phase() === 'Review' || this.phase() === 'Closed')
  );

  protected readonly lastApproval = computed(() =>
    [...(this.data()?.events ?? [])].reverse().find((e) => e.action === 'Approved')
  );

  /** When approval opens: the 1st of the next month. */
  protected readonly approvalOpensOn = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    return new Date(y, m, 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  });

  protected readonly reviewDay = KPI_REVIEW_DAY;

  ngOnInit(): void {
    this.load();
  }

  protected setMonth(month: string): void {
    this.month.set(month);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.kpis
      .getMonth(this.month())
      .pipe(this.monthRequest.latest())
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.data.set(null);
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  protected shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  protected basis(kpi: InstructorKpi, key: KpiIndicatorKey): string {
    return indicatorBasis(key, kpi[key].detail as never);
  }

  protected bandClass(band: KpiBand | null): string {
    switch (band) {
      case 'Excellent':
        return 'bg-success-background text-success-foreground';
      case 'Good':
        return 'bg-info-background text-info-foreground';
      case 'NeedsAttention':
        return 'bg-error-background text-error-foreground';
      default:
        return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]';
    }
  }

  // ── Adjusting a figure ────────────────────────────────────────────────────

  protected openOverride(kpi: InstructorKpi, indicator: KpiIndicatorKey): void {
    this.overrideTarget.set({ kpi, indicator });
    this.overrideOpen.set(true);
  }

  protected saveOverride(change: { value: number; reason: string }): void {
    const target = this.overrideTarget();
    if (!target) return;
    this.savingOverride.set(true);
    this.kpis
      .setOverride(this.month(), target.kpi.instructorId, target.indicator, change)
      .subscribe({
        next: (row) => this.afterOverride(row, 'Adjustment saved.'),
        error: () => this.savingOverride.set(false),
      });
  }

  protected async clearOverride(): Promise<void> {
    const target = this.overrideTarget();
    if (!target) return;
    const calculated = formatPercent(target.kpi[target.indicator].calculated);
    const ok = await this.confirm.ask({
      header: 'Remove the adjustment?',
      message: `The calculated figure, ${calculated}, will count again.`,
      acceptLabel: 'Remove it',
      rejectLabel: 'Keep it',
    });
    if (!ok) return;
    this.savingOverride.set(true);
    this.kpis.clearOverride(this.month(), target.kpi.instructorId, target.indicator).subscribe({
      next: (row) => this.afterOverride(row, 'Adjustment removed.'),
      error: () => this.savingOverride.set(false),
    });
  }

  /** The server's recalculated row replaces the old one: overall and band move with it. */
  private afterOverride(row: InstructorKpi, message: string): void {
    this.savingOverride.set(false);
    this.overrideOpen.set(false);
    this.data.update((d) =>
      d
        ? {
            ...d,
            instructors: d.instructors.map((k) => (k.instructorId === row.instructorId ? row : k)),
          }
        : d
    );
    this.notify.showSuccess(message);
  }

  // ── Approving the month ───────────────────────────────────────────────────

  protected async approve(): Promise<void> {
    const ok = await this.confirm.ask({
      header: `Approve ${monthLabel(this.month())}?`,
      message:
        'The figures are frozen as they are now: later registers and reports will not change ' +
        'them. You can reopen the month, with a reason, if something needs correcting.',
      acceptLabel: 'Approve the month',
      rejectLabel: 'Not yet',
    });
    if (!ok) return;
    this.busy.set('approve');
    this.kpis.approve(this.month()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.busy.set(null);
        this.notify.showSuccess(`${monthLabel(data.month)} approved.`);
      },
      error: () => this.busy.set(null),
    });
  }

  protected async reopen(): Promise<void> {
    const reason = await this.confirm.askText({
      header: `Reopen ${monthLabel(this.month())}?`,
      message: 'Its figures are recalculated from the records as they are now. Adjustments stay.',
      acceptLabel: 'Reopen',
      rejectLabel: 'Keep it approved',
      input: { label: 'Why is it being reopened?', required: true },
    });
    if (!reason) return;
    this.busy.set('approve');
    this.kpis.reopen(this.month(), reason).subscribe({
      next: (data) => {
        this.data.set(data);
        this.busy.set(null);
        this.notify.showSuccess(`${monthLabel(data.month)} reopened.`);
      },
      error: () => this.busy.set(null),
    });
  }

  // ── Reports for the owner ─────────────────────────────────────────────────

  protected downloadCsv(): void {
    const data = this.data();
    if (!data) return;
    const blob = new Blob([kpiMonthCsv(data)], { type: 'text/csv;charset=utf-8' });
    this.pdf.download(blob, kpiCsvFileName(data.month));
  }

  protected async downloadPdf(kpi?: InstructorKpi): Promise<void> {
    const file = await this.buildPdf(kpi);
    if (file) this.pdf.download(file.blob, file.fileName);
  }

  protected async sendToOwner(kpi?: InstructorKpi): Promise<void> {
    const data = this.data();
    if (!data) return;
    const to = data.settings.ownerEmail;
    if (!to) {
      this.notify.showWarn("Set the owner's email in KPI settings first.");
      this.settingsOpen.set(true);
      return;
    }
    const what = kpi ? `${kpi.instructorName}'s KPIs` : 'all instructors’ KPIs';
    const ok = await this.confirm.ask({
      header: 'Send to the owner?',
      message:
        `${what} for ${monthLabel(data.month)} go to ${to} as a PDF.` +
        (data.status === 'Approved' ? '' : ' The month is not approved yet; the PDF says so.'),
      acceptLabel: 'Send',
      rejectLabel: 'Cancel',
    });
    if (!ok) return;

    const file = await this.buildPdf(kpi);
    if (!file) return;
    this.busy.set(kpi ? `send-${kpi.instructorId}` : 'send');
    this.kpis.sendToOwner(data.month, file.blob, file.fileName, kpi?.instructorId).subscribe({
      next: ({ sentTo }) => {
        this.busy.set(null);
        this.notify.showSuccess(`Sent to ${sentTo}.`);
      },
      error: () => this.busy.set(null),
    });
  }

  /** One instructor (with their last six months) or everyone. */
  private async buildPdf(kpi?: InstructorKpi): Promise<KpiPdf | null> {
    const data = this.data();
    if (!data) return null;
    this.busy.set(kpi ? `pdf-${kpi.instructorId}` : 'pdf');
    try {
      if (!kpi) return await this.pdf.monthReport(data);
      // The trend is a help, not the point: a sheet without it beats no sheet.
      const history = await firstValueFrom(
        this.kpis
          .getHistory(kpi.instructorId, monthsBefore(data.month, 5), data.month)
          .pipe(catchError(() => of([])))
      );
      return await this.pdf.instructorSheet(data, kpi, history);
    } finally {
      this.busy.set(null);
    }
  }
}
