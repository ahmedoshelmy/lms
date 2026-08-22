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
import { Topic } from '../../core/interfaces/Topic';
import { CourseLevel } from '../../core/interfaces/CourseLevel';
import { Room, WEEKDAYS, shortTime, toDayNumber } from '../../core/interfaces/Availability';
import {
  AvailableSlot,
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  Candidate,
  CandidateStatus,
  SlotHold,
} from '../../core/interfaces/Sales';

type Tab = 'find' | 'holds' | 'pipeline';

/**
 * Where sales works: find a free hour, hold it while it is being sold, put the
 * people you are talking to against it, and hand it to operations when it is
 * full.
 *
 * Operations sees the same page, because converting a filled hold into a
 * running group is their decision, not sales'.
 */
@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, DialogModule],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss',
})
export class SalesComponent implements OnInit {
  private readonly lms = inject(LmsService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly weekdays = WEEKDAYS;
  readonly shortTime = shortTime;
  readonly toDayNumber = toDayNumber;
  readonly candidateStatuses = CANDIDATE_STATUSES;
  readonly statusLabels = CANDIDATE_STATUS_LABELS;

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  readonly tab = signal<Tab>('find');

  readonly instructors = signal<User[]>([]);
  readonly rooms = signal<Room[]>([]);
  readonly topics = signal<Topic[]>([]);
  readonly levels = signal<CourseLevel[]>([]);

  readonly slots = signal<AvailableSlot[]>([]);
  readonly holds = signal<SlotHold[]>([]);
  readonly candidates = signal<Candidate[]>([]);

  readonly searching = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searched = signal(false);

  // ── Search ───────────────────────────────────────────────────────────────
  readonly search = signal({
    topicId: 0,
    courseLevelId: 0,
    fromDate: new Date().toISOString().slice(0, 10),
    instructorId: 0,
    dayOfWeek: -1,
    roomId: 0,
    perfectOnly: true,
    allStartTimes: false,
  });

  // ── Dialogs ──────────────────────────────────────────────────────────────
  readonly holdSlot = signal<AvailableSlot | null>(null);
  readonly showHoldDialog = signal(false);
  readonly holdForm = signal({ totalSessions: 12, holdForDays: 14, notes: '' });

  readonly showCandidateDialog = signal(false);
  readonly editingCandidate = signal<Candidate | null>(null);
  readonly candidateForm = signal({
    name: '',
    parentName: '',
    phone: '',
    email: '',
    source: '',
    notes: '',
    slotHoldId: null as number | null,
    status: 'New' as CandidateStatus,
  });

  readonly trialFor = signal<{ hold: SlotHold; candidate: Candidate } | null>(null);
  readonly showTrialDialog = signal(false);
  readonly trialDate = signal('');

  readonly convertingHold = signal<SlotHold | null>(null);
  readonly showConvertDialog = signal(false);
  readonly convertForm = signal({ groupName: '', courseLevelId: 0, note: '' });

  // ── Derived ──────────────────────────────────────────────────────────────

  /** Levels of the topic being searched for, since a hold is for one course. */
  readonly topicLevels = computed(() => {
    const topicId = this.search().topicId;
    return this.levels().filter((l) => !topicId || l.topicId === topicId);
  });

  readonly liveHolds = computed(() => this.holds().filter((h) => h.status === 'Held'));
  readonly closedHolds = computed(() => this.holds().filter((h) => h.status !== 'Held'));

  /** Live holds with somebody committed — what operations should be converting. */
  readonly readyToConvert = computed(() => this.liveHolds().filter((h) => h.committedCount > 0));

  /** Holds lapsing within the week, which is when sales needs to act. */
  readonly expiringSoon = computed(() => this.liveHolds().filter((h) => h.daysUntilExpiry <= 3));

  /** The pipeline as columns, so the board reads left to right. */
  readonly pipeline = computed(() =>
    this.candidateStatuses.map((status) => ({
      status,
      label: this.statusLabels[status],
      candidates: this.candidates().filter((c) => c.status === status),
    }))
  );

  readonly unattached = computed(() => this.candidates().filter((c) => !c.slotHoldId));

  ngOnInit(): void {
    this.loadReference();
    this.loadHolds();
    this.loadCandidates();
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  private loadReference(): void {
    this.lms.getScheduleInstructors().subscribe({
      next: (users) =>
        this.instructors.set((users || []).filter((u) => parseRole(u.role) === Role.Instructor)),
      error: () => this.instructors.set([]),
    });
    this.lms.getRooms().subscribe({
      next: (rooms) => this.rooms.set(rooms || []),
      error: () => this.rooms.set([]),
    });
    this.lms.getTopics().subscribe({
      next: (topics) => this.topics.set(topics || []),
      error: () => this.topics.set([]),
    });
    this.lms.getCourseLevels().subscribe({
      next: (levels) => this.levels.set(levels || []),
      error: () => this.levels.set([]),
    });
  }

  loadHolds(): void {
    this.loading.set(true);
    this.lms.getSlotHolds().subscribe({
      next: (holds) => {
        this.holds.set(holds || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadCandidates(): void {
    this.lms.getCandidates().subscribe({
      next: (candidates) => this.candidates.set(candidates || []),
      error: () => this.candidates.set([]),
    });
  }

  // ── Finding a slot ───────────────────────────────────────────────────────

  runSearch(): void {
    const form = this.search();
    const level = this.levels().find((l) => l.id === form.courseLevelId);

    this.searching.set(true);
    this.searched.set(true);
    this.lms
      .findAvailableSlots({
        fromDate: form.fromDate,
        // Look ahead as far as the course runs, so a slot free for eight weeks
        // is not offered for a twelve week course.
        weeks: level?.sessionCount || 12,
        instructorId: form.instructorId || undefined,
        dayOfWeek: form.dayOfWeek >= 0 ? form.dayOfWeek : undefined,
        roomId: form.roomId || undefined,
        maxBlockedWeeks: form.perfectOnly ? 0 : undefined,
        allStartTimes: form.allStartTimes,
      })
      .subscribe({
        next: (slots) => {
          this.slots.set(slots || []);
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
  }

  clearSearch(): void {
    this.slots.set([]);
    this.searched.set(false);
  }

  // ── Holding ──────────────────────────────────────────────────────────────

  openHoldDialog(slot: AvailableSlot): void {
    const level = this.levels().find((l) => l.id === this.search().courseLevelId);
    this.holdSlot.set(slot);
    this.holdForm.set({
      totalSessions: level?.sessionCount || 12,
      holdForDays: 14,
      notes: '',
    });
    this.showHoldDialog.set(true);
  }

  submitHold(): void {
    const slot = this.holdSlot();
    const form = this.holdForm();
    const search = this.search();
    if (!slot) return;

    if (!search.topicId) {
      this.notify.showError('Choose which course this is for before holding a slot.');
      return;
    }

    this.saving.set(true);
    this.lms
      .createSlotHold({
        instructorId: slot.instructorId,
        topicId: search.topicId,
        courseLevelId: search.courseLevelId || null,
        roomId: slot.roomId,
        proposedStartDate: slot.firstDate,
        totalSessions: form.totalSessions,
        schedules: [
          {
            dayOfWeek: toDayNumber(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        ],
        holdForDays: form.holdForDays,
        notes: form.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.showHoldDialog.set(false);
          this.saving.set(false);
          this.loadHolds();
          // The hour is gone now, so the list it came from is out of date.
          this.runSearch();
          this.tab.set('holds');
          this.notify.showSuccess('Slot held. It is off the market until you release it.');
        },
        error: () => this.saving.set(false),
      });
  }

  extendHold(hold: SlotHold): void {
    this.lms.extendSlotHold(hold.id, 14).subscribe({
      next: () => {
        this.loadHolds();
        this.notify.showSuccess('Held for another fortnight.');
      },
    });
  }

  releaseHold(hold: SlotHold): void {
    const reason = (prompt('Why are you releasing this slot?') ?? '').trim();
    this.lms.releaseSlotHold(hold.id, reason || undefined).subscribe({
      next: () => {
        this.loadHolds();
        this.loadCandidates();
        this.notify.showSuccess('Slot released. Anyone on it is back in the pipeline.');
      },
    });
  }

  // ── Trials ───────────────────────────────────────────────────────────────

  openTrialDialog(hold: SlotHold, candidate: Candidate): void {
    this.trialFor.set({ hold, candidate });
    this.trialDate.set(this.nextSlotDate(hold));
    this.showTrialDialog.set(true);
  }

  /**
   * The next date the hold's pattern falls on. A trial has to sit in the hour
   * being sold, so the date is picked from the pattern rather than free-typed.
   */
  private nextSlotDate(hold: SlotHold): string {
    const days = hold.schedules.map((s) => toDayNumber(s.dayOfWeek));
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 28; i++) {
      date.setDate(date.getDate() + 1);
      if (days.includes(date.getDay())) {
        return date.toISOString().slice(0, 10);
      }
    }
    return hold.proposedStartDate;
  }

  /** The dates in the next month this hold actually runs on. */
  readonly trialDates = computed(() => {
    const pending = this.trialFor();
    if (!pending) return [];

    const days = pending.hold.schedules.map((s) => toDayNumber(s.dayOfWeek));
    const out: string[] = [];
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 42; i++) {
      date.setDate(date.getDate() + 1);
      if (days.includes(date.getDay())) {
        out.push(date.toISOString().slice(0, 10));
      }
    }
    return out;
  });

  submitTrial(): void {
    const pending = this.trialFor();
    const date = this.trialDate();
    if (!pending || !date) return;

    this.saving.set(true);
    this.lms.bookTrial(pending.hold.id, pending.candidate.id, date).subscribe({
      next: (trial) => {
        this.showTrialDialog.set(false);
        this.saving.set(false);
        this.loadHolds();
        this.loadCandidates();
        this.notify.showSuccess(
          `Trial booked for ${trial.candidateName} with ${trial.instructorName}.`
        );
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Converting ───────────────────────────────────────────────────────────

  openConvertDialog(hold: SlotHold): void {
    this.convertingHold.set(hold);
    this.convertForm.set({
      groupName: '',
      courseLevelId: hold.courseLevelId ?? 0,
      note: '',
    });
    this.showConvertDialog.set(true);
  }

  submitConvert(): void {
    const hold = this.convertingHold();
    const form = this.convertForm();
    if (!hold) return;

    if (!hold.courseLevelId && !form.courseLevelId) {
      this.notify.showError('Choose a level — this slot was held before one was settled.');
      return;
    }

    this.saving.set(true);
    this.lms
      .convertSlotHold(hold.id, {
        groupName: form.groupName.trim() || null,
        courseLevelId: form.courseLevelId || null,
        note: form.note.trim() || null,
      })
      .subscribe({
        next: () => {
          this.showConvertDialog.set(false);
          this.saving.set(false);
          this.loadHolds();
          this.loadCandidates();
          this.notify.showSuccess('Group created. Everyone who committed is now a student.');
        },
        error: () => this.saving.set(false),
      });
  }

  // ── Candidates ───────────────────────────────────────────────────────────

  openCandidateDialog(candidate?: Candidate, holdId?: number): void {
    this.editingCandidate.set(candidate ?? null);
    this.candidateForm.set({
      name: candidate?.name ?? '',
      parentName: candidate?.parentName ?? '',
      phone: candidate?.phone ?? '',
      email: candidate?.email ?? '',
      source: candidate?.source ?? '',
      notes: candidate?.notes ?? '',
      slotHoldId: candidate?.slotHoldId ?? holdId ?? null,
      status: candidate?.status ?? 'New',
    });
    this.showCandidateDialog.set(true);
  }

  submitCandidate(): void {
    const form = this.candidateForm();
    if (form.name.trim().length < 2) return;

    const payload = {
      name: form.name.trim(),
      parentName: form.parentName.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      slotHoldId: form.slotHoldId,
      status: form.status,
    };

    const existing = this.editingCandidate();
    const call = existing
      ? this.lms.updateCandidate(existing.id, payload)
      : this.lms.createCandidate(payload);

    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.showCandidateDialog.set(false);
        this.saving.set(false);
        this.loadCandidates();
        this.loadHolds();
        this.notify.showSuccess(existing ? 'Candidate updated.' : 'Candidate added.');
      },
      error: () => this.saving.set(false),
    });
  }

  /** Moving someone along the pipeline is the commonest action, so it is one click. */
  setStatus(candidate: Candidate, status: CandidateStatus): void {
    this.lms
      .updateCandidate(candidate.id, {
        name: candidate.name,
        parentName: candidate.parentName,
        phone: candidate.phone,
        email: candidate.email,
        source: candidate.source,
        notes: candidate.notes,
        slotHoldId: candidate.slotHoldId,
        status,
      })
      .subscribe({
        next: () => {
          this.loadCandidates();
          this.loadHolds();
        },
      });
  }

  removeCandidate(candidate: Candidate): void {
    this.lms.deleteCandidate(candidate.id).subscribe({
      next: () => {
        this.loadCandidates();
        this.loadHolds();
        this.notify.showSuccess('Candidate removed.');
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  describeSlot(slot: AvailableSlot | SlotHold['schedules'][number]): string {
    const day = this.weekdays[toDayNumber(slot.dayOfWeek)];
    return `${day} ${shortTime(slot.startTime)}–${shortTime(slot.endTime)}`;
  }

  holdName(holdId: number | null): string {
    if (!holdId) return 'Not on a slot yet';
    const hold = this.holds().find((h) => h.id === holdId);
    if (!hold) return `Hold ${holdId}`;
    const when = hold.schedules[0] ? this.describeSlot(hold.schedules[0]) : '';
    return `${hold.courseLevelTitle ?? hold.topicName} · ${when}`;
  }

  /** Sessions this slot is free for, phrased as the reassurance sales needs. */
  coverage(slot: AvailableSlot): string {
    return slot.weeksFree === slot.weeksChecked
      ? `Free all ${slot.weeksChecked} weeks`
      : `${slot.weeksFree} of ${slot.weeksChecked} weeks`;
  }

  isPerfect(slot: AvailableSlot): boolean {
    return slot.weeksFree === slot.weeksChecked;
  }
}
