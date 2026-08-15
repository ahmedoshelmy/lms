import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { catchError, of } from 'rxjs';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role, parseRole } from '../../../core/interfaces/Role';
import { User } from '../../../core/interfaces/User';
import { ScheduleSession, SessionAttendanceItem, UpdateSessionPayload } from '../../../core/interfaces/ScheduleSession';
import { getSessionCode, getSessionDisplayTopic } from '../../../core/utils/session-code.utils';
import { CancelSessionPayload } from '../../../core/interfaces/History';
import { AttendanceStatus } from '../../../core/enums/AttendanceStatus';
import { SessionStatus } from '../../../core/enums/SessionStatus';

export type StudentStatus = 'Pending' | 'Present' | 'Late' | 'Excused' | 'Absent';

export interface StudentAttendanceRecord {
  studentId: number;
  studentName: string;
  studentEmail: string;
  status: StudentStatus;
  recordId?: number;
  isSaved?: boolean;
}

function statusToApiEnum(status: StudentStatus): AttendanceStatus {
  switch (status) {
    case 'Present':
      return AttendanceStatus.Present;
    case 'Absent':
      return AttendanceStatus.Absent;
    case 'Late':
      return AttendanceStatus.Late;
    case 'Excused':
      return AttendanceStatus.Excused;
    default:
      return AttendanceStatus.Present;
  }
}

function sessionStatusToApiEnum(statusStr: string): number {
  const norm = (statusStr || '').toLowerCase();
  if (norm.includes('cancel')) return SessionStatus.Cancelled;
  if (norm.includes('completed')) return SessionStatus.Completed;
  return SessionStatus.Scheduled;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isSameWeek(d1: Date, d2: Date): boolean {
  return getMonday(d1).getTime() === getMonday(d2).getTime();
}

function normalizeAttendanceStatus(raw: any): StudentStatus {
  if (raw === undefined || raw === null) return 'Pending';
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'present' || s === '1') return 'Present';
    if (s === 'absent' || s === '2') return 'Absent';
    if (s === 'late' || s === '3') return 'Late';
    if (s === 'excused' || s === '4') return 'Excused';
    if (s === 'pending') return 'Pending';
  }
  if (raw === 1) return 'Present';
  if (raw === 2) return 'Absent';
  if (raw === 3) return 'Late';
  if (raw === 4) return 'Excused';
  return 'Pending';
}

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SelectModule, ButtonModule, DialogModule],
  templateUrl: './session-detail.component.html',
  styleUrl: './session-detail.component.scss',
})
export class SessionDetailComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  session = signal<ScheduleSession | null>(null);
  records = signal<StudentAttendanceRecord[]>([]);
  loading = signal(true);
  saving = signal(false);

  getSessionCode(s: any): string {
    return getSessionCode(s);
  }

  getSessionDisplayTopic(s: any): string {
    return getSessionDisplayTopic(s);
  }
  isDirty = signal(false);
  searchQuery = signal('');
  rosterStatusFilter = signal<'all' | StudentStatus>('all');

  // Edit state
  isEditing = signal(false);
  instructors = signal<User[]>([]);
  editInstructorId = signal<number>(0);
  editStatus = signal<string>('');
  editStartTime = signal<string>('');
  editEndTime = signal<string>('');
  editDate = signal<string>('');
  shiftUpcomingSchedule = signal<boolean>(true);
  showFutureWeekConfirmModal = signal(false);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Instructor) || this.auth.hasRole(Role.Admin));
  readonly isInstructor = computed(() => this.auth.hasRole(Role.Instructor));
  readonly canEdit = computed(() => this.auth.hasRole(Role.Admin));

  readonly isEditCancelled = computed(() => (this.editStatus() ?? '').toLowerCase().includes('cancel'));

  readonly isCancelled = computed(() => {
    const s = this.session();
    return s ? (s.status ?? '').toLowerCase().includes('cancel') : false;
  });

  readonly isUpcoming = computed(() => {
    const s = this.session();
    if (!s) return false;
    const start = new Date(s.startsAt);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return start.getTime() > todayEnd.getTime();
  });

  readonly isLocked = computed(() => {
    const s = this.session();
    if (!s) return false;
    const elapsed = Date.now() - new Date(s.startsAt).getTime();
    return elapsed > 24 * 60 * 60 * 1000;
  });

  readonly isAttendanceDisabled = computed(() => {
    return this.isUpcoming() || this.isCancelled() || this.isLocked();
  });

  readonly presentCount = computed(() => this.countByStatus('Present'));
  readonly absentCount = computed(() => this.countByStatus('Absent'));
  readonly lateCount = computed(() => this.countByStatus('Late'));
  readonly excusedCount = computed(() => this.countByStatus('Excused'));
  readonly pendingCount = computed(() => this.countByStatus('Pending'));
  readonly totalCount = computed(() => this.records().length);

  readonly presentRate = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.presentCount() / total) * 100);
  });

  readonly filteredRecords = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const filter = this.rosterStatusFilter();
    return this.records().filter((r) => {
      const matchesSearch = !q || r.studentName.toLowerCase().includes(q) || r.studentEmail.toLowerCase().includes(q);
      const matchesStatus = filter === 'all' || r.status === filter;
      return matchesSearch && matchesStatus;
    });
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/schedule']);
      return;
    }
    if (this.canEdit() && this.instructors().length === 0) {
      this.loadInstructors();
    }
    this.loadSession(id);
  }

  private loadSession(id: number): void {
    this.loading.set(true);
    this.lms
      .getSessionDetails(id)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (detail) => {
          if (detail) {
            this.session.set(detail);
            this.buildRecords(detail);
          } else {
            this.notify.showError('Session not found');
            this.router.navigate(['/schedule']);
          }
          this.loading.set(false);
        },
        error: () => {
          this.notify.showError('Failed to load session');
          this.router.navigate(['/schedule']);
          this.loading.set(false);
        },
      });
  }

  private buildRecords(session: ScheduleSession): void {
    const atts: SessionAttendanceItem[] = session.attendances || [];
    const recs: StudentAttendanceRecord[] = atts.map((a) => ({
      studentId: a.studentId,
      studentName: a.studentName || `Student #${a.studentId}`,
      studentEmail: a.studentEmail || '',
      status: normalizeAttendanceStatus(a.status),
      recordId: a.id,
      isSaved: true,
    }));

    if (isPlatformBrowser(this.platformId)) {
      const storedJson = localStorage.getItem(`lms_attendance_${session.id}`);
      if (storedJson) {
        const storedMap: Record<string, { status: string; recordId?: number }> = JSON.parse(storedJson);
        const apiIds = new Set(recs.map((r) => r.studentId));
        Object.entries(storedMap).forEach(([stIdStr, data]) => {
          if (!apiIds.has(Number(stIdStr))) {
            recs.push({
              studentId: Number(stIdStr),
              studentName: `Student #${stIdStr}`,
              studentEmail: '',
              status: normalizeAttendanceStatus(data.status),
              recordId: data.recordId,
              isSaved: false,
            });
          }
        });
      }
    }

    this.records.set(recs);
    this.isDirty.set(false);
  }

  countByStatus(status: StudentStatus): number {
    return this.records().filter((r) => r.status === status).length;
  }

  setStatus(record: StudentAttendanceRecord, status: StudentStatus): void {
    if (this.isAttendanceDisabled()) return;
    if (record.status === status) return;
    this.records.update((list) =>
      list.map((r) => (r.studentId === record.studentId ? { ...r, status } : r))
    );
    this.isDirty.set(true);
  }

  bulkSetStatus(status: StudentStatus): void {
    if (this.isAttendanceDisabled()) return;
    this.records.update((list) => list.map((r) => ({ ...r, status })));
    this.isDirty.set(true);
  }

  resetChanges(): void {
    const s = this.session();
    if (s) this.buildRecords(s);
  }

  saveAttendance(): void {
    if (this.isAttendanceDisabled()) return;
    const s = this.session();
    if (!s) return;

    this.saving.set(true);
    const recs = this.records();

    const cacheMap: Record<string, { status: string; recordId?: number }> = {};
    recs.forEach((r) => {
      cacheMap[r.studentId] = { status: r.status, recordId: r.recordId };
    });

    const bulkPayload = recs.map((r) => ({
      studentId: r.studentId,
      status: statusToApiEnum(r.status),
    }));

    this.lms.saveBulkAttendance(s.id, bulkPayload).subscribe({
      next: () => this.finishSave(cacheMap, false),
      error: () => {
        let completed = 0;
        let hasError = false;
        recs.forEach((r) => {
          const numericStatus = statusToApiEnum(r.status);
          if (r.recordId) {
            this.lms.updateAttendance(r.recordId, { status: numericStatus }).subscribe({
              next: () => {
                completed++;
                if (completed === recs.length) this.finishSave(cacheMap, hasError);
              },
              error: () => {
                hasError = true;
                completed++;
                if (completed === recs.length) this.finishSave(cacheMap, hasError);
              },
            });
          } else {
            this.lms
              .createAttendance({ sessionId: s.id, studentId: r.studentId, status: numericStatus })
              .subscribe({
                next: (res: any) => {
                  if (res && res.id) r.recordId = res.id;
                  completed++;
                  if (completed === recs.length) this.finishSave(cacheMap, hasError);
                },
                error: () => {
                  hasError = true;
                  completed++;
                  if (completed === recs.length) this.finishSave(cacheMap, hasError);
                },
              });
          }
        });
        if (recs.length === 0) this.finishSave(cacheMap, true);
      },
    });
  }

  private finishSave(cacheMap: Record<string, { status: string; recordId?: number }>, hasError: boolean): void {
    const s = this.session();
    if (s && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(`lms_attendance_${s.id}`, JSON.stringify(cacheMap));
    }
    this.saving.set(false);
    this.isDirty.set(false);
    if (hasError) {
      this.notify.showSuccess('Attendance saved locally (server sync pending)');
    } else {
      this.notify.showSuccess('Attendance saved successfully!');
    }
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatDateTime(iso: string): string {
    return `${this.formatDate(iso)} at ${this.formatTime(iso)}`;
  }

  getStatusBadgeClass(status: string): string {
    const norm = (status ?? '').toLowerCase();
    if (norm.includes('completed')) return 'badge--completed';
    if (norm.includes('cancel')) return 'badge--cancelled';
    return 'badge--scheduled';
  }

  getRecordStatusClass(status: StudentStatus): string {
    switch (status) {
      case 'Present':
        return 'record-status--present';
      case 'Absent':
        return 'record-status--absent';
      case 'Late':
        return 'record-status--late';
      case 'Excused':
        return 'record-status--excused';
      default:
        return 'record-status--pending';
    }
  }

  initials(name: string): string {
    return (name || '')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // ── Edit Session CRUD ──────────────────────────────────────────────

  startEditing(): void {
    const s = this.session();
    if (!s) return;

    this.editInstructorId.set(s.instructorId ?? 0);
    this.editStatus.set(s.status ?? 'Scheduled');

    if (s.startsAt) {
      const d = new Date(s.startsAt);
      this.editDate.set(d.toISOString().split('T')[0]);
      this.editStartTime.set(
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      );
    }
    if (s.endsAt) {
      const d = new Date(s.endsAt);
      this.editEndTime.set(
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      );
    } else if (s.startsAt) {
      const endMs = new Date(s.startsAt).getTime() + (s.durationMinutes || 60) * 60 * 1000;
      const d = new Date(endMs);
      this.editEndTime.set(
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      );
    }

    if (this.canEdit() && this.instructors().length === 0) {
      this.loadInstructors();
    }

    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
  }

  private loadInstructors(): void {
    this.lms.getInstructors().subscribe({
      next: (users) => {
        this.instructors.set(
          (users || []).filter(
            (u) => parseRole(u.role) === Role.Instructor || (u.role as any) === 'Instructor'
          )
        );
      },
      error: () => {},
    });
  }

  toggleEditCancelStatus(): void {
    const originalStatus = this.session()?.status ?? 'Scheduled';
    if (this.isEditCancelled()) {
      this.editStatus.set(
        originalStatus.toLowerCase().includes('cancel') ? 'Scheduled' : originalStatus
      );
    } else {
      this.editStatus.set('Cancelled');
    }
  }

  saveSessionChanges(): void {
    const s = this.session();
    if (!s) return;

    if (this.editDate() && s.startsAt) {
      const originalDate = new Date(s.startsAt);
      const newDate = new Date(this.editDate());

      if (!isSameWeek(originalDate, newDate) && newDate > originalDate) {
        this.showFutureWeekConfirmModal.set(true);
        return;
      }
    }

    this.executeSessionSave();
  }

  confirmFutureWeekShift(): void {
    this.showFutureWeekConfirmModal.set(false);
    this.cancelSessionWithShift();
  }

  applyForwardToRemaining = signal<boolean>(false);
  updateWeeklySchedule = signal<boolean>(false);

  private executeSessionSave(): void {
    const s = this.session();
    if (!s) return;
    this.saving.set(true);

    let computedStartsAt = s.startsAt;
    let computedEndsAt = s.endsAt;
    let computedDurationMinutes = s.durationMinutes;

    if (this.editDate() && this.editStartTime()) {
      const [sHours, sMins] = this.editStartTime().split(':').map(Number);
      const startDateObj = new Date(this.editDate());
      startDateObj.setHours(sHours || 0, sMins || 0, 0, 0);
      computedStartsAt = startDateObj.toISOString();

      if (this.editEndTime()) {
        const [eHours, eMins] = this.editEndTime().split(':').map(Number);
        const endDateObj = new Date(this.editDate());
        endDateObj.setHours(eHours || 0, eMins || 0, 0, 0);
        computedEndsAt = endDateObj.toISOString();

        const diffMinutes = Math.round(
          (endDateObj.getTime() - startDateObj.getTime()) / (60 * 1000)
        );
        if (diffMinutes > 0) {
          computedDurationMinutes = diffMinutes;
        }
      }
    }

    const numericStatus = sessionStatusToApiEnum(this.editStatus());

    if (this.applyForwardToRemaining()) {
      this.lms
        .applySessionForward(s.id, {
          topic: s.topic || '',
          instructorId: this.editInstructorId() || s.instructorId || 0,
          startsAt: computedStartsAt,
          endsAt: computedEndsAt,
          location: s.location || '',
          status: numericStatus,
          updateWeeklySchedule: this.updateWeeklySchedule(),
        })
        .subscribe({
          next: (updated) => {
            this.saving.set(false);
            this.notify.showSuccess(
              'Session updated and changes applied forward to all remaining sessions!'
            );
            this.session.set({ ...s, ...updated });
            this.isEditing.set(false);
          },
          error: (err) => {
            this.saving.set(false);
            this.notify.showError(
              'Failed to apply forward: ' + (err.error?.message || 'Error')
            );
          },
        });
    } else {
      const payload: UpdateSessionPayload = {
        topic: s.topic || '',
        instructorId: this.editInstructorId() || s.instructorId || 0,
        startsAt: computedStartsAt,
        endsAt: computedEndsAt,
        location: s.location || '',
        status: numericStatus,
      };

      this.lms.updateSession(s.id, payload).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.notify.showSuccess('Session updated successfully!');
          const newInstructor = this.instructors().find((i) => i.id === this.editInstructorId());
          const merged: ScheduleSession = {
            ...s,
            ...updated,
            instructorId: this.editInstructorId(),
            instructorName: newInstructor?.name ?? s.instructorName,
            status: this.editStatus(),
            startsAt: computedStartsAt,
            endsAt: computedEndsAt,
            durationMinutes: computedDurationMinutes,
          };
          this.session.set(merged);
          this.isEditing.set(false);
        },
        error: () => {
          this.saving.set(false);
          const newInstructor = this.instructors().find((i) => i.id === this.editInstructorId());
          const optimistic: ScheduleSession = {
            ...s,
            instructorId: this.editInstructorId(),
            instructorName: newInstructor?.name ?? s.instructorName,
            status: this.editStatus(),
            startsAt: computedStartsAt,
            endsAt: computedEndsAt,
            durationMinutes: computedDurationMinutes,
          };
          this.notify.showSuccess('Session updated locally (server sync pending).');
          this.session.set(optimistic);
          this.isEditing.set(false);
        },
      });
    }
  }

  cancelSessionWithShift(): void {
    const s = this.session();
    if (!s) return;
    this.saving.set(true);

    this.lms
      .cancelAndShiftSession(s.id, {
        shiftUpcomingSchedule: this.shiftUpcomingSchedule(),
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.notify.showSuccess('Session cancelled & upcoming schedule shifted (+1 week)!');
          this.session.set({ ...s, ...updated, status: 'Cancelled' });
          this.editStatus.set('Cancelled');
          this.isEditing.set(false);
        },
        error: (err) => {
          this.saving.set(false);
          this.notify.showError('Failed to cancel session: ' + (err.error?.message || 'Error'));
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/schedule']);
  }

  goToAttendance(): void {
    const s = this.session();
    if (s) {
      this.router.navigate(['/attendance'], { queryParams: { sessionId: s.id } });
    }
  }
}
