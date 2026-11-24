import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { HttpClient, HttpParams } from '@angular/common/http';
import { LoadErrorComponent } from '../../shared/components/load-error/load-error.component';
import { Role, parseRole } from '../../core/interfaces/Role';
import { InstructorAvailability, InstructorTimeOff } from '../../core/interfaces/Availability';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { ClockCheck } from '../../core/interfaces/ClockCheck';
import { User } from '../../core/interfaces/User';
import { DialogModule } from 'primeng/dialog';
import { CreateStandaloneSessionDialogComponent } from './components/create-standalone-session-dialog/create-standalone-session-dialog.component';
import { toIsoDate } from '../../core/utils/date.utils';
import { latestRequest } from '../../core/utils/latest-request';
import { startOfSchoolWeek } from '../../core/utils/week.utils';

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
    FormsModule,
    RouterModule,
    ButtonModule,
    SelectModule,
    DialogModule,
    ProgressSpinnerModule,
    LoadErrorComponent,
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
  private readonly scheduleRequest = latestRequest();
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  showStandaloneSessionModal = signal<boolean>(false);

  // ── Telling instructors now, rather than waiting for Thursday ─────────────

  // ── The clocks changed ──────────────────────────────────────────────────
  //
  // Twice a year, and the only thing anybody should have to do about it is
  // press this and read what it says.
  readonly showClockDialog = signal(false);
  readonly clockCheck = signal<ClockCheck | null>(null);
  readonly clockChecking = signal(false);
  readonly clockFixing = signal(false);
  readonly clockChosen = signal<Set<number>>(new Set());

  openClockDialog(): void {
    this.showClockDialog.set(true);
    this.clockCheck.set(null);
    this.clockChecking.set(true);

    this.lmsService.checkClocks().subscribe({
      next: (check) => {
        this.clockCheck.set(check);
        this.clockChecking.set(false);

        // Ticked by default where the slot is believable. Where a whole group
        // disagrees with its own slot it is usually the slot that is wrong, and
        // waving that through would move the entire group.
        this.clockChosen.set(
          new Set(
            check.outOfStep.filter((item) => !item.slotLooksWrong).map((item) => item.sessionId)
          )
        );
      },
      error: () => this.clockChecking.set(false),
    });
  }

  toggleClockChoice(sessionId: number): void {
    this.clockChosen.update((chosen) => {
      const next = new Set(chosen);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  applyClockFix(): void {
    const ids = [...this.clockChosen()];
    if (!ids.length) return;

    this.clockFixing.set(true);

    this.lmsService.alignClocks(ids).subscribe({
      next: (moved) => {
        this.clockFixing.set(false);
        this.showClockDialog.set(false);
        this.loadSchedule();

        this.notify.showSuccess(
          moved.length === 1
            ? 'One class put back to its usual hour.'
            : `${moved.length} classes put back to their usual hour.`
        );
      },
      error: () => this.clockFixing.set(false),
    });
  }

  readonly showNotifyDialog = signal(false);
  readonly notifying = signal(false);
  readonly notifyOnlyChanged = signal(false);
  readonly notifyNote = signal('');

  openNotifyDialog(): void {
    // The note is cleared each time: it describes one particular change, and
    // last week's reason sent again would be worse than no reason at all.
    this.notifyNote.set('');
    this.notifyOnlyChanged.set(false);
    this.showNotifyDialog.set(true);
  }

  sendNotify(): void {
    this.notifying.set(true);

    this.lmsService
      .notifyInstructors({
        onlyChanged: this.notifyOnlyChanged(),
        note: this.notifyNote().trim() || null,
      })
      .subscribe({
        next: (result) => {
          this.notifying.set(false);
          this.showNotifyDialog.set(false);

          this.notify.showSuccess(
            result.notified === 0
              ? "Nobody's schedule has changed, so nothing was sent."
              : `Sent to ${result.notified} instructor${result.notified === 1 ? '' : 's'}` +
                  (result.skipped ? `. ${result.skipped} had no changes.` : '.')
          );
        },
        error: () => this.notifying.set(false),
      });
  }

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
  /**
   * A failed load, said as such. A failed instructor list used to read "No
   * instructors found -- add instructor accounts", and a failed week an empty one.
   */
  readonly instructorsFailed = signal(false);
  readonly scheduleFailed = signal(false);
  readonly loadFailed = computed(
    () => (this.viewsAllInstructors && this.instructorsFailed()) || this.scheduleFailed()
  );

  retryLoad(): void {
    if (this.viewsAllInstructors && this.instructorsFailed()) {
      this.loadInstructors();
    } else {
      this.loadSchedule();
    }
  }
  selectedSession = signal<ScheduleSession | null>(null);
  cancelledWarningDismissed = signal(false);

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

  /**
   * Everyone who could be filtered to, not only those already on screen.
   *
   * This was built from the loaded sessions alone, so an instructor appeared
   * in the filter only once they had a class inside the dates being viewed. A
   * newly added one was therefore missing from it — which reads as the account
   * not having been created — and a colleague whose next class is a fortnight
   * out could not be checked on at all.
   *
   * The roster comes first; names found only on sessions are kept alongside it
   * so somebody who has since changed role does not vanish from their own past
   * classes.
   */
  readonly uniqueInstructors = computed(() => {
    const set = new Set<string>();

    for (const i of this.instructors()) {
      // id 0 is the "All Instructors" entry the dropdown adds for itself.
      if (i.id !== 0 && i.name) set.add(i.name);
    }

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

  /**
   * Anyone who is not a student. The availability overlay — which hours an
   * instructor has declared, and which sessions fall outside them — is a
   * staffing question, and the endpoint behind it refuses students.
   */
  get isStaff(): boolean {
    return this.isAdmin || this.isInstructor || this.isSales;
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

    // Asking for it as a student is a request that can only be refused, and a
    // refusal reaches them as a red toast on a page they did nothing wrong on.
    if (this.isStaff) {
      this.loadAvailability();
    }

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
    this.currentWeekStart.set(startOfSchoolWeek(new Date()));

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    this.currentDate.set(now);
  }

  goToToday(): void {
    this.calculateWeekStart();
    this.loadSchedule();
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

    this.lmsService.getTimeOff(undefined, toIsoDate(from), toIsoDate(to)).subscribe({
      next: (off) => this.timeOff.set(off || []),
      error: () => this.timeOff.set([]),
    });
  }

  loadInstructors(): void {
    this.loading.set(true);
    this.instructorsFailed.set(false);
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
      error: () => {
        this.instructorsFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  loadSchedule(): void {
    const userId = this.selectedInstructorId();

    this.loading.set(true);
    this.scheduleFailed.set(false);
    const fromDate = new Date(this.currentWeekStart());
    const toDate = new Date(this.currentWeekStart());
    toDate.setDate(toDate.getDate() + 7);

    // Instants, not calendar dates, so toISOString is right here.
    let params = new HttpParams()
      .set('from', fromDate.toISOString())
      .set('to', toDate.toISOString());
    if (userId && userId !== 0) {
      params = params.set('instructorId', userId).set('userId', userId);
    }

    this.http
      .get<ScheduleSession[]>(`${this.lmsService.getApiUrl()}/schedule`, { params })
      .pipe(this.scheduleRequest.latest())
      .subscribe({
        next: (res) => {
          let sessions = res || [];
          if (userId && userId !== 0) {
            const filtered = sessions.filter((s) => {
              // By id. Matching names by substring put Alia's classes on Ali's week.
              return s.instructorId === userId;
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
        error: () => {
          this.scheduleFailed.set(true);
          this.loading.set(false);
        },
      });
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
    return startOfSchoolWeek(date);
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
