import { Component, inject, computed, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { Role } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { PendingAttendanceSessionDto } from '../../core/interfaces/Attendance';
import { getSessionCode, getSessionDisplayTopic } from '../../core/utils/session-code.utils';
import { SalesOverviewComponent } from './sales-overview/sales-overview.component';
import { StudentHomeComponent } from './student-home/student-home.component';
import { SchoolOverviewComponent } from './school-overview/school-overview.component';
import { ClockFormatService } from '../../core/services/clock-format.service';

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  link?: string;
  action?: () => void;
  loading?: boolean;
  subtitle?: string;
}

export type SessionStatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';
export type DashboardView = 'today' | 'week' | 'month';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SalesOverviewComponent,
    StudentHomeComponent,
    SchoolOverviewComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  /** Times read as 16:30 or 4:30 pm, whichever the reader chose. */
  protected readonly clock = inject(ClockFormatService);

  private auth = inject(AuthService);
  private lms = inject(LmsService);
  private platformId = inject(PLATFORM_ID);

  loadingUpcoming = signal(false);
  loadingCounts = signal(false);
  loadingAllSessions = signal(false);
  loadingAttendanceSummary = signal(false);
  upcomingSessions = signal<ScheduleSession[]>([]);
  allSessions = signal<ScheduleSession[]>([]);
  courseCount = signal<number | '—'>('—');
  attendedToday = signal<number | '—'>('—');
  attendedThisWeek = signal<number | '—'>('—');
  sessionsUpdatedTodayCount = signal<number | '—'>('—');
  pendingAttendanceCount = signal<number | '—'>('—');
  updatedSessionsList = signal<PendingAttendanceSessionDto[]>([]);
  pendingSessionsList = signal<PendingAttendanceSessionDto[]>([]);

  activeSessionModal = signal<'updated' | 'pending' | null>(null);
  activeStatusFilter = signal<SessionStatusFilter>('all');
  activeView = signal<DashboardView>('week');

  readonly scheduledCount = computed(
    () =>
      this.intervalSessions().filter((s) => (s.status ?? '').toLowerCase().includes('scheduled'))
        .length
  );
  readonly completedCount = computed(
    () =>
      this.intervalSessions().filter((s) => (s.status ?? '').toLowerCase().includes('completed'))
        .length
  );
  readonly cancelledCount = computed(
    () =>
      this.intervalSessions().filter((s) => (s.status ?? '').toLowerCase().includes('cancel'))
        .length
  );

  readonly filteredSessions = computed(() => {
    const filter = this.activeStatusFilter();
    const sessions = this.intervalSessions();
    if (filter === 'all') return sessions;
    return sessions.filter((s) => {
      const norm = (s.status ?? '').toLowerCase();
      if (filter === 'scheduled') return norm.includes('scheduled');
      if (filter === 'completed') return norm.includes('completed');
      if (filter === 'cancelled') return norm.includes('cancel');
      return true;
    });
  });

  readonly totalHours = computed(() => {
    const sessions = this.intervalSessions();
    if (!sessions.length) return 0;
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    return Math.round((totalMinutes / 60) * 10) / 10;
  });

  readonly totalSessionsCount = computed(() => this.intervalSessions().length);

  readonly allScheduledCount = computed(
    () =>
      this.intervalSessions().filter((s) => (s.status ?? '').toLowerCase().includes('scheduled'))
        .length
  );
  readonly allCompletedCount = computed(
    () =>
      this.intervalSessions().filter((s) => (s.status ?? '').toLowerCase().includes('completed'))
        .length
  );
  readonly allCancelledCount = computed(
    () =>
      this.intervalSessions().filter((s) => (s.status ?? '').toLowerCase().includes('cancel'))
        .length
  );

  readonly monthlyProgressPercentages = computed(() => {
    const total = this.totalSessionsCount();
    if (!total) return { scheduled: 0, completed: 0, cancelled: 0 };
    return {
      scheduled: Math.round((this.allScheduledCount() / total) * 100),
      completed: Math.round((this.allCompletedCount() / total) * 100),
      cancelled: Math.round((this.allCancelledCount() / total) * 100),
    };
  });

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));
  readonly isInstructor = computed(() => this.auth.hasRole(Role.Instructor));

  /**
   * Sales gets a different page rather than a filtered version of this one.
   * Sessions taught this month and cancellation rates are true and none of
   * their business; what decides their day is which holds are about to lapse.
   */
  readonly isSales = computed(() => this.auth.hasRole(Role.Sales));

  /**
   * Students get their own page too. Sessions taught across the whole school
   * and a bar chart per instructor answer none of the four things a student
   * came to find out.
   */
  readonly isStudent = computed(() => this.auth.hasRole(Role.Student));

  readonly viewLabel = computed(() => {
    const v = this.activeView();
    if (v === 'today') return 'Today';
    if (v === 'week') return 'This Week';
    return 'This Month';
  });

  readonly viewIntervalLabel = computed(() => {
    const v = this.activeView();
    if (v === 'today') {
      const d = new Date();
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    if (v === 'week') {
      const sessions = this.intervalSessions();
      if (!sessions.length) return 'No sessions';
      const starts = sessions.map((s) => new Date(s.startsAt).getTime());
      const from = new Date(Math.min(...starts));
      const to = new Date(Math.max(...starts));
      return `${this.formatShortDate(from.toISOString())} - ${this.formatShortDate(to.toISOString())}`;
    }
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  // ─── Interval Sessions (the sessions for the selected view) ──────────
  readonly intervalSessions = computed(() => {
    const view = this.activeView();
    const now = new Date();

    if (view === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      return this.allSessions().filter((s) => {
        const t = new Date(s.startsAt).getTime();
        return t >= todayStart.getTime() && t < todayEnd.getTime();
      });
    }

    if (view === 'week') {
      return this.upcomingSessions();
    }

    return this.allSessions();
  });

  readonly attendanceStatCards = computed<StatCard[]>(() => {
    const view = this.activeView();
    const viewLabel = this.viewLabel();
    const attendedValue = view === 'today' ? this.attendedToday() : this.attendedThisWeek();
    const attendedLabel = view === 'today' ? 'Attended Today' : `Attended ${viewLabel}`;
    const attendedSubtitle =
      view === 'today' ? 'Students present today' : `Students present ${viewLabel.toLowerCase()}`;
    // Cancelled classes are not classes. Counting them made a week with four
    // call-offs read as four classes busier than it was.
    const sessionCount = this.liveIntervalSessions().length;
    const taughtCount = this.taughtIntervalCount();

    return [
      {
        label: attendedLabel,
        value: attendedValue,
        icon: 'pi pi-check-circle',
        color: 'var(--color-success)',
        link: '/attendance',
        loading: this.loadingAttendanceSummary(),
        subtitle: attendedSubtitle,
      },
      {
        label: `Sessions ${viewLabel}`,
        value: sessionCount,
        icon: 'pi pi-calendar-clock',
        color: 'var(--color-secondary)',
        link: '/schedule',
        loading: this.loadingUpcoming(),
        subtitle: sessionCount
          ? `${taughtCount} taught, ${sessionCount - taughtCount} to come`
          : `${this.viewIntervalLabel()}`,
      },
      {
        label: 'Updated Today',
        value: this.sessionsUpdatedTodayCount(),
        icon: 'pi pi-file-edit',
        color: 'var(--color-warning)',
        action: () => this.openSessionModal('updated'),
        loading: this.loadingAttendanceSummary(),
        subtitle: 'Click to view sessions',
      },
      {
        label: 'Pending Attendance',
        value: this.pendingAttendanceCount(),
        icon: 'pi pi-exclamation-circle',
        color: 'var(--color-danger)',
        action: () => this.openSessionModal('pending'),
        loading: this.loadingAttendanceSummary(),
        subtitle: 'Click to view sessions',
      },
    ];
  });

  /**
   * Classes in the view that are still classes.
   *
   * The count included cancelled ones, so a week with four call-offs read as
   * four classes busier than it was — and "62 sessions this week" against 56
   * running groups looked like an error when it was cancellations and a week
   * that starts on the Saturday just gone.
   */
  readonly liveIntervalSessions = computed(() =>
    this.intervalSessions().filter((s) => !(s.status ?? '').toLowerCase().includes('cancel'))
  );

  /** Of those, the ones already behind us. */
  readonly taughtIntervalCount = computed(
    () => this.liveIntervalSessions().filter((s) => new Date(s.startsAt) < new Date()).length
  );

  readonly overviewStatCards = computed<StatCard[]>(() => {
    const sessions = this.liveIntervalSessions().length;
    const taught = this.taughtIntervalCount();
    const cards: StatCard[] = [
      {
        label: `Sessions (${this.viewLabel()})`,
        value: sessions,
        icon: 'pi pi-calendar-clock',
        color: 'var(--color-secondary)',
        link: '/schedule',
        loading: this.loadingUpcoming(),
        subtitle: sessions
          ? `${taught} taught, ${sessions - taught} to come`
          : `${this.viewIntervalLabel()}`,
      },
      {
        label: 'Hours',
        value: this.totalHours(),
        icon: 'pi pi-clock',
        color: 'var(--color-accent)',
        link: '/schedule',
        loading: this.loadingUpcoming(),
        subtitle: `Total in ${this.viewLabel().toLowerCase()}`,
      },
      {
        label: 'Courses',
        value: this.courseCount(),
        icon: 'pi pi-book',
        color: 'var(--color-success)',
        link: '/courses',
        loading: this.loadingCounts(),
        subtitle: 'Active curriculum',
      },
    ];

    return cards;
  });

  readonly quickLinks = computed(() => {
    const links: {
      label: string;
      description: string;
      icon: string;
      route: string;
      color: string;
    }[] = [
      {
        label: 'Weekly Schedule',
        description: 'View your sessions',
        icon: 'pi pi-calendar-clock',
        route: '/schedule',
        color: 'var(--color-secondary)',
      },
      {
        label: 'Courses',
        description: 'Browse all courses',
        icon: 'pi pi-book',
        route: '/courses',
        color: 'var(--color-success)',
      },
    ];
    if (this.isAdmin() || this.isInstructor()) {
      links.push(
        {
          label: 'Sessions',
          description: 'Mark & review attendance',
          icon: 'pi pi-calendar',
          route: '/attendance',
          color: 'var(--color-warning)',
        },
        {
          label: 'Groups',
          description: 'View all groups',
          icon: 'pi pi-sitemap',
          route: '/groups',
          color: 'var(--color-primary)',
        }
      );
    }
    if (this.isAdmin()) {
      links.push(
        {
          label: 'Students',
          description: 'Manage student accounts',
          icon: 'pi pi-graduation-cap',
          route: '/students',
          color: 'var(--color-warning)',
        },
        {
          label: 'Instructors',
          description: 'Manage instructor accounts',
          icon: 'pi pi-user',
          route: '/instructors',
          color: 'var(--color-primary)',
        }
      );
    }
    return links;
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.loadUpcoming();
    this.loadCounts();
    this.loadAllSessions();
    this.loadAttendanceSummary();
  }

  setView(view: DashboardView): void {
    this.activeView.set(view);
    this.activeStatusFilter.set('all');
  }

  private loadAttendanceSummary(): void {
    this.loadingAttendanceSummary.set(true);
    this.lms.getAttendanceSummary().subscribe({
      next: (summary) => {
        this.attendedToday.set(summary?.attendedToday ?? 0);
        this.attendedThisWeek.set(summary?.attendedThisWeek ?? 0);
        this.sessionsUpdatedTodayCount.set(summary?.sessionsUpdatedTodayCount ?? 0);
        this.pendingAttendanceCount.set(summary?.pendingAttendanceSessionsCount ?? 0);
        this.updatedSessionsList.set(summary?.sessionsUpdatedToday ?? []);
        this.pendingSessionsList.set(summary?.pendingAttendanceSessions ?? []);
        this.loadingAttendanceSummary.set(false);
      },
      error: () => {
        this.loadingAttendanceSummary.set(false);
      },
    });
  }

  openSessionModal(type: 'updated' | 'pending'): void {
    this.activeSessionModal.set(type);
  }

  closeSessionModal(): void {
    this.activeSessionModal.set(null);
  }

  onStatCardClick(card: StatCard, event: Event): void {
    if (card.action) {
      event.preventDefault();
      card.action();
    }
  }

  setFilter(filter: SessionStatusFilter): void {
    this.activeStatusFilter.set(filter);
  }

  private loadUpcoming(): void {
    this.loadingUpcoming.set(true);

    const today = new Date();
    const dayOfWeek = today.getDay();
    const saturdayOffset = (dayOfWeek + 1) % 7;
    const diff = today.getDate() - saturdayOffset;
    const from = new Date(today.setDate(diff));
    from.setHours(0, 0, 0, 0);

    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    this.lms.getSchedule(from, to).subscribe({
      next: (sessions) => {
        const sorted = (sessions || []).sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        );
        this.upcomingSessions.set(sorted);
        this.loadingUpcoming.set(false);
      },
      error: () => {
        this.loadingUpcoming.set(false);
      },
    });
  }

  getSessionCode(s: any): string {
    return getSessionCode(s);
  }

  getSessionDisplayTopic(s: any): string {
    return getSessionDisplayTopic(s);
  }

  private loadCounts(): void {
    this.loadingCounts.set(true);

    this.lms.getCourses().subscribe({
      next: (courses) => {
        this.courseCount.set(courses?.length ?? 0);
        this.loadingCounts.set(false);
      },
      error: () => this.loadingCounts.set(false),
    });
  }

  private loadAllSessions(): void {
    this.loadingAllSessions.set(true);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    this.lms.getSchedule(from, to).subscribe({
      next: (sessions) => {
        this.allSessions.set(sessions || []);
        this.loadingAllSessions.set(false);
      },
      error: () => {
        this.loadingAllSessions.set(false);
      },
    });
  }

  isSessionCancelled(s: ScheduleSession): boolean {
    return (s.status ?? '').toLowerCase().includes('cancel');
  }

  isSessionCompleted(s: ScheduleSession): boolean {
    return (s.status ?? '').toLowerCase().includes('completed');
  }

  formatTime(iso: string): string {
    return this.clock.time(iso);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  formatShortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  getStatusBadgeClass(status: string): string {
    const norm = (status ?? '').toLowerCase();
    if (norm.includes('completed')) return 'status-badge--completed';
    if (norm.includes('cancel')) return 'status-badge--cancelled';
    return 'status-badge--scheduled';
  }
}
