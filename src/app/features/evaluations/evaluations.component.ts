import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { MonthlyEvaluationSummary } from '../../core/interfaces/MonthlyEvaluation';
import { MonthlyReportPdfService } from '../../core/services/monthly-report-pdf.service';
import { latestRequest } from '../../core/utils/latest-request';
import { LoadErrorComponent } from '../../shared/components/load-error/load-error.component';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadErrorComponent],
  templateUrl: './evaluations.component.html',
  styleUrl: './evaluations.component.scss',
})
export class EvaluationsComponent implements OnInit {
  private lms = inject(LmsService);
  private readonly monthRequest = latestRequest();
  protected readonly loadFailed = signal(false);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private pdf = inject(MonthlyReportPdfService);

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  protected readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  protected loading = signal(false);
  protected rows = signal<MonthlyEvaluationSummary[]>([]);
  protected search = signal('');
  protected statusFilter = signal<StatusFilter>('All');

  /** One instructor's children, or everybody's. Held by name, which is what
      the row carries and what the person choosing is reading. */
  protected instructorFilter = signal<string>('All');
  /**
   * Reports with a release or withdrawal in flight. One id used to be shared by
   * every row, so starting a second re-enabled the first one's buttons.
   */
  protected releasing = signal<ReadonlySet<number>>(new Set());

  protected isReleasing(id: number | null | undefined): boolean {
    return id != null && this.releasing().has(id);
  }

  private setReleasing(id: number, on: boolean): void {
    this.releasing.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Set when the page goes away, to stop a "save them all" run part-way. */
  private destroyed = false;

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

  /**
   * The instructors with a child on this month's list.
   *
   * Taken from the month on screen rather than from every instructor the
   * school has, so the list does not offer names that would filter to nothing.
   */
  protected readonly instructorOptions = computed(() =>
    [...new Set(this.rows().map((row) => row.instructorName))].sort((a, b) => a.localeCompare(b))
  );

  protected readonly filtered = computed(() => {
    const query = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    const instructor = this.instructorFilter();

    return this.rows().filter((row) => {
      const matchesStatus = status === 'All' || row.status === status;
      const matchesInstructor = instructor === 'All' || row.instructorName === instructor;
      const matchesQuery =
        !query ||
        row.studentName.toLowerCase().includes(query) ||
        row.groupName.toLowerCase().includes(query) ||
        row.instructorName.toLowerCase().includes(query);

      return matchesStatus && matchesInstructor && matchesQuery;
    });
  });

  /**
   * Why this child is not going to get a report, where they are not.
   *
   * Operations asks it of a handful of names every month, and answering it
   * meant opening each child in turn. A child who left part-way through is
   * still owed one for the classes they were there for, so the two reasons are
   * not the same and the row says which it is -- or both.
   */
  protected reportGap(row: MonthlyEvaluationSummary): string | null {
    // Undefined means a server that does not send it yet. Nought classes means
    // the group taught nothing that month, which is a fact about the group and
    // not about the child.
    const noRegister = row.registersMarked === 0 && row.classesHeld > 0;

    if (row.leftAt && noRegister) {
      return 'Left the group, and no register this month names them, so an instructor has nothing to report on.';
    }

    if (noRegister) {
      return `No register names this child in any of the month's ${row.classesHeld} classes, so an instructor has nothing to report on.`;
    }

    if (row.leftAt) {
      return 'Left the group part-way through, and is still owed a report for the classes they were there for.';
    }

    return null;
  }

  protected hasNoRegister(row: MonthlyEvaluationSummary): boolean {
    return row.registersMarked === 0 && row.classesHeld > 0;
  }

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

        // A group that has finished still owes the reports for the month it
        // finished in, which is the month with its last class in it. Saying
        // so is cheaper than the question it saves.
        //
        // Only a plain no counts as ended: a server that does not send this
        // at all would otherwise brand every group on the page.
        running: students[0].groupRunning !== false,
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
    this.loadFailed.set(false);
    this.lms
      .getEvaluations(`${this.month()}-01`)
      .pipe(this.monthRequest.latest())
      .subscribe({
        next: (rows) => {
          this.rows.set(rows || []);
          this.loading.set(false);

          // A month the chosen instructor has no children in would otherwise
          // show an empty page with their name still in the box, reading as
          // "none written" rather than "none to write".
          const instructor = this.instructorFilter();
          if (instructor !== 'All' && !this.instructorOptions().includes(instructor)) {
            this.instructorFilter.set('All');
          }
        },
        // Not "nothing to report on", which is what a failure used to read as.
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
          this.loadFailed.set(true);
        },
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

    const id = row.id;
    if (this.isReleasing(id)) return;
    this.setReleasing(id, true);
    this.lms.releaseEvaluation(id).subscribe({
      next: () => {
        this.notify.showSuccess(`${row.studentName}'s report is released.`);
        this.setReleasing(id, false);
        this.load();
      },
      error: () => this.setReleasing(id, false),
    });
  }

  protected withdraw(row: MonthlyEvaluationSummary, event: Event): void {
    event.stopPropagation();
    if (!row.id) return;

    const id = row.id;
    if (this.isReleasing(id)) return;
    this.setReleasing(id, true);
    this.lms.withdrawEvaluation(id).subscribe({
      next: () => {
        this.notify.showSuccess(`${row.studentName}'s report is back with operations.`);
        this.setReleasing(id, false);
        this.load();
      },
      error: () => this.setReleasing(id, false),
    });
  }

  protected toggleGroup(groupName: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
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
      await this.saveOne(row, this.month());
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
    // Taken once: the run takes a while, and the month on screen may change
    // before it ends. Reading it live used to fetch the rest from the new month.
    const rows = this.saveable();
    const month = this.month();
    if (rows.length === 0) return;

    this.bulk.set({ done: 0, total: rows.length });

    let failed = 0;
    for (const [index, row] of rows.entries()) {
      // Left the page: stop rather than keep downloading files in the background.
      if (this.destroyed) return;
      this.bulk.set({ done: index + 1, total: rows.length });

      try {
        await this.saveOne(row, month);
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

  private async saveOne(row: MonthlyEvaluationSummary, month: string): Promise<void> {
    const report = await new Promise<Parameters<MonthlyReportPdfService['save']>[0]>(
      (resolve, reject) =>
        this.lms
          .getEvaluation(row.studentId, row.groupId, `${month}-01`)
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
