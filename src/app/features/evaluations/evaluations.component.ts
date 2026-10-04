import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { MonthlyEvaluationSummary } from '../../core/interfaces/MonthlyEvaluation';
import { MonthlyReportPdfService } from '../../core/services/monthly-report-pdf.service';

type StatusFilter = 'All' | 'NotStarted' | 'Draft' | 'Submitted' | 'Released';

/**
 * The month's reports, one per child per group.
 *
 * Rows exist before anybody writes anything, because the question operations
 * actually has at the end of a month is which reports are missing, and a list
 * of what has been written cannot answer it.
 */
@Component({
  selector: 'app-evaluations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './evaluations.component.html',
  styleUrl: './evaluations.component.scss',
})
export class EvaluationsComponent implements OnInit {
  private lms = inject(LmsService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private pdf = inject(MonthlyReportPdfService);

  protected readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  protected loading = signal(false);
  protected rows = signal<MonthlyEvaluationSummary[]>([]);
  protected search = signal('');
  protected statusFilter = signal<StatusFilter>('All');
  protected releasing = signal<number | null>(null);

  /** Which row is fetching its report to save, keyed by child and group. */
  protected saving = signal<string | null>(null);

  /** How far a "save them all" run has got, so a long one shows progress. */
  protected bulk = signal<{ done: number; total: number } | null>(null);

  /** Groups folded away, so a month of forty groups is still a page. */
  protected collapsed = signal<Set<string>>(new Set());

  /**
   * The month being reported on, as "YYYY-MM".
   *
   * Reports are written about a month that has finished, so the page opens on
   * the last one rather than the one everybody is still teaching.
   */
  protected month = signal(previousMonth());

  protected readonly monthLabel = computed(() =>
    new Date(`${this.month()}-01T12:00:00`).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    })
  );

  /** The twelve months up to this one, newest first. */
  protected readonly monthOptions = computed(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        value,
        label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      };
    });
  });

  protected readonly filtered = computed(() => {
    const query = this.search().toLowerCase().trim();
    const status = this.statusFilter();

    return this.rows().filter((row) => {
      const matchesStatus = status === 'All' || row.status === status;
      const matchesQuery =
        !query ||
        row.studentName.toLowerCase().includes(query) ||
        row.groupName.toLowerCase().includes(query) ||
        row.instructorName.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  });

  /**
   * The month's reports gathered under their group.
   *
   * One flat list of every child in the school is not a thing anybody reads;
   * the work is done group by group, by the person who teaches it.
   */
  protected readonly byGroup = computed(() => {
    const groups = new Map<string, MonthlyEvaluationSummary[]>();

    for (const row of this.filtered()) {
      const existing = groups.get(row.groupName);
      if (existing) {
        existing.push(row);
      } else {
        groups.set(row.groupName, [row]);
      }
    }

    return [...groups.entries()]
      .map(([groupName, students]) => ({
        groupName,
        groupId: students[0].groupId,
        instructorName: students[0].instructorName,
        students,
        released: students.filter((s) => s.status === 'Released').length,
        waiting: students.filter((s) => s.status === 'Submitted').length,
        missing: students.filter((s) => s.status === 'NotStarted').length,
        saveable: students.filter((s) => s.id).length,
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  });

  /** Every report in the month that has been written at all. */
  protected readonly saveable = computed(() => this.filtered().filter((row) => row.id));

  protected readonly counts = computed(() => {
    const rows = this.rows();
    return {
      total: rows.length,
      notStarted: rows.filter((r) => r.status === 'NotStarted').length,
      draft: rows.filter((r) => r.status === 'Draft').length,
      submitted: rows.filter((r) => r.status === 'Submitted').length,
      released: rows.filter((r) => r.status === 'Released').length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected setMonth(month: string): void {
    this.month.set(month);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.lms.getEvaluations(`${this.month()}-01`).subscribe({
      next: (rows) => {
        this.rows.set(rows || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(row: MonthlyEvaluationSummary): void {
    this.router.navigate(['/evaluations', row.studentId, row.groupId], {
      queryParams: { month: `${this.month()}-01` },
    });
  }

  /** Operations' last look before a report becomes a parent's copy. */
  protected release(row: MonthlyEvaluationSummary, event: Event): void {
    event.stopPropagation();
    if (!row.id) return;

    this.releasing.set(row.id);
    this.lms.releaseEvaluation(row.id).subscribe({
      next: () => {
        this.notify.showSuccess(`${row.studentName}'s report is released.`);
        this.releasing.set(null);
        this.load();
      },
      error: () => this.releasing.set(null),
    });
  }

  protected withdraw(row: MonthlyEvaluationSummary, event: Event): void {
    event.stopPropagation();
    if (!row.id) return;

    this.releasing.set(row.id);
    this.lms.withdrawEvaluation(row.id).subscribe({
      next: () => {
        this.notify.showSuccess(`${row.studentName}'s report is back with operations.`);
        this.releasing.set(null);
        this.load();
      },
      error: () => this.releasing.set(null),
    });
  }

  protected toggleGroup(groupName: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      next.has(groupName) ? next.delete(groupName) : next.add(groupName);
      return next;
    });
  }

  protected isCollapsed(groupName: string): boolean {
    return this.collapsed().has(groupName);
  }

  protected rowKey(row: MonthlyEvaluationSummary): string {
    return `${row.studentId}-${row.groupId}`;
  }

  /**
   * Saves one report as a PDF without opening it.
   *
   * The list holds only a summary, so the full report is fetched first; it is
   * the same call the detail page makes, and the same drawing.
   */
  protected async save(row: MonthlyEvaluationSummary, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!row.id) return;

    this.saving.set(this.rowKey(row));
    try {
      await this.saveOne(row);
    } catch {
      this.notify.showError(`Could not build ${row.studentName}'s report.`);
    } finally {
      this.saving.set(null);
    }
  }

  /**
   * Saves every written report in view, one file each.
   *
   * Spaced out, because browsers drop downloads fired back to back, and
   * Chrome asks once per site before allowing more than one.
   */
  protected async saveAll(): Promise<void> {
    const rows = this.saveable();
    if (rows.length === 0) return;

    this.bulk.set({ done: 0, total: rows.length });

    let failed = 0;
    for (const [index, row] of rows.entries()) {
      this.bulk.set({ done: index + 1, total: rows.length });

      try {
        await this.saveOne(row);
      } catch {
        failed++;
      }

      if (index < rows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    this.bulk.set(null);
    if (failed > 0) {
      this.notify.showWarn(`${rows.length - failed} saved, ${failed} could not be built.`);
    } else {
      this.notify.showSuccess(`${rows.length} reports saved.`);
    }
  }

  private async saveOne(row: MonthlyEvaluationSummary): Promise<void> {
    const report = await new Promise<Parameters<MonthlyReportPdfService['save']>[0]>(
      (resolve, reject) =>
        this.lms
          .getEvaluation(row.studentId, row.groupId, `${this.month()}-01`)
          .subscribe({ next: resolve, error: reject })
    );

    await this.pdf.save(report);
  }

  protected statusLabel(status: MonthlyEvaluationSummary['status']): string {
    return status === 'NotStarted' ? 'Not started' : status;
  }
}

/** The month just gone, as "YYYY-MM". */
function previousMonth(): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
