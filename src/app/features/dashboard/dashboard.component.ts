import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LmsService, ScheduleSession } from '../../core/services/lms.service';
import { Role } from '../../core/interfaces/Role';

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
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Header -->
      <div class="mb-10">
        <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
          Overview
        </h1>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">
          Welcome back, <span class="font-semibold text-[var(--color-secondary)]">{{ userName() }}</span>!
          Here's a snapshot of your week.
        </p>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
        @for (card of statCards(); track card.label) {
          <a
            [routerLink]="card.link ?? null"
            class="stat-card group"
            [style.--card-color]="card.color"
          >
            <div class="stat-icon">
              <i [class]="card.icon"></i>
            </div>
            @if (card.loading) {
              <p class="stat-value text-[var(--color-text-muted)]">
                <i class="pi pi-spin pi-spinner text-xl"></i>
              </p>
            } @else {
              <p class="stat-value">{{ card.value }}</p>
            }
            <p class="stat-label">{{ card.label }}</p>
          </a>
        }
      </div>

      <!-- Quick Links -->
      <div class="mb-10">
        <h2 class="text-lg font-bold text-[var(--color-text-primary)] mb-4">Quick Links</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          @for (link of quickLinks(); track link.label) {
            <a
              [routerLink]="link.route"
              class="quick-link-card flex items-center gap-3 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-secondary)] hover:shadow-[0_4px_12px_rgba(62,109,181,0.08)] transition-all duration-300 group"
            >
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg" [style.background]="link.color">
                <i [class]="link.icon"></i>
              </div>
              <div>
                <p class="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-secondary)] transition-colors">{{ link.label }}</p>
                <p class="text-xs text-[var(--color-text-muted)]">{{ link.description }}</p>
              </div>
              <i class="pi pi-arrow-right ml-auto text-[var(--color-text-muted)] group-hover:text-[var(--color-secondary)] transition-colors text-sm"></i>
            </a>
          }
        </div>
      </div>

      <!-- Sessions This Week preview -->
      <div>
        <h2 class="text-lg font-bold text-[var(--color-text-primary)] mb-4">
          Sessions This Week
          <span class="ml-2 text-sm font-normal text-[var(--color-text-muted)]">(from schedule)</span>
        </h2>
        @if (loadingUpcoming()) {
          <div class="flex items-center gap-3 text-[var(--color-text-muted)] text-sm py-6">
            <i class="pi pi-spinner pi-spin"></i> Loading weekly sessions…
          </div>
        } @else if (upcomingSessions().length === 0) {
          <div class="empty-state">
            <i class="pi pi-calendar text-4xl mb-3 opacity-40"></i>
            <p class="font-semibold">No sessions scheduled this week</p>
            <p class="text-sm mt-1">Your schedule appears to be clear.</p>
          </div>
        } @else {
          <div class="flex flex-col gap-3">
            @for (s of upcomingSessions(); track s.id) {
              <a
                routerLink="/schedule"
                class="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-secondary)] transition-colors duration-200"
              >
                <div class="w-10 h-10 rounded-xl bg-[var(--color-info-background)] flex items-center justify-center flex-shrink-0">
                  <i class="pi pi-calendar-clock text-[var(--color-secondary)]"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-[var(--color-text-primary)] truncate">{{ s.topic }}</p>
                  <p class="text-xs text-[var(--color-text-muted)] truncate">
                    {{ s.courseTitle }} · {{ s.groupName }}
                    @if (s.instructorName) {
                      · {{ s.instructorName }}
                    }
                  </p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs font-bold text-[var(--color-secondary)]">{{ formatTime(s.startsAt) }}</p>
                  <p class="text-[10px] text-[var(--color-text-muted)]">{{ formatDate(s.startsAt) }}</p>
                </div>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }

    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 20px;
      border-radius: 16px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      text-decoration: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      border-color: var(--card-color, var(--color-secondary));
    }
    .stat-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--card-color, var(--color-secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      opacity: 0.9;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 800;
      color: var(--color-text-primary);
      margin: 0;
      line-height: 1;
    }
    .stat-label {
      font-size: 12px;
      color: var(--color-text-muted);
      font-weight: 600;
      margin: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 24px;
      border-radius: 16px;
      border: 1px dashed var(--color-border);
      color: var(--color-text-muted);
      text-align: center;
    }
  `,
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
        { label: 'Resources', value: '—', icon: 'pi pi-folder-open', color: 'var(--color-info)', link: '/resources' },
        { label: 'Progress', value: '—', icon: 'pi pi-chart-line', color: 'var(--color-accent)', link: '/progress' }
      );
    }

    return cards;
  });

  readonly quickLinks = computed(() => {
    const links = [
      { label: 'Weekly Schedule', description: 'View your sessions', icon: 'pi pi-calendar-clock', route: '/schedule', color: 'var(--color-secondary)' },
      { label: 'Courses', description: 'Browse all courses', icon: 'pi pi-book', route: '/courses', color: 'var(--color-success)' },
      { label: 'Resources', description: 'Study materials', icon: 'pi pi-folder-open', route: '/resources', color: 'var(--color-info)' },
      { label: 'Progress', description: 'Track completion', icon: 'pi pi-chart-line', route: '/progress', color: 'var(--color-accent)' },
    ];
    if (this.isAdmin() || this.isInstructor()) {
      links.push({ label: 'Attendance', description: 'Mark & review attendance', icon: 'pi pi-calendar', route: '/attendance', color: 'var(--color-warning)' });
      links.push({ label: 'Groups', description: 'View all groups', icon: 'pi pi-sitemap', route: '/groups', color: 'var(--color-primary)' });
    }
    if (this.isAdmin()) {
      links.push({ label: 'Users & Staff', description: 'Manage accounts', icon: 'pi pi-users', route: '/users', color: 'var(--color-primary)' });
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
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
