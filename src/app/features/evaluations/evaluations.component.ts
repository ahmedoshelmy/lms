import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { MonthlyEvaluationSummary } from '../../core/interfaces/MonthlyEvaluation';

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

  protected readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  protected loading = signal(false);
  protected rows = signal<MonthlyEvaluationSummary[]>([]);
  protected search = signal('');
  protected statusFilter = signal<StatusFilter>('All');
  protected releasing = signal<number | null>(null);

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
