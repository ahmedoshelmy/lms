import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { WeeklyScheduleComponent, DensityMode, ViewMode } from './weekly-schedule/weekly-schedule.component';
import { SessionDetailPanelComponent } from './session-detail-panel/session-detail-panel.component';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Role } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { User } from '../../core/interfaces/User';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    SelectModule,
    ProgressSpinnerModule,
    WeeklyScheduleComponent,
    SessionDetailPanelComponent,
  ],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  sessions = signal<ScheduleSession[]>([]);
  instructors = signal<User[]>([]);
  selectedInstructorId = signal<number>(0);
  currentWeekStart = signal<Date>(new Date());
  currentDate = signal<Date>(new Date());
  viewMode = signal<ViewMode>('weekly');

  // Filter signals
  searchQuery = signal<string>('');
  courseFilter = signal<string>('');
  topicFilter = signal<string>('');
  levelFilter = signal<string>('');
  instructorFilter = signal<string>('');
  locationFilter = signal<string>('');
  densityMode = signal<DensityMode>('compact');

  loading = signal(false);
  selectedSession = signal<ScheduleSession | null>(null);
  cancelledWarningDismissed = signal(false);

  readonly uniqueCourses = computed(() => {
    const set = new Set<string>();
    for (const s of this.sessions()) {
      if (s.courseTitle) set.add(s.courseTitle);
    }
    return Array.from(set).sort();
  });

  readonly uniqueTopics = computed(() => {
    const set = new Set<string>();
    for (const s of this.sessions()) {
      if (s.topic) set.add(s.topic);
    }
    return Array.from(set).sort();
  });

  readonly uniqueLevels = computed(() => {
    const set = new Set<string>();
    for (const s of this.sessions()) {
      const match = (s.groupName || '').match(/L\d|Level\s*\d|\b\d\b/i);
      if (match) set.add(match[0].toUpperCase());
    }
    return Array.from(set).sort();
  });

  readonly uniqueInstructors = computed(() => {
    const set = new Set<string>();
    for (const s of this.sessions()) {
      if (s.instructorName && s.instructorName.toLowerCase() !== 'unassigned') {
        set.add(s.instructorName);
      }
    }
    return Array.from(set).sort();
  });

  readonly uniqueLocations = computed(() => {
    const set = new Set<string>();
    for (const s of this.sessions()) {
      if (s.location) set.add(s.location);
    }
    return Array.from(set).sort();
  });

  get isAdmin(): boolean {
    return this.auth.hasRole(Role.Admin);
  }

  get totalSessionsThisWeek(): number {
    return this.sessions().length;
  }

  get hasCancelledSessions(): boolean {
    return (
      !this.cancelledWarningDismissed() &&
      this.sessions().some((s) => (s.status ?? '').toLowerCase().includes('cancel'))
    );
  }

  ngOnInit(): void {
    this.calculateWeekStart();

    if (this.isAdmin) {
      this.loadInstructors();
    } else {
      const userId = this.auth.getUserId();
      if (userId) {
        this.selectedInstructorId.set(userId);
        this.loadSchedule();
      } else {
        this.notify.showError('Could not determine the current user.');
      }
    }
  }

  calculateWeekStart(): void {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const saturdayOffset = (dayOfWeek + 1) % 7;
    const diff = today.getDate() - saturdayOffset;
    const weekStart = new Date(today.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    this.currentWeekStart.set(weekStart);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    this.currentDate.set(now);
  }

  goToToday(): void {
    this.calculateWeekStart();
    this.loadSchedule();
  }

  loadInstructors(): void {
    this.loading.set(true);
    this.lmsService.getInstructors().subscribe({
      next: (users) => {
        const filtered = (users || []).filter((u) => u.role === Role.Instructor);
        const options: User[] = [
          { id: 0, name: 'All Instructors', email: '', role: Role.Instructor },
          ...filtered,
        ];
        this.instructors.set(options);
        if (options.length > 0) {
          this.selectedInstructorId.set(options[0].id);
          this.loadSchedule();
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.notify.showError(`Failed to load instructors list: ${err.message || 'Server error'}`);
        this.loading.set(false);
      },
    });
  }

  loadSchedule(): void {
    const userId = this.selectedInstructorId();

    this.loading.set(true);
    const fromDate = new Date(this.currentWeekStart());
    const toDate = new Date(this.currentWeekStart());
    toDate.setDate(toDate.getDate() + 7);

    let url = `${this.lmsService.getApiUrl()}/schedule?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`;
    if (userId && userId !== 0) {
      url += `&instructorId=${userId}&userId=${userId}`;
    }

    const headers: Record<string, string> = {};

    this.http.get<ScheduleSession[]>(url, { headers }).subscribe({
      next: (res) => {
        let sessions = res || [];
        if (userId && userId !== 0) {
          const selectedInst = this.instructors().find((i) => i.id === userId);
          const filtered = sessions.filter((s) => {
            if (s.instructorId === userId) return true;
            if (selectedInst && s.instructorName) {
              return s.instructorName.toLowerCase().includes(selectedInst.name.toLowerCase());
            }
            return false;
          });
          if (
            filtered.length > 0 ||
            sessions.some((s) => s.instructorId && s.instructorId !== userId)
          ) {
            sessions = filtered;
          }
        }
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.showError(`Failed to load schedule: ${err.message || 'Server error'}`);
        this.loading.set(false);
      },
    });
  }

  onInstructorChange(): void {
    this.loadSchedule();
  }

  previousDate(): void {
    if (this.viewMode() === 'daily') {
      const d = new Date(this.currentDate());
      d.setDate(d.getDate() - 1);
      this.currentDate.set(d);

      // If moved outside current loaded week, reload
      if (d < this.currentWeekStart() || d >= new Date(this.currentWeekStart().getTime() + 7 * 86400000)) {
        this.currentWeekStart.set(this.getWeekStartForDate(d));
        this.loadSchedule();
      }
    } else {
      const newDate = new Date(this.currentWeekStart());
      newDate.setDate(newDate.getDate() - 7);
      this.currentWeekStart.set(newDate);
      this.loadSchedule();
    }
  }

  nextDate(): void {
    if (this.viewMode() === 'daily') {
      const d = new Date(this.currentDate());
      d.setDate(d.getDate() + 1);
      this.currentDate.set(d);

      // If moved outside current loaded week, reload
      if (d < this.currentWeekStart() || d >= new Date(this.currentWeekStart().getTime() + 7 * 86400000)) {
        this.currentWeekStart.set(this.getWeekStartForDate(d));
        this.loadSchedule();
      }
    } else {
      const newDate = new Date(this.currentWeekStart());
      newDate.setDate(newDate.getDate() + 7);
      this.currentWeekStart.set(newDate);
      this.loadSchedule();
    }
  }

  private getWeekStartForDate(date: Date): Date {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const saturdayOffset = (dayOfWeek + 1) % 7;
    const diff = d.getDate() - saturdayOffset;
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  getDateRangeString(): string {
    if (this.viewMode() === 'daily') {
      return this.currentDate().toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }

    const start = new Date(this.currentWeekStart());
    const end = new Date(this.currentWeekStart());
    end.setDate(end.getDate() + 6);

    const formatOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.courseFilter.set('');
    this.topicFilter.set('');
    this.levelFilter.set('');
    this.instructorFilter.set('');
    this.locationFilter.set('');
  }

  hasActiveFilters(): boolean {
    return (
      !!this.searchQuery() ||
      !!this.courseFilter() ||
      !!this.topicFilter() ||
      !!this.levelFilter() ||
      !!this.instructorFilter() ||
      !!this.locationFilter()
    );
  }

  onSessionSelected(session: ScheduleSession): void {
    this.selectedSession.set(session);
  }

  onPanelClosed(): void {
    this.selectedSession.set(null);
  }

  onSessionUpdated(updated: ScheduleSession): void {
    this.sessions.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    if (this.selectedSession()?.id === updated.id) {
      this.selectedSession.set(updated);
    }
  }

  dismissCancelledWarning(): void {
    this.cancelledWarningDismissed.set(true);
  }
}

