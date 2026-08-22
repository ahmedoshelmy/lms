import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { LmsService } from '../../core/services/lms.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role, parseRole } from '../../core/interfaces/Role';
import { User } from '../../core/interfaces/User';
import {
  AvailabilityRequest,
  AvailabilityWindowInput,
  InstructorAvailability,
  InstructorTimeOff,
  REQUEST_TYPE_LABELS,
  Room,
  WEEKDAYS,
  shortTime,
  toDayNumber,
} from '../../core/interfaces/Availability';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';

/** Half-hour marks from 08:00 to 21:00 — the range the schedule board covers. */
function buildTimeOptions(): string[] {
  const out: string[] = [];
  for (let minutes = 8 * 60; minutes <= 21 * 60; minutes += 30) {
    out.push(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    );
  }
  return out;
}

/**
 * Who works when, and the requests to change it.
 *
 * The same page serves three roles, because they are looking at one picture from
 * different sides: operations edits it, instructors ask to change their own part
 * of it, and sales reads it to find a slot and asks for an hour when there is
 * none.
 */
@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, DialogModule],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.scss',
})
export class AvailabilityComponent implements OnInit {
  private readonly lms = inject(LmsService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly weekdays = WEEKDAYS;
  readonly timeOptions = buildTimeOptions();
  readonly typeLabels = REQUEST_TYPE_LABELS;
  readonly shortTime = shortTime;

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));
  readonly isSales = computed(() => this.auth.hasRole(Role.Sales));
  readonly isInstructor = computed(() => this.auth.hasRole(Role.Instructor));

  readonly instructors = signal<User[]>([]);
  readonly rooms = signal<Room[]>([]);
  readonly availability = signal<InstructorAvailability[]>([]);
  readonly timeOff = signal<InstructorTimeOff[]>([]);
  readonly requests = signal<AvailabilityRequest[]>([]);
  /** What the instructor is actually booked for, laid over the declared week. */
  readonly sessions = signal<ScheduleSession[]>([]);

  readonly selectedInstructorId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** The week being edited, as a working copy until it is saved or sent. */
  readonly draft = signal<AvailabilityWindowInput[]>([]);
  readonly editing = signal(false);

  readonly showTimeOffDialog = signal(false);
  readonly showSlotDialog = signal(false);
  readonly showDecisionDialog = signal(false);

  // ── Request forms ────────────────────────────────────────────────────────
  readonly timeOffForm = signal({
    fromDate: '',
    toDate: '',
    reason: '',
    partial: false,
    startTime: '09:00',
    endTime: '13:00',
  });
  readonly slotForm = signal({
    instructorId: 0,
    dayOfWeek: 1,
    startTime: '16:00',
    endTime: '17:30',
    roomId: null as number | null,
    fromDate: '',
    reason: '',
  });
  readonly decision = signal<{
    request: AvailabilityRequest;
    approve: boolean;
    note: string;
  } | null>(null);

  readonly selectedInstructor = computed(() =>
    this.instructors().find((i) => i.id === this.selectedInstructorId())
  );

  /**
   * The selected instructor's week: the hours they have declared, and the
   * sessions actually booked into them. Seeing both is the point — a declared
   * window with nothing in it is what sales can sell, and a session outside
   * every window is a sign the declared hours are wrong.
   */
  readonly weekGrid = computed(() => {
    const windows = this.editing() ? this.draft() : this.currentWindows();
    const booked = this.bookedByDay();

    return this.weekdays.map((name, day) => {
      const dayWindows = windows
        .filter((w) => w.dayOfWeek === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const dayBooked = booked.get(day) ?? [];

      return {
        day,
        name,
        windows: dayWindows,
        booked: dayBooked,
        /** Booked outside every declared window — the hours nobody has recorded. */
        unaccounted: dayBooked.filter(
          (b) => !dayWindows.some((w) => b.start >= w.startTime && b.end <= w.endTime)
        ).length,
      };
    });
  });

  /**
   * The weekly slots this instructor teaches, from the sessions on the books.
   * Identical times are collapsed into one entry: the grid is a picture of a
   * typical week, not a list of dates.
   */
  readonly bookedByDay = computed(() => {
    const byDay = new Map<number, { start: string; end: string; label: string }[]>();

    for (const session of this.sessions()) {
      if (!session.startsAt) continue;
      if ((session.status ?? '').toLowerCase().includes('cancel')) continue;

      const startsAt = new Date(session.startsAt);
      const endsAt = session.endsAt ? new Date(session.endsAt) : startsAt;
      const day = startsAt.getDay();
      const start = this.clockOf(startsAt);
      const end = this.clockOf(endsAt);
      const label = session.groupName || session.topic || 'Session';

      // The same group recurs every week, so one entry per weekly slot rather
      // than one per occurrence.
      const slots = byDay.get(day) ?? [];
      if (!slots.some((s) => s.start === start && s.end === end && s.label === label)) {
        slots.push({ start, end, label });
      }
      byDay.set(day, slots);
    }

    for (const slots of byDay.values()) {
      slots.sort((a, b) => a.start.localeCompare(b.start));
    }
    return byDay;
  });

  /** Sessions this instructor teaches outside any hours they have declared. */
  readonly unaccountedTotal = computed(() =>
    this.weekGrid().reduce((total, day) => total + day.unaccounted, 0)
  );

  readonly currentWindows = computed<AvailabilityWindowInput[]>(() =>
    this.availability().map((a) => ({
      dayOfWeek: toDayNumber(a.dayOfWeek),
      startTime: shortTime(a.startTime),
      endTime: shortTime(a.endTime),
      roomId: a.roomId,
    }))
  );

  /** Hours a week, which is the number operations actually plans against. */
  readonly weeklyHours = computed(() => {
    const windows = this.editing() ? this.draft() : this.currentWindows();
    const minutes = windows.reduce(
      (total, w) => total + this.minutesBetween(w.startTime, w.endTime),
      0
    );
    return Math.round((minutes / 60) * 10) / 10;
  });

  readonly pendingRequests = computed(() => this.requests().filter((r) => r.status === 'Pending'));
  readonly decidedRequests = computed(() => this.requests().filter((r) => r.status !== 'Pending'));

  ngOnInit(): void {
    this.loadRooms();
    this.loadRequests();

    if (this.isAdmin() || this.isSales()) {
      this.loadInstructors();
    } else {
      const me = this.auth.getUserId();
      if (me) {
        this.selectedInstructorId.set(me);
        this.loadForInstructor(me);
      }
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  private loadInstructors(): void {
    this.lms.getScheduleInstructors().subscribe({
      next: (users) => {
        const list = (users || []).filter((u) => parseRole(u.role) === Role.Instructor);
        this.instructors.set(list);
        if (list.length) {
          this.selectedInstructorId.set(list[0].id);
          this.loadForInstructor(list[0].id);
        }
      },
      error: () => this.notify.showError('Could not load the instructor list.'),
    });
  }

  private loadRooms(): void {
    this.lms.getRooms().subscribe({
      next: (rooms) => this.rooms.set(rooms || []),
      error: () => this.notify.showError('Could not load rooms.'),
    });
  }

  loadForInstructor(instructorId: number): void {
    this.loading.set(true);
    this.editing.set(false);

    this.lms.getInstructorAvailability(instructorId).subscribe({
      next: (windows) => {
        this.availability.set(windows || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.lms.getTimeOff(instructorId).subscribe({
      next: (off) => this.timeOff.set(off || []),
      error: () => this.timeOff.set([]),
    });

    this.loadSessions(instructorId);
  }

  /**
   * Four weeks of the instructor's sessions. Long enough to catch a fortnightly
   * group, short enough that a long-finished course does not show as a booking.
   */
  private loadSessions(instructorId: number): void {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 28);

    this.lms.getSchedule(from, to).subscribe({
      next: (sessions) =>
        this.sessions.set((sessions || []).filter((s) => s.instructorId === instructorId)),
      error: () => this.sessions.set([]),
    });
  }

  private loadRequests(): void {
    this.lms.getAvailabilityRequests().subscribe({
      next: (requests) => this.requests.set(requests || []),
      error: () => this.requests.set([]),
    });
  }

  onInstructorChange(id: number): void {
    this.selectedInstructorId.set(id);
    this.loadForInstructor(id);
  }

  // ── Editing the week ─────────────────────────────────────────────────────

  startEditing(): void {
    this.draft.set(this.currentWindows().map((w) => ({ ...w })));
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editing.set(false);
    this.draft.set([]);
  }

  addWindow(day: number): void {
    this.draft.update((windows) => [
      ...windows,
      { dayOfWeek: day, startTime: '16:00', endTime: '18:00', roomId: null },
    ]);
  }

  removeWindow(day: number, index: number): void {
    this.draft.update((windows) => {
      const onDay = windows.filter((w) => w.dayOfWeek === day);
      const target = onDay.sort((a, b) => a.startTime.localeCompare(b.startTime))[index];
      return windows.filter((w) => w !== target);
    });
  }

  updateWindow(
    day: number,
    index: number,
    field: 'startTime' | 'endTime' | 'roomId',
    value: string | number | null
  ): void {
    this.draft.update((windows) => {
      const onDay = windows
        .filter((w) => w.dayOfWeek === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const target = onDay[index];
      if (!target) return windows;
      return windows.map((w) =>
        w === target
          ? { ...w, [field]: field === 'roomId' ? (value === null ? null : Number(value)) : value }
          : w
      );
    });
  }

  /**
   * The same checks the API makes, run before sending so the problem is pointed
   * at rather than described.
   */
  readonly draftError = computed<string | null>(() => {
    const windows = this.draft();
    for (const w of windows) {
      if (w.endTime <= w.startTime) {
        return `${this.weekdays[w.dayOfWeek]} ${w.startTime}–${w.endTime} ends before it starts.`;
      }
    }
    for (let day = 0; day < 7; day++) {
      const onDay = windows
        .filter((w) => w.dayOfWeek === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < onDay.length; i++) {
        if (onDay[i].startTime < onDay[i - 1].endTime) {
          return `Two ${this.weekdays[day]} windows overlap.`;
        }
      }
    }
    return null;
  });

  /** Admin writes the week outright; an instructor sends the same draft as a request. */
  saveWeek(): void {
    const instructorId = this.selectedInstructorId();
    if (!instructorId || this.draftError()) return;

    this.saving.set(true);
    this.lms.replaceWeeklyAvailability(instructorId, this.draft()).subscribe({
      next: (windows) => {
        this.availability.set(windows || []);
        this.editing.set(false);
        this.saving.set(false);
        this.notify.showSuccess('Weekly hours updated.');
      },
      error: () => this.saving.set(false),
    });
  }

  proposeWeek(): void {
    const instructorId = this.selectedInstructorId();
    if (!instructorId || this.draftError()) return;

    const reason = (prompt('Why are you asking to change your hours?') ?? '').trim();
    if (reason.length < 3) return;

    this.saving.set(true);
    this.lms.requestAvailabilityChange({ windows: this.draft(), reason }).subscribe({
      next: () => {
        this.editing.set(false);
        this.saving.set(false);
        this.loadRequests();
        this.notify.showSuccess('Sent for approval.');
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Requests ─────────────────────────────────────────────────────────────

  openTimeOffDialog(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.timeOffForm.set({
      fromDate: today,
      toDate: today,
      reason: '',
      partial: false,
      startTime: '09:00',
      endTime: '13:00',
    });
    this.showTimeOffDialog.set(true);
  }

  submitTimeOff(): void {
    const form = this.timeOffForm();
    if (!form.fromDate || !form.toDate || form.reason.trim().length < 3) return;

    this.saving.set(true);
    this.lms
      .requestTimeOff(
        {
          fromDate: form.fromDate,
          toDate: form.toDate,
          startTime: form.partial ? form.startTime : null,
          endTime: form.partial ? form.endTime : null,
          reason: form.reason.trim(),
        },
        this.isAdmin() ? (this.selectedInstructorId() ?? undefined) : undefined
      )
      .subscribe({
        next: () => {
          this.showTimeOffDialog.set(false);
          this.saving.set(false);
          this.loadRequests();
          this.notify.showSuccess('Time off requested.');
        },
        error: () => this.saving.set(false),
      });
  }

  openSlotDialog(): void {
    this.slotForm.set({
      instructorId: this.selectedInstructorId() ?? this.instructors()[0]?.id ?? 0,
      dayOfWeek: 1,
      startTime: '16:00',
      endTime: '17:30',
      roomId: null,
      fromDate: new Date().toISOString().slice(0, 10),
      reason: '',
    });
    this.showSlotDialog.set(true);
  }

  submitSlotException(): void {
    const form = this.slotForm();
    if (!form.instructorId || form.reason.trim().length < 3) return;
    if (form.endTime <= form.startTime) {
      this.notify.showError('The slot ends before it starts.');
      return;
    }

    this.saving.set(true);
    this.lms
      .requestSlotException({
        instructorId: form.instructorId,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        roomId: form.roomId,
        fromDate: form.fromDate || null,
        reason: form.reason.trim(),
      })
      .subscribe({
        next: () => {
          this.showSlotDialog.set(false);
          this.saving.set(false);
          this.loadRequests();
          this.notify.showSuccess('Slot requested. Operations will decide.');
        },
        error: () => this.saving.set(false),
      });
  }

  openDecision(request: AvailabilityRequest, approve: boolean): void {
    this.decision.set({ request, approve, note: '' });
    this.showDecisionDialog.set(true);
  }

  submitDecision(): void {
    const pending = this.decision();
    if (!pending) return;

    this.saving.set(true);
    const call = pending.approve
      ? this.lms.approveAvailabilityRequest(pending.request.id, pending.note)
      : this.lms.rejectAvailabilityRequest(pending.request.id, pending.note);

    call.subscribe({
      next: () => {
        this.showDecisionDialog.set(false);
        this.saving.set(false);
        this.loadRequests();
        // An approval may have rewritten the week being looked at.
        const instructorId = this.selectedInstructorId();
        if (pending.approve && instructorId) {
          this.loadForInstructor(instructorId);
        }
        this.notify.showSuccess(pending.approve ? 'Approved.' : 'Rejected.');
      },
      error: () => this.saving.set(false),
    });
  }

  withdraw(request: AvailabilityRequest): void {
    this.lms.withdrawAvailabilityRequest(request.id).subscribe({
      next: () => {
        this.loadRequests();
        this.notify.showSuccess('Request withdrawn.');
      },
    });
  }

  canWithdraw(request: AvailabilityRequest): boolean {
    return request.status === 'Pending' && request.requestedById === this.auth.getUserId();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Local "HH:mm" for a session, which is how the grid reads times. */
  private clockOf(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  /** Adopts the hours this instructor is already teaching as their declared week. */
  adoptBookedHours(): void {
    const windows: AvailabilityWindowInput[] = [];
    for (const [day, slots] of this.bookedByDay()) {
      if (!slots.length) continue;
      // One window spanning the day's teaching, rather than a window per group:
      // the gaps between sessions are exactly what sales wants to sell.
      windows.push({
        dayOfWeek: day,
        startTime: slots.reduce((min, s) => (s.start < min ? s.start : min), slots[0].start),
        endTime: slots.reduce((max, s) => (s.end > max ? s.end : max), slots[0].end),
        roomId: null,
      });
    }

    if (!windows.length) {
      this.notify.showError('This instructor has no sessions in the next four weeks.');
      return;
    }

    this.draft.set(windows.sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    this.editing.set(true);
  }

  private minutesBetween(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }

  roomName(roomId: number | null | undefined): string {
    if (!roomId) return 'Any room';
    return this.rooms().find((r) => r.id === roomId)?.name ?? 'Any room';
  }

  /** "Mon 16:00–17:30", the shape a request reads best in. */
  describeWindow(w: { dayOfWeek: number | string; startTime: string; endTime: string }): string {
    const day = this.weekdays[toDayNumber(w.dayOfWeek)].slice(0, 3);
    return `${day} ${shortTime(w.startTime)}–${shortTime(w.endTime)}`;
  }
}
