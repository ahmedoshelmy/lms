import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { Role } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  link?: string;
  loading?: boolean;
}

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
  upcomingSessions = signal<ScheduleSession[]>([]);
  courseCount = signal<number | '—'>('—');
  userCount = signal<number | '—'>('—');
  groupCount = signal<number | '—'>('—');

  readonly scheduledCount = computed(
    () =>
      this.upcomingSessions().filter((s) =>
        (s.status ?? '').toLowerCase().includes('scheduled')
      ).length
  );
  readonly ongoingCount = computed(
    () =>
      this.upcomingSessions().filter((s) =>
        (s.status ?? '').toLowerCase().includes('ongoing')
      ).length
  );
  readonly completedCount = computed(
    () =>
      this.upcomingSessions().filter((s) =>
        (s.status ?? '').toLowerCase().includes('completed')
      ).length
  );
  readonly cancelledCount = computed(
    () =>
      this.upcomingSessions().filter((s) =>
        (s.status ?? '').toLowerCase().includes('cancel')
      ).length
  );

  readonly userName = computed(() => this.auth.currentUser()?.name ?? 'User');
  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));
  readonly isInstructor = computed(() => this.auth.hasRole(Role.Instructor));

  readonly statCards = computed<StatCard[]>(() => {
    const upcoming = this.upcomingSessions().length;
    const cards: StatCard[] = [
      {
        label: 'Sessions This Week',
        value: upcoming,
        icon: 'pi pi-calendar-clock',
        color: 'var(--color-secondary)',
        link: '/schedule',
        loading: this.loadingUpcoming(),
      },
      {
        label: 'Courses',
        value: this.courseCount(),
        icon: 'pi pi-book',
        color: 'var(--color-success)',
        link: '/courses',
        loading: this.loadingCounts(),
      },
    ];

    if (this.isAdmin()) {
      cards.push(
        {
          label: 'Total Users',
          value: this.userCount(),
          icon: 'pi pi-users',
          color: 'var(--color-warning)',
          link: '/users',
          loading: this.loadingCounts(),
        },
        {
          label: 'Total Groups',
          value: this.groupCount(),
          icon: 'pi pi-sitemap',
          color: 'var(--color-primary)',
          link: '/groups',
          loading: this.loadingCounts(),
        }
      );
    } else {
      cards.push(
        {
          label: 'Resources',
          value: '—',
          icon: 'pi pi-folder-open',
          color: 'var(--color-info)',
          link: '/resources',
        },
        {
          label: 'Progress',
          value: '—',
          icon: 'pi pi-chart-line',
          color: 'var(--color-accent)',
          link: '/progress',
        }
      );
    }

    return cards;
  });

  readonly quickLinks = computed(() => {
    const links = [
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
      {
        label: 'Resources',
        description: 'Study materials',
        icon: 'pi pi-folder-open',
        route: '/resources',
        color: 'var(--color-info)',
      },
      {
        label: 'Progress',
        description: 'Track completion',
        icon: 'pi pi-chart-line',
        route: '/progress',
        color: 'var(--color-accent)',
      },
    ];
    if (this.isAdmin() || this.isInstructor()) {
      links.push({
        label: 'Attendance',
        description: 'Mark & review attendance',
        icon: 'pi pi-calendar',
        route: '/attendance',
        color: 'var(--color-warning)',
      });
      links.push({
        label: 'Groups',
        description: 'View all groups',
        icon: 'pi pi-sitemap',
        route: '/groups',
        color: 'var(--color-primary)',
      });
    }
    if (this.isAdmin()) {
      links.push({
        label: 'Users & Staff',
        description: 'Manage accounts',
        icon: 'pi pi-users',
        route: '/users',
        color: 'var(--color-primary)',
      });
    }
    return links;
  });

  ngOnInit(): void {
    this.loadUpcoming();
    this.loadCounts();
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

    // Admin-only: fetch users + groups counts
    if (this.isAdmin()) {
      this.lms.getUsers().subscribe({
        next: (users) => this.userCount.set(users?.length ?? 0),
        error: () => {},
      });
      this.lms.getGroups().subscribe({
        next: (groups) => this.groupCount.set(groups?.length ?? 0),
        error: () => {},
      });
    }
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
    if (norm.includes('ongoing')) return 'status-badge--ongoing';
    if (norm.includes('completed')) return 'status-badge--completed';
    if (norm.includes('cancel')) return 'status-badge--cancelled';
    return 'status-badge--scheduled';
  }
}
