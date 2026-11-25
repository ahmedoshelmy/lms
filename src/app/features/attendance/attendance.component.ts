import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  PLATFORM_ID,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role, parseRole } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { User } from '../../core/interfaces/User';
import { getSessionCode, getSessionDisplayTopic } from '../../core/utils/session-code.utils';
import { ClockFormatService } from '../../core/services/clock-format.service';
import { startOfSchoolWeek } from '../../core/utils/week.utils';
import { latestRequest } from '../../core/utils/latest-request';
import { LoadErrorComponent } from '../../shared/components/load-error/load-error.component';

export type SessionStatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';
export type DateRangeFilter = 'today' | 'week' | 'month';

/** The first day of the month `date` falls in, at local midnight. */
export function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * The dates on show, from `from` up to (not including) `to`, in local time.
 * "Month" is the month `month` falls in, which the reader steps through.
 */
export function attendanceRange(
  filter: DateRangeFilter,
  month: Date,
  now: Date
): { from: Date; to: Date } {
  if (filter === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) };
  }
  if (filter === 'week') {
    const from = startOfSchoolWeek(now);
    return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7) };
  }
  return {
    from: new Date(month.getFullYear(), month.getMonth(), 1),
    to: new Date(month.getFullYear(), month.getMonth() + 1, 1),
  };
}

export interface DateSessionGroup {
  key: string;
  dateLabel: string;
  subLabel: string;
  isToday: boolean;
  isTomorrow: boolean;
  sessions: ScheduleSession[];
}

@Component({
  selector: 'app-attendance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LoadErrorComponent,
    CommonModule,
    FormsModule,
    RouterModule,
    SelectModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  /** Times read as 16:30 or 4:30 pm, whichever the reader chose. */
  protected readonly clock = inject(ClockFormatService);

  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  sessions = signal<ScheduleSession[]>([]);
  loading = signal(false);
  /** Phones only: whether the filters below the search are unfolded. */
  readonly filtersOpen = signal(false);

  searchQuery = signal('');
  sessionStatusFilter = signal<SessionStatusFilter>('all');
  selectedGroupFilter = signal<string>('all');
  // Opens on this school week. "All time" used to download every class the
  // school had ever had and filter it here, a list that grew every week.
  dateRangeFilter = signal<DateRangeFilter>('week');
  /** Under "Month": the month shown (its first day). */
  readonly monthShown = signal(firstOfMonth(new Date()));
  /** "November 2026", for the month stepper. */
  readonly monthLabel = computed(() =>
    this.monthShown().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );
  private readonly scheduleRequest = latestRequest();
  readonly dateRanges: readonly { value: DateRangeFilter; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'Month' },
  ];
  instructors = signal<User[]>([]);
  selectedInstructorFilter = signal<number>(0);
  sortBy = signal<'time' | 'topic' | 'group' | 'status'>('time');

  readonly uniqueGroups = computed(() => {
    const set = new Set<string>();
    this.sessions().forEach((s) => {
      if (s.groupName) set.add(s.groupName);
    });
    return Array.from(set).sort();
  });

  readonly hasActiveFilters = computed(() => {
    return (
      this.sessionStatusFilter() !== 'all' ||
      this.selectedGroupFilter() !== 'all' ||
      this.dateRangeFilter() !== 'week' ||
      this.selectedInstructorFilter() !== 0 ||
      this.searchQuery().trim() !== ''
    );
  });

  readonly filteredSessions = computed(() => {
    const statusFilter = this.sessionStatusFilter();
    const groupFilter = this.selectedGroupFilter();
    const dateFilter = this.dateRangeFilter();
    const instFilter = this.selectedInstructorFilter();
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.sessions();

    const { from, to } = attendanceRange(dateFilter, this.monthShown(), new Date());

    return all.filter((s) => {
      if (instFilter !== 0) {
        // By id, not by name: a name test matched "Ali" inside "Alia".
        if (String(s.instructorId) !== String(instFilter)) return false;
      }

      const normStatus = (s.status ?? '').toLowerCase();
      if (statusFilter === 'scheduled' && !normStatus.includes('scheduled')) return false;
      if (statusFilter === 'completed' && !normStatus.includes('completed')) return false;
      if (statusFilter === 'cancelled' && !normStatus.includes('cancel')) return false;

      if (groupFilter !== 'all' && s.groupName !== groupFilter) return false;

      // The server's end is inclusive; a class at midnight belongs to the next day.
      const time = new Date(s.startsAt).getTime();
      if (time < from.getTime() || time >= to.getTime()) return false;

      if (query) {
        const searchable =
          `${s.topic} ${s.courseTitle} ${s.groupName} ${s.instructorName}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      return true;
    });
  });

  readonly groupedSessionsByDate = computed<DateSessionGroup[]>(() => {
    const list = [...this.filteredSessions()];
    const sortMode = this.sortBy();

    if (sortMode === 'topic') {
      list.sort((a, b) => (a.topic || '').localeCompare(b.topic || ''));
    } else if (sortMode === 'group') {
      list.sort((a, b) => (a.groupName || '').localeCompare(b.groupName || ''));
    } else if (sortMode === 'status') {
      list.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    } else {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowMs = tomorrow.getTime();

    const groupMap = new Map<string, DateSessionGroup>();

    for (const s of list) {
      const sDate = new Date(s.startsAt || Date.now());
      const sDateDay = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
      const key = `${sDateDay.getFullYear()}-${(sDateDay.getMonth() + 1).toString().padStart(2, '0')}-${sDateDay.getDate().toString().padStart(2, '0')}`;
      const dayMs = sDateDay.getTime();

      const isToday = dayMs === todayMs;
      const isTomorrow = dayMs === tomorrowMs;

      let dateLabel = sDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      let subLabel = '';
      if (isToday) {
        dateLabel = 'TODAY';
        subLabel = sDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
      } else if (isTomorrow) {
        dateLabel = 'TOMORROW';
        subLabel = sDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          dateLabel,
          subLabel,
          isToday,
          isTomorrow,
          sessions: [],
        });
      }
      groupMap.get(key)!.sessions.push(s);
    }

    return Array.from(groupMap.values());
  });

  readonly sessionStats = computed(() => {
    const all = this.sessions();
    return {
      total: all.length,
      scheduled: all.filter((s) => (s.status ?? '').toLowerCase().includes('scheduled')).length,
      completed: all.filter((s) => (s.status ?? '').toLowerCase().includes('completed')).length,
      cancelled: all.filter((s) => (s.status ?? '').toLowerCase().includes('cancel')).length,
    };
  });

  ngOnInit(): void {
    this.loadData();
    if (this.isAdmin()) {
      this.lms.getInstructors().subscribe({
        next: (users) => {
          const filtered = (users || []).filter(
            (u) => parseRole(u.role) === Role.Instructor || (u.role as any) === 'Instructor'
          );
          this.instructors.set([
            { id: 0, name: 'All Instructors', email: '', role: Role.Instructor },
            ...filtered,
          ]);
        },
      });
    }
  }

  /** The list could not be loaded; said, rather than shown as empty. */
  readonly loadFailed = signal(false);

  /** Loads the classes in the dates on show, and only those. */
  loadData(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const { from, to } = attendanceRange(this.dateRangeFilter(), this.monthShown(), new Date());
    this.lms
      .getSchedule(from, to)
      .pipe(this.scheduleRequest.latest())
      .subscribe({
        next: (sessions) => {
          const sorted = (sessions || []).sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
          );
          this.sessions.set(sorted);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  getSessionCode(s: any): string {
    return getSessionCode(s);
  }

  getSessionDisplayTopic(s: any): string {
    return getSessionDisplayTopic(s);
  }

  setSessionStatusFilter(filter: SessionStatusFilter): void {
    this.sessionStatusFilter.set(filter);
  }

  setGroupFilter(group: string): void {
    this.selectedGroupFilter.set(group);
  }

  setDateRangeFilter(filter: DateRangeFilter): void {
    if (filter === this.dateRangeFilter()) return;
    this.dateRangeFilter.set(filter);
    this.loadData();
  }

  /** Under "Month": the month before (-1) or after (+1). */
  stepMonth(delta: number): void {
    const shown = this.monthShown();
    this.monthShown.set(new Date(shown.getFullYear(), shown.getMonth() + delta, 1));
    this.loadData();
  }

  setInstructorFilter(instId: number): void {
    this.selectedInstructorFilter.set(instId);
  }

  resetFilters(): void {
    this.sessionStatusFilter.set('all');
    this.selectedGroupFilter.set('all');
    this.selectedInstructorFilter.set(0);
    this.searchQuery.set('');
    this.sortBy.set('time');
    const thisMonth = firstOfMonth(new Date());
    if (this.dateRangeFilter() !== 'week' || this.monthShown().getTime() !== thisMonth.getTime()) {
      this.dateRangeFilter.set('week');
      this.monthShown.set(thisMonth);
      this.loadData();
    }
  }

  formatTime(iso?: string): string {
    if (!iso) return '—';
    return this.clock.time(iso);
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  formatFullDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getStatusBadgeClass(status: string): string {
    const norm = (status ?? '').toLowerCase();
    if (norm.includes('completed')) return 'status-completed';
    if (norm.includes('cancel')) return 'status-cancelled';
    return 'status-scheduled';
  }

  getAttendanceBadge(s: ScheduleSession): { label: string; css: string; icon: string } {
    const status = (s.status || '').toLowerCase();
    if (status.includes('cancel')) {
      return {
        label: 'Cancelled',
        css: 'bg-error/10 text-error-foreground border-error/20',
        icon: 'pi-times-circle',
      };
    }
    if (status.includes('completed')) {
      return {
        label: 'Attendance Marked',
        css: 'bg-success/10 text-success-foreground border-success/20',
        icon: 'pi-check-circle',
      };
    }

    const now = new Date();
    const sessionTime = new Date(s.startsAt || Date.now());
    if (sessionTime <= now) {
      return {
        label: 'Attendance Pending',
        css: 'bg-warning/10 text-warning-foreground border-warning/20',
        icon: 'pi-exclamation-triangle',
      };
    }

    return {
      label: 'Upcoming',
      css: 'bg-info/10 text-info-foreground border-info/20',
      icon: 'pi-clock',
    };
  }

  getLeftAccentColor(s: ScheduleSession): string {
    const status = (s.status || '').toLowerCase();
    if (status.includes('cancel')) return 'var(--color-error)';
    if (status.includes('completed')) return 'var(--color-secondary)';
    const att = this.getAttendanceBadge(s);
    if (att.label === 'Attendance Pending') return 'var(--color-warning)';
    return 'var(--color-success)';
  }

  isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  isPast(iso: string): boolean {
    return new Date(iso).getTime() < new Date().getTime();
  }
}
