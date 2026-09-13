import { Component, inject, computed, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { Role } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { Group } from '../../core/interfaces/Group';
import { PendingAttendanceSessionDto } from '../../core/interfaces/Attendance';
import { getSessionCode, getSessionDisplayTopic } from '../../core/utils/session-code.utils';
import { SalesOverviewComponent } from './sales-overview/sales-overview.component';
import { StudentHomeComponent } from './student-home/student-home.component';
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

export interface ChartBar {
  label: string;
  value: number;
  percent: number;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, SalesOverviewComponent, StudentHomeComponent],
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
  courseCount = signal<number | 'â€”'>('â€”');
  instructorCount = signal<number | 'â€”'>('â€”');
  studentCount = signal<number | 'â€”'>('â€”');
  groupCount = signal<number | 'â€”'>('â€”');
  groups = signal<Group[]>([]);
  attendedToday = signal<number | 'â€”'>('â€”');
  attendedThisWeek = signal<number | 'â€”'>('â€”');
  sessionsUpdatedTodayCount = signal<number | 'â€”'>('â€”');
  pendingAttendanceCount = signal<number | 'â€”'>('â€”');
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

  // â”€â”€â”€ Interval Sessions (the sessions for the selected view) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Sessions per Instructor (chart data) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly sessionsPerInstructor = computed<ChartBar[]>(() => {
    const sessions = this.intervalSessions();
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      const name = s.instructorName || 'Unassigned';
      map.set(name, (map.get(name) || 0) + 1);
    });
    const max = Math.max(...Array.from(map.values()), 1);
    const colors = [
      'var(--color-secondary)',
      'var(--color-success)',
      'var(--color-warning)',
      'var(--color-primary)',
      'var(--color-danger)',
      'var(--color-info)',
    ];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({
        label,
        value,
        percent: Math.round((value / max) * 100),
        color: colors[i % colors.length],
      }));
  });

  // â”€â”€â”€ Sessions per Course (chart data) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly sessionsPerCourse = computed<ChartBar[]>(() => {
    const sessions = this.intervalSessions();
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      const name = s.courseTitle || 'Unknown';
      map.set(name, (map.get(name) || 0) + 1);
    });
    const max = Math.max(...Array.from(map.values()), 1);
    const colors = [
      'var(--color-info)',
      'var(--color-success)',
      'var(--color-warning)',
      'var(--color-secondary)',
      'var(--color-primary)',
      'var(--color-danger)',
    ];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({
        label,
        value,
        percent: Math.round((value / max) * 100),
        color: colors[i % colors.length],
      }));
  });

  // â”€â”€â”€ Status Distribution (for donut chart) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly statusDistribution = computed(() => {
    const total = this.totalSessionsCount();
    return {
      scheduled: this.allScheduledCount(),
      completed: this.allCompletedCount(),
      cancelled: this.allCancelledCount(),
      total,
      scheduledPercent: total ? Math.round((this.allScheduledCount() / total) * 100) : 0,
      completedPercent: total ? Math.round((this.allCompletedCount() / total) * 100) : 0,
      cancelledPercent: total ? Math.round((this.allCancelledCount() / total) * 100) : 0,
    };
  });

  // â”€â”€â”€ Daily Session Count (for bar chart) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly dailySessionCounts = computed(() => {
    const sessions = this.intervalSessions();
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      const date = s.startsAt.split('T')[0];
      map.set(date, (map.get(date) || 0) + 1);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const max = Math.max(...sorted.map(([, v]) => v), 1);
    return sorted.map(([date, count]) => ({
      date,
      label: this.formatDayLabel(date),
      count,
      percent: Math.round((count / max) * 100),
    }));
  });

  readonly attendanceStatCards = computed<StatCard[]>(() => {
    const view = this.activeView();
    const viewLabel = this.viewLabel();
    const attendedValue = view === 'today' ? this.attendedToday() : this.attendedThisWeek();
    const attendedLabel = view === 'today' ? 'Attended Today' : `Attended ${viewLabel}`;
    const attendedSubtitle =
      view === 'today' ? 'Students present today' : `Students present ${viewLabel.toLowerCase()}`;
    const sessionCount = this.intervalSessions().length;

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
        subtitle: `${this.viewIntervalLabel()}`,
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

  /** Groups actually teaching, as opposed to finished, stopped or archived. */
  readonly runningGroups = computed(() => this.groups().filter((g) => g.status === 'Running'));

  /**
   * Children currently in class, counted by head rather than by adding the
   * groups up: three of them attend more than one running group, so the sum of
   * group sizes is 144 where the number of children is 140. The roster comes
   * down with the group list, so this costs nothing; where it has not, the
   * group's own count stands in.
   */
  readonly studentsInRunningGroups = computed(() => {
    const seen = new Set<number>();
    let withoutRoster = 0;

    for (const group of this.runningGroups()) {
      if (group.students?.length) {
        for (const student of group.students) seen.add(student.studentId);
      } else {
        withoutRoster += group.studentCount || 0;
      }
    }

    return seen.size + withoutRoster;
  });

  readonly overviewStatCards = computed<StatCard[]>(() => {
    const sessions = this.intervalSessions().length;
    const cards: StatCard[] = [
      {
        label: `Sessions (${this.viewLabel()})`,
        value: sessions,
        icon: 'pi pi-calendar-clock',
        color: 'var(--color-secondary)',
        link: '/schedule',
        loading: this.loadingUpcoming(),
        subtitle: `${this.viewIntervalLabel()}`,
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

    if (this.isAdmin()) {
      cards.push(
        {
          label: 'Instructors',
          value: this.instructorCount(),
          icon: 'pi pi-user',
          color: 'var(--color-warning)',
          link: '/instructors',
          loading: this.loadingCounts(),
          subtitle: 'Active educators',
        },
        {
          label: 'Students',
          value: this.studentCount(),
          icon: 'pi pi-users',
          color: 'var(--color-info)',
          link: '/students',
          loading: this.loadingCounts(),
          subtitle: 'Enrolled learners',
        },
        {
          label: 'Running Groups',
          value: this.runningGroups().length,
          icon: 'pi pi-sitemap',
          color: 'var(--color-primary)',
          link: '/groups',
          loading: this.loadingCounts(),
          subtitle: `${this.groupCount()} on the books`,
        },
        {
          label: 'Students in Class',
          value: this.studentsInRunningGroups(),
          icon: 'pi pi-user-plus',
          color: 'var(--color-accent)',
          link: '/groups',
          loading: this.loadingCounts(),
          subtitle: 'Across the running groups',
        }
      );
    }

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

    if (this.isAdmin()) {
      this.lms.getInstructors().subscribe({
        next: (instructors) => this.instructorCount.set(instructors?.length ?? 0),
        error: () => {},
      });
      this.lms.getStudents().subscribe({
        next: (students) => this.studentCount.set(students?.length ?? 0),
        error: () => {},
      });
      this.lms.getGroups().subscribe({
        next: (groups) => {
          this.groups.set(groups ?? []);
          this.groupCount.set(groups?.length ?? 0);
        },
        error: () => {},
      });
    }
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

  isSessionFutureDay(s: ScheduleSession): boolean {
    if (!s.startsAt) return false;
    const start = new Date(s.startsAt);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return start.getTime() > todayEnd.getTime();
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

  formatDayLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (isToday) return 'Today';
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getStatusBadgeClass(status: string): string {
    const norm = (status ?? '').toLowerCase();
    if (norm.includes('completed')) return 'status-badge--completed';
    if (norm.includes('cancel')) return 'status-badge--cancelled';
    return 'status-badge--scheduled';
  }
}

