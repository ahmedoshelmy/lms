import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { WeeklyScheduleComponent, DensityMode } from './weekly-schedule/weekly-schedule.component';
import { SessionDetailPanelComponent } from './session-detail-panel/session-detail-panel.component';
import { DailyScheduleMatrixComponent } from './components/daily-schedule-matrix/daily-schedule-matrix.component';
import { DailyAvailabilityMatrixComponent } from './components/daily-availability-matrix/daily-availability-matrix.component';
import { InstructorAvailabilityMatrixComponent } from './components/instructor-availability-matrix/instructor-availability-matrix.component';
import { ScheduleAnalyticsComponent } from './components/schedule-analytics/schedule-analytics.component';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Role, parseRole } from '../../core/interfaces/Role';
import { InstructorAvailability, InstructorTimeOff } from '../../core/interfaces/Availability';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { User } from '../../core/interfaces/User';

import { DialogModule } from 'primeng/dialog';

import { CreateStandaloneSessionDialogComponent } from './components/create-standalone-session-dialog/create-standalone-session-dialog.component';

export type ExtendedViewMode =
  | 'weekly'
  | 'daily'
  | 'daily-schedule'
  | 'daily-availability'
  | 'instructor-availability'
  | 'analytics'
  | 'monthly';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    SelectModule,
    DialogModule,
    ProgressSpinnerModule,
    WeeklyScheduleComponent,
    SessionDetailPanelComponent,
    DailyScheduleMatrixComponent,
    DailyAvailabilityMatrixComponent,
    InstructorAvailabilityMatrixComponent,
    ScheduleAnalyticsComponent,
    CreateStandaloneSessionDialogComponent,
  ],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  showStandaloneSessionModal = signal<boolean>(false);

  sessions = signal<ScheduleSession[]>([]);
  instructors = signal<User[]>([]);
  selectedInstructorId = signal<number>(0);
  currentWeekStart = signal<Date>(new Date());
  currentDate = signal<Date>(new Date());
  viewMode = signal<ExtendedViewMode>('weekly');

  // Filter signals
  searchQuery = signal<string>('');
  courseFilter = signal<string>('');
  topicFilter = signal<string>('');
  levelFilter = signal<string>('');
  instructorFilter = signal<string>('');
  locationFilter = signal<string>('');
  statusFilter = signal<string>('');
  densityMode = signal<DensityMode>('compact');

  loading = signal(false);
  selectedSession = signal<ScheduleSession | null>(null);
  cancelledWarningDismissed = signal(false);

  // Cancel & Shift Session Modal
  showCancelShiftModal = signal<boolean>(false);
  cancellingSessionId = signal<number | null>(null);
  cancellationReason = signal<string>('');
  shiftFutureSessions = signal<boolean>(true);
  cancelling = signal<boolean>(false);

  readonly uniqueStatuses = computed(() => ['Scheduled', 'Completed', 'Cancelled']);

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

  readonly conflictingSessionIds = computed<Set<number>>(() => {
    const list = this.sessions();
    const conflicts = new Set<number>();

    for (let i = 0; i < list.length; i++) {
      const s1 = list[i];
      // Skip cancelled sessions — they are not real conflicts
      if ((s1.status ?? '').toLowerCase().includes('cancel')) continue;
      if (!s1.startsAt) continue;
      const start1 = new Date(s1.startsAt).getTime();
      const end1 = s1.endsAt
        ? new Date(s1.endsAt).getTime()
        : start1 + (s1.durationMinutes || 60) * 60000;

      const name1 = (s1.instructorName || '').trim().toLowerCase();
      if (!name1 || name1 === 'unassigned') continue;

      for (let j = i + 1; j < list.length; j++) {
        const s2 = list[j];
        // Skip cancelled sessions
        if ((s2.status ?? '').toLowerCase().includes('cancel')) continue;
        if (!s2.startsAt) continue;
        const start2 = new Date(s2.startsAt).getTime();
        const end2 = s2.endsAt
          ? new Date(s2.endsAt).getTime()
          : start2 + (s2.durationMinutes || 60) * 60000;

        const name2 = (s2.instructorName || '').trim().toLowerCase();
        if (!name2 || name2 === 'unassigned') continue;

        const sameInstructor =
          (s1.instructorId && s2.instructorId && s1.instructorId === s2.instructorId) ||
          name1 === name2;

        if (!sameInstructor) continue;

        const isTimeOverlap = start1 < end2 && start2 < end1;
        if (isTimeOverlap) {
          conflicts.add(s1.id);
          conflicts.add(s2.id);
        }
      }
    }
    return conflicts;
  });

  get isAdmin(): boolean {
    return this.auth.hasRole(Role.Admin);
  }

  get isSales(): boolean {
    return this.auth.hasRole(Role.Sales);
  }

  /**
   * Whether the user picks which instructor to look at. Instructors only ever
   * see their own week; admin and sales need the whole board — sales to find a
   * free slot, admin to run it.
   */
  get viewsAllInstructors(): boolean {
    return this.isAdmin || this.isSales;
  }

  get isInstructor(): boolean {
    return this.auth.hasRole(Role.Instructor);
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

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loadInstructors();
    this.loadAvailability();

    if (!this.viewsAllInstructors) {
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

  openCancelShiftModal(sessionId: number): void {
    this.cancellingSessionId.set(sessionId);
    this.cancellationReason.set('');
    this.shiftFutureSessions.set(true);
    this.showCancelShiftModal.set(true);
  }

  confirmCancelAndShiftSession(): void {
    const id = this.cancellingSessionId();
    if (!id) return;
    this.cancelling.set(true);

    this.lmsService
      .cancelAndShiftSession(id, {
        reason: this.cancellationReason().trim() || 'Session cancelled by instructor/admin',
        shiftUpcomingSchedule: this.shiftFutureSessions(),
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess(
            this.shiftFutureSessions()
              ? 'Session cancelled and subsequent sessions shifted forward by 1 week.'
              : 'Session cancelled.'
          );
          this.showCancelShiftModal.set(false);
          this.cancelling.set(false);
          this.loadSchedule();
        },
        error: (err) => {
          this.notify.showError(
            'Failed to cancel session: ' + (err.error?.message || 'Server error')
          );
          this.cancelling.set(false);
        },
      });
  }

  /** What everyone has declared, so the matrices show it rather than assume it. */
  readonly availability = signal<InstructorAvailability[]>([]);
  readonly timeOff = signal<InstructorTimeOff[]>([]);

  private loadAvailability(): void {
    this.lmsService.getInstructorAvailability().subscribe({
      next: (windows) => this.availability.set(windows || []),
      error: () => this.availability.set([]),
    });

    // A fortnight either side of now covers the week being looked at however
    // the user navigates within a sitting.
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const to = new Date();
    to.setDate(to.getDate() + 60);

    this.lmsService
      .getTimeOff(undefined, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10))
      .subscribe({
        next: (off) => this.timeOff.set(off || []),
        error: () => this.timeOff.set([]),
      });
  }

  loadInstructors(): void {
    this.loading.set(true);
    this.lmsService.getScheduleInstructors().subscribe({
      next: (users) => {
        const filtered = (users || []).filter(
          (u) => parseRole(u.role) === Role.Instructor || (u.role as any) === 'Instructor'
        );
        const options: User[] = [
          { id: 0, name: 'All Instructors', email: '', role: Role.Instructor },
          ...filtered,
        ];
        this.instructors.set(options);
        if (this.viewsAllInstructors) {
          if (options.length > 0) {
            this.selectedInstructorId.set(options[0].id);
            this.loadSchedule();
          } else {
            this.loading.set(false);
          }
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

        // Check if query parameter specifies a target sessionId
        const queryParams = this.route.snapshot.queryParams;
        const targetId = Number(queryParams['sessionId'] || queryParams['id']);
        if (targetId && !this.selectedSession()) {
          const found = sessions.find((s) => s.id === targetId);
          if (found) {
            this.selectedSession.set(found);
          } else {
            this.lmsService.getSessionDetails(targetId).subscribe({
              next: (detail) => {
                if (detail && detail.startsAt) {
                  const d = new Date(detail.startsAt);
                  this.currentWeekStart.set(this.getWeekStartForDate(d));
                  this.selectedSession.set(detail);
                  this.loadSchedule();
                }
              },
            });
          }
        }
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
      if (
        d < this.currentWeekStart() ||
        d >= new Date(this.currentWeekStart().getTime() + 7 * 86400000)
      ) {
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
      if (
        d < this.currentWeekStart() ||
        d >= new Date(this.currentWeekStart().getTime() + 7 * 86400000)
      ) {
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
    this.statusFilter.set('');
  }

  hasActiveFilters(): boolean {
    return (
      !!this.searchQuery() ||
      !!this.courseFilter() ||
      !!this.topicFilter() ||
      !!this.levelFilter() ||
      !!this.instructorFilter() ||
      !!this.locationFilter() ||
      !!this.statusFilter()
    );
  }

  onSessionSelected(session: ScheduleSession): void {
    this.router.navigate(['/sessions', session.id]);
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
