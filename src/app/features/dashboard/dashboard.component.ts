import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { Role, ROLE_LABELS } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  link?: string;
  loading?: boolean;
  subtitle?: string;
}

export type SessionStatusFilter = 'all' | 'scheduled' | 'running' | 'completed' | 'cancelled';

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

  loadingUpcoming = signal(false);
  loadingCounts = signal(false);
  loadingAllSessions = signal(false);
  upcomingSessions = signal<ScheduleSession[]>([]);
  allSessions = signal<ScheduleSession[]>([]);
  courseCount = signal<number | '—'>('—');
  instructorCount = signal<number | '—'>('—');
  studentCount = signal<number | '—'>('—');
  groupCount = signal<number | '—'>('—');

  activeStatusFilter = signal<SessionStatusFilter>('all');

  readonly scheduledCount = computed(
    () =>
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('scheduled'))
        .length
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('scheduled'))
        .length
  );
  readonly runningCount = computed(
    () =>
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('running'))
        .length
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('running'))
        .length
  );
  readonly completedCount = computed(
    () =>
      this.upcomingSessions().filter((s) => (s.status ?? '').toLowerCase().includes('completed'))
        .length
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
      if (filter === 'running') return norm.includes('running');
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
      this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('scheduled')).length
  );
  readonly allOngoingCount = computed(
    () =>
      this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('ongoing')).length
      this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('ongoing')).length
  );
  readonly allCompletedCount = computed(
    () =>
      this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('completed')).length
      this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('completed')).length
  );
  readonly allCancelledCount = computed(
    () => this.allSessions().filter((s) => (s.status ?? '').toLowerCase().includes('cancel')).length
  );

  readonly monthlyProgressPercentages = computed(() => {
    const total = this.totalSessionsCount();
    if (!total) return { scheduled: 0, ongoing: 0, completed: 0, cancelled: 0 };
    return {
      scheduled: Math.round((this.allScheduledCount() / total) * 100),
      ongoing: Math.round((this.allOngoingCount() / total) * 100),
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
    const neutral = 'var(--color-neutral-icon-bg)';
    const cards: StatCard[] = [
      {
        label: 'Sessions This Week',
        value: upcoming,
        icon: 'pi pi-calendar-clock',
        color: neutral,
        link: '/schedule',
        loading: this.loadingUpcoming(),
        subtitle: 'Scheduled across week',
      },
      {
        label: 'Total Hours',
        value: this.totalHours(),
        icon: 'pi pi-clock',
        color: neutral,
        link: '/schedule',
        loading: this.loadingAllSessions(),
        subtitle: 'Tracked this month',
      },
      {
        label: 'Courses',
        value: this.courseCount(),
        icon: 'pi pi-book',
        color: neutral,
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
          color: neutral,
          link: '/instructors',
          loading: this.loadingCounts(),
          subtitle: 'Active educators',
        },
        {
          label: 'Students',
          value: this.studentCount(),
          icon: 'pi pi-users',
          color: neutral,
          link: '/students',
          loading: this.loadingCounts(),
          subtitle: 'Enrolled learners',
        },
        {
          label: 'Total Groups',
          value: this.groupCount(),
          icon: 'pi pi-sitemap',
          color: neutral,
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
        label: 'Schedule',
        description: 'View your sessions',
        icon: 'pi pi-calendar-clock',
        route: '/schedule',
        color: accent,
        textColor: 'var(--color-secondary-content)',
      },
      {
        label: 'Courses',
        description: 'Browse all courses',
        icon: 'pi pi-book',
        route: '/courses',
        color: neutral,
        textColor: 'var(--color-neutral-icon)',
      },
    ];
    if (this.isAdmin() || this.isInstructor()) {
      links.push(
        {
          label: 'Sessions',
          description: 'Mark & review attendance',
          icon: 'pi pi-calendar',
          route: '/attendance',
          color: neutral,
          textColor: 'var(--color-neutral-icon)',
        },
        {
          label: 'Groups',
          description: 'View all groups',
          icon: 'pi pi-sitemap',
          route: '/groups',
          color: neutral,
          textColor: 'var(--color-neutral-icon)',
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
          color: neutral,
          textColor: 'var(--color-neutral-icon)',
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
    this.loadUpcoming();
    this.loadCounts();
    this.loadAllSessions();
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
    if (norm.includes('running')) return 'status-badge--running';
    if (norm.includes('completed')) return 'status-badge--completed';
    if (norm.includes('cancel')) return 'status-badge--cancelled';
    return 'status-badge--scheduled';
  }
}
