import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/interfaces/Role';
import { ScheduleSession, SessionAttendanceItem } from '../../../core/interfaces/ScheduleSession';
import { AttendanceStatus } from '../../../core/enums/AttendanceStatus';

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
  imports: [CommonModule, RouterModule, FormsModule],
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
  isDirty = signal(false);
  searchQuery = signal('');
  rosterStatusFilter = signal<'all' | StudentStatus>('all');

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Instructor) || this.auth.hasRole(Role.Admin));
  readonly isInstructor = computed(() => this.auth.hasRole(Role.Instructor));

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
