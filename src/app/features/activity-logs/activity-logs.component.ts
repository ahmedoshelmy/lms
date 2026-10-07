import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ActivityLogService } from '../../core/services/activity-log.service';
import {
  ActivityFilterOptions,
  ActivityLog,
  ActivityStats,
} from '../../core/interfaces/activity-log.interface';

/**
 * Who did what, and to which group.
 *
 * The page used to print the endpoint that was called -- "Delete Session"
 * against DELETE /api/schedule/sessions/6748 -- which is not a question
 * anybody asks. What is asked is "which class was deleted, and from whose
 * group", so the row now leads with that sentence and keeps the request
 * underneath it for whoever needs to go further.
 */
@Component({
  selector: 'app-activity-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    PaginatorModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './activity-logs.component.html',
  styleUrl: './activity-logs.component.scss',
})
export class ActivityLogsComponent implements OnInit {
  private activityLogService = inject(ActivityLogService);

  stats = signal<ActivityStats | null>(null);
  logs = signal<ActivityLog[]>([]);
  options = signal<ActivityFilterOptions | null>(null);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(true);
  statsLoading = signal<boolean>(true);
  failedToLoad = signal<boolean>(false);

  // ── What is being asked for ───────────────────────────────────────────────
  searchQuery = signal<string>('');
  action = signal<string>('');
  userId = signal<number>(0);
  role = signal<string>('');
  method = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');
  failedOnly = signal<boolean>(false);
  entityType = signal<string>('');
  entityId = signal<number>(0);

  page = signal<number>(1);
  pageSize = signal<number>(25);
  expanded = signal<Set<number>>(new Set());

  /** The things being narrowed to, as removable chips. */
  readonly active = computed(() => {
    const chips: { label: string; clear: () => void }[] = [];
    const people = this.options()?.people ?? [];

    if (this.searchQuery().trim()) {
      chips.push({
        label: `“${this.searchQuery().trim()}”`,
        clear: () => this.searchQuery.set(''),
      });
    }
    if (this.action()) {
      chips.push({ label: this.action(), clear: () => this.action.set('') });
    }
    if (this.userId()) {
      const who = people.find((p) => p.id === this.userId());
      chips.push({ label: who?.name ?? `User #${this.userId()}`, clear: () => this.userId.set(0) });
    }
    if (this.role()) {
      chips.push({ label: this.role(), clear: () => this.role.set('') });
    }
    if (this.method()) {
      chips.push({ label: this.method(), clear: () => this.method.set('') });
    }
    if (this.startDate()) {
      chips.push({ label: `from ${this.startDate()}`, clear: () => this.startDate.set('') });
    }
    if (this.endDate()) {
      chips.push({ label: `to ${this.endDate()}`, clear: () => this.endDate.set('') });
    }
    if (this.failedOnly()) {
      chips.push({ label: 'refused only', clear: () => this.failedOnly.set(false) });
    }
    if (this.entityType()) {
      chips.push({
        label: `${this.entityType().toLowerCase()} #${this.entityId()}`,
        clear: () => {
          this.entityType.set('');
          this.entityId.set(0);
        },
      });
    }

    return chips;
  });

  ngOnInit(): void {
    this.fetchStats();
    this.fetchOptions();
    this.fetchLogs();
  }

  fetchStats(): void {
    this.statsLoading.set(true);
    this.activityLogService.getActivityStats().subscribe({
      next: (res) => {
        this.stats.set(res);
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false),
    });
  }

  fetchOptions(): void {
    this.activityLogService.getFilterOptions().subscribe({
      next: (res) => this.options.set(res),
      error: () => this.options.set(null),
    });
  }

  fetchLogs(): void {
    this.loading.set(true);
    this.failedToLoad.set(false);

    this.activityLogService
      .getActivityLogs({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.searchQuery().trim() || undefined,
        action: this.action() || undefined,
        userId: this.userId() || undefined,
        role: this.role() || undefined,
        method: this.method() || undefined,
        startDate: this.startDate() || undefined,

        // A day named as the end of the range means all of that day, not the
        // midnight it starts on.
        endDate: this.endDate() ? `${this.endDate()}T23:59:59` : undefined,
        failedOnly: this.failedOnly() || undefined,
        entityType: this.entityType() || undefined,
        entityId: this.entityId() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.logs.set(res?.items ?? []);
          this.totalRecords.set(res?.totalCount ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.logs.set([]);
          this.totalRecords.set(0);
          this.failedToLoad.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Any change to the filters starts again from the first page. */
  applyFilters(): void {
    this.page.set(1);
    this.fetchLogs();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.action.set('');
    this.userId.set(0);
    this.role.set('');
    this.method.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.failedOnly.set(false);
    this.entityType.set('');
    this.entityId.set(0);
    this.applyFilters();
  }

  /** Narrows to everything about the group, class or person in a row. */
  focusOn(log: ActivityLog): void {
    if (!log.entityType || !log.entityId) return;
    this.entityType.set(log.entityType);
    this.entityId.set(log.entityId);
    this.applyFilters();
  }

  /** Narrows to one person's own work. */
  focusOnUser(log: ActivityLog): void {
    if (!log.userId) return;
    this.userId.set(log.userId);
    this.applyFilters();
  }

  onPageChange(event: { first?: number; rows?: number }): void {
    const rows = event.rows ?? this.pageSize();
    this.pageSize.set(rows);
    this.page.set(Math.floor((event.first ?? 0) / rows) + 1);
    this.fetchLogs();
  }

  toggleDetails(id: number): void {
    this.expanded.update((open) => {
      const next = new Set(open);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isExpanded(id: number): boolean {
    return this.expanded().has(id);
  }

  /**
   * What the row says it is. A row written before the log kept sentences
   * falls back to the coarse action name, which is what it has.
   */
  headline(log: ActivityLog): string {
    return log.summary?.trim() || log.action;
  }

  /** What the subject of the row is called, for the "show everything" link. */
  entityLabel(log: ActivityLog): string {
    switch (log.entityType) {
      case 'Group':
        return 'this group';
      case 'Session':
        return 'this class';
      case 'Person':
        return 'this person';
      case 'Topic':
        return 'this subject';
      default:
        return '';
    }
  }

  getMethodSeverity(method: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'info';
      case 'POST':
        return 'success';
      case 'PUT':
      case 'PATCH':
        return 'warn';
      case 'DELETE':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getStatusSeverity(status: number): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warn';
    if (status >= 500) return 'danger';
    return 'secondary';
  }

  getRoleSeverity(role?: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'danger';
      case 'instructor':
        return 'info';
      case 'student':
        return 'success';
      default:
        return 'secondary';
    }
  }
}
