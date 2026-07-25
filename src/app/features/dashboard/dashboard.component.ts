import { Component, inject, computed, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { Role, ROLE_LABELS } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';

import { PendingAttendanceSessionDto } from '../../core/interfaces/Attendance';

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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
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
  instructorCount = signal<number | '—'>('—');
  studentCount = signal<number | '—'>('—');
  groupCount = signal<number | '—'>('—');
  attendedToday = signal<number | '—'>('—');
  attendedThisWeek = signal<number | '—'>('—');
  sessionsUpdatedTodayCount = signal<number | '—'>('—');
  pendingAttendanceCount = signal<number | '—'>('—');
  updatedSessionsList = signal<PendingAttendanceSessionDto[]>([]);
  pendingSessionsList = signal<PendingAttendanceSessionDto[]>([]);

  activeSessionModal = signal<'updated' | 'pending' | null>(null);

  activeStatusFilter = signal<SessionStatusFilter>('all');

  readonly scheduledCount = computed(
    () =>
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('scheduled'))
        .length
  );
  readonly completedCount = computed(
    () =>
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('completed'))
        .length
  );
  readonly cancelledCount = computed(
    () =>
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('cancel'))
        .length
  );

  readonly filteredSessions = computed(() => {
    const filter = this.activeStatusFilter();
    const sessions = this.upcomingSessions();
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
    const sessions = this.allSessions();
    if (!sessions.length) return 0;
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    return Math.round((totalMinutes / 60) * 10) / 10;
  });

  readonly totalSessionsCount = computed(() => this.allSessions().length);

  readonly allScheduledCount = computed(
    () =>
      this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('scheduled')).length
  );
  readonly allCompletedCount = computed(
    () =>
      this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('completed')).length
  );
  readonly allCancelledCount = computed(
    () => this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('cancel')).length
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

  readonly userName = computed(() => this.auth.currentUser()?.name ?? 'User');
  readonly userRole = computed(() => {
    const role = this.auth.currentUser()?.role;
    return role ? ROLE_LABELS[role] : 'Member';
  });
  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));
  readonly isInstructor = computed(() => this.auth.hasRole(Role.Instructor));
  readonly roleIcon = computed(() => {
    if (this.isAdmin()) return 'pi pi-shield';
    if (this.isInstructor()) return 'pi pi-user-edit';
    return 'pi pi-graduation-cap';
  });

  readonly todayFormatted = computed(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  });

  readonly statCards = computed<StatCard[]>(() => {
    const upcoming = this.upcomingSessions().length;
    const cards: StatCard[] = [
      {
        label: 'Attended Today',
        value: this.attendedToday(),
        icon: 'pi pi-user-check',
        color: 'var(--color-success)',
        link: '/attendance',
        loading: this.loadingAttendanceSummary(),
        subtitle: 'Students present today',
      },
      {
        label: 'Attended This Week',
        value: this.attendedThisWeek(),
        icon: 'pi pi-check-square',
        color: 'var(--color-primary)',
        link: '/attendance',
        loading: this.loadingAttendanceSummary(),
        subtitle: 'Students present this week',
      },
      {
        label: 'Attendance Updated Today',
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
      {
        label: 'Sessions This Week',
        value: upcoming,
        icon: 'pi pi-calendar-clock',
        color: 'var(--color-secondary)',
        link: '/schedule',
        loading: this.loadingUpcoming(),
        subtitle: 'Scheduled across week',
      },
      {
        label: 'Total Hours',
        value: this.totalHours(),
        icon: 'pi pi-clock',
        color: 'var(--color-accent)',
        link: '/schedule',
        loading: this.loadingAllSessions(),
        subtitle: 'Tracked this month',
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
          label: 'Total Groups',
          value: this.groupCount(),
          icon: 'pi pi-sitemap',
          color: 'var(--color-primary)',
          link: '/groups',
          loading: this.loadingCounts(),
          subtitle: 'Assigned cohorts',
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

    // Use LmsService to fetch all sessions for all instructors for the entire current week
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

  private loadCounts(): void {
    this.loadingCounts.set(true);

    // Fetch courses count for everyone
    this.lms.getCourses().subscribe({
      next: (courses) => {
        this.courseCount.set(courses?.length ?? 0);
        this.loadingCounts.set(false);
      },
      error: () => this.loadingCounts.set(false),
    });

    // Admin-only: fetch instructors + students + groups counts
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
        next: (groups) => this.groupCount.set(groups?.length ?? 0),
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

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
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
