import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { User } from '../../core/interfaces/User';
import { Group } from '../../core/interfaces/Group';
import { getSessionCode } from '../../core/utils/session-code.utils';

export type SessionStatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';
export type DateRangeFilter = 'all' | 'today' | 'week' | 'month';

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
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SelectModule, ProgressSpinnerModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  sessions = signal<ScheduleSession[]>([]);
  loading = signal(false);
  searchQuery = signal('');
  sessionStatusFilter = signal<SessionStatusFilter>('all');
  selectedGroupFilter = signal<string>('all');
  dateRangeFilter = signal<DateRangeFilter>('all');
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
      this.dateRangeFilter() !== 'all' ||
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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

    return all.filter((s) => {
      if (instFilter !== 0) {
        const selectedInst = this.instructors().find((i) => i.id === instFilter);
        const matchesInstId = String(s.instructorId) === String(instFilter);
        const matchesInstName =
          selectedInst && s.instructorName
            ? s.instructorName.toLowerCase().includes(selectedInst.name.toLowerCase())
            : false;
        if (!matchesInstId && !matchesInstName) return false;
      }

      const normStatus = (s.status ?? '').toLowerCase();
      if (statusFilter === 'scheduled' && !normStatus.includes('scheduled')) return false;
      if (statusFilter === 'completed' && !normStatus.includes('completed')) return false;
      if (statusFilter === 'cancelled' && !normStatus.includes('cancel')) return false;

      if (groupFilter !== 'all' && s.groupName !== groupFilter) return false;

      if (dateFilter !== 'all') {
        const time = new Date(s.startsAt).getTime();
        if (dateFilter === 'today' && (time < todayStart || time >= todayEnd)) return false;
        if (dateFilter === 'week' && (time < weekStart.getTime() || time >= weekEnd.getTime()))
          return false;
        if (dateFilter === 'month' && (time < monthStart || time > monthEnd)) return false;
      }

      if (query) {
        const searchable = `${s.topic} ${s.courseTitle} ${s.groupName} ${s.instructorName}`.toLowerCase();
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

      let dateLabel = sDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      let subLabel = '';
      if (isToday) {
        dateLabel = 'TODAY';
        subLabel = sDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      } else if (isTomorrow) {
        dateLabel = 'TOMORROW';
        subLabel = sDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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
          const filtered = (users || []).filter((u) => u.role === Role.Instructor);
          this.instructors.set([
            { id: 0, name: 'All Instructors', email: '', role: Role.Instructor },
            ...filtered,
          ]);
        },
      });
    }
  }

  loadData(): void {
    this.loading.set(true);
    this.lms.getSchedule().subscribe({
      next: (sessions) => {
        const sorted = (sessions || []).sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        );
        this.sessions.set(sorted);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openSession(session: ScheduleSession): void {
    this.router.navigate(['/sessions', session.id]);
  }

  getSessionCode(s: any): string {
    return getSessionCode(s);
  }

  setSessionStatusFilter(filter: SessionStatusFilter): void {
    this.sessionStatusFilter.set(filter);
  }

  setGroupFilter(group: string): void {
    this.selectedGroupFilter.set(group);
  }

  setDateRangeFilter(filter: DateRangeFilter): void {
    this.dateRangeFilter.set(filter);
  }

  setInstructorFilter(instId: number): void {
    this.selectedInstructorFilter.set(instId);
  }

  resetFilters(): void {
    this.sessionStatusFilter.set('all');
    this.selectedGroupFilter.set('all');
    this.dateRangeFilter.set('all');
    this.selectedInstructorFilter.set(0);
    this.searchQuery.set('');
    this.sortBy.set('time');
  }

  formatTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
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
      return { label: 'Cancelled', css: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: 'pi-times-circle' };
    }
    if (status.includes('completed')) {
      return { label: 'Attendance Marked', css: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: 'pi-check-circle' };
    }

    const now = new Date();
    const sessionTime = new Date(s.startsAt || Date.now());
    if (sessionTime <= now) {
      return { label: 'Attendance Pending', css: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: 'pi-exclamation-triangle' };
    }

    return { label: 'Upcoming', css: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: 'pi-clock' };
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
