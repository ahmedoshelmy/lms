import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/interfaces/Role';
import { AttendanceStatus } from '../../core/enums/AttendanceStatus';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import {
  UpdateAttendanceDto,
  CreateAttendanceDto,
  AttendanceResponseDto,
} from '../../core/interfaces/Attendance';
import { User } from '../../core/interfaces/User';

interface StudentAttendanceRecord {
  studentId: number;
  studentName: string;
  studentEmail: string;
  status: AttendanceStatus;
  recordId?: number; // Existing record UUID if updating
  isSaved?: boolean;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, SelectModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  readonly StatusEnum = AttendanceStatus;

  sessions = signal<ScheduleSession[]>([]);
  students = signal<User[]>([]);
  selectedSessionId = signal<number>(0);
  records = signal<StudentAttendanceRecord[]>([]);

  loading = signal(false);
  saving = signal(false);
  searchQuery = signal('');

  readonly selectedSession = computed(() =>
    this.sessions().find((s) => s.id === this.selectedSessionId())
  );

  /** True when the session started more than 24 hours ago */
  readonly isLocked = computed(() => {
    const s = this.selectedSession();
    if (!s) return false;
    const elapsed = Date.now() - new Date(s.startsAt).getTime();
    return elapsed > 24 * 60 * 60 * 1000;
  });

  readonly filteredRecords = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.records();
    return this.records().filter(
      (r) => r.studentName.toLowerCase().includes(q) || r.studentEmail.toLowerCase().includes(q)
    );
  });

  readonly presentRate = computed(() => {
    const total = this.records().length;
    if (total === 0) return 0;
    const presentCount = this.countByStatus(AttendanceStatus.Present);
    return Math.round((presentCount / total) * 100);
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    this.lms.getSchedule().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions || []);
        if (sessions && sessions.length > 0) {
          this.selectedSessionId.set(sessions[0].id);
          this.loadAttendanceForSession(sessions[0].id);
        } else {
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  onSessionChange(sessionId: number): void {
    this.selectedSessionId.set(sessionId);
    this.loadAttendanceForSession(sessionId);
  }

  private loadAttendanceForSession(sessionId: number): void {
    this.loading.set(true);

    // First, load all students so we have the full roster
    this.lms.getStudents().subscribe({
      next: (users) => {
        const studentUsers = (users || []).filter((u) => u.role === Role.Student);
        this.students.set(studentUsers);

        // Then try to fetch existing attendance records from the API
        this.lms.getSessionAttendance(sessionId).subscribe({
          next: (apiRecords: AttendanceResponseDto[]) => {
            this.mergeAttendanceRecords(sessionId, studentUsers, apiRecords);
          },
          error: () => {
            // Fallback to localStorage cache
            this.loadFromLocalStorage(sessionId, studentUsers);
          },
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private mergeAttendanceRecords(
    sessionId: number,
    studentUsers: User[],
    apiRecords: AttendanceResponseDto[]
  ): void {
    const apiMap = new Map<number, AttendanceResponseDto>();
    apiRecords.forEach((r) => apiMap.set(r.studentId, r));

    // Also check localStorage for any unsaved local changes
    const storedKey = `lms_attendance_${sessionId}`;
    const storedJson = isPlatformBrowser(this.platformId) ? localStorage.getItem(storedKey) : null;
    const storedMap: Record<string, { status: number; recordId?: number }> = storedJson
      ? JSON.parse(storedJson)
      : {};

    const recs: StudentAttendanceRecord[] = studentUsers.map((st) => {
      const apiRec = apiMap.get(st.id);
      if (apiRec) {
        return {
          studentId: st.id,
          studentName: st.name,
          studentEmail: st.email,
          status: (apiRec.status as AttendanceStatus) ?? AttendanceStatus.Present,
          recordId: apiRec.id,
          isSaved: true,
        };
      }
      return {
        studentId: st.id,
        studentName: st.name,
        studentEmail: st.email,
        status: storedMap[st.id]?.status ?? AttendanceStatus.Present,
        recordId: storedMap[st.id]?.recordId ? Number(storedMap[st.id].recordId) : undefined,
        isSaved: false,
      };
    });

    this.records.set(recs);
    this.loading.set(false);
  }

  private loadFromLocalStorage(sessionId: number, studentUsers: User[]): void {
    const storedKey = `lms_attendance_${sessionId}`;
    const storedJson = isPlatformBrowser(this.platformId) ? localStorage.getItem(storedKey) : null;
    const storedMap: Record<string, { status: number; recordId?: number }> = storedJson
      ? JSON.parse(storedJson)
      : {};

    const recs: StudentAttendanceRecord[] = studentUsers.map((st) => ({
      studentId: st.id,
      studentName: st.name,
      studentEmail: st.email,
      status: storedMap[st.id]?.status ?? AttendanceStatus.Present,
      recordId: storedMap[st.id]?.recordId ? Number(storedMap[st.id].recordId) : undefined,
      isSaved: false,
    }));

    this.records.set(recs);
    this.loading.set(false);
  }

  setStatus(record: StudentAttendanceRecord, status: AttendanceStatus): void {
    if (this.isLocked()) {
      this.notify.showError('Attendance cannot be changed after 24 hours from session start.');
      return;
    }
    this.records.update((list) =>
      list.map((r) => (r.studentId === record.studentId ? { ...r, status } : r))
    );
  }

  bulkSetStatus(status: AttendanceStatus): void {
    if (this.isLocked()) {
      this.notify.showError('Attendance cannot be changed after 24 hours from session start.');
      return;
    }
    this.records.update((list) => list.map((r) => ({ ...r, status })));
  }

  countByStatus(status: AttendanceStatus): number {
    return this.records().filter((r) => r.status === status).length;
  }

  saveAttendance(): void {
    if (this.isLocked()) {
      this.notify.showError('Attendance cannot be changed after 24 hours from session start.');
      return;
    }
    const sessionId = this.selectedSessionId();
    if (!sessionId) return;

    this.saving.set(true);
    const recs = this.records();
    let completed = 0;
    let hasError = false;

    // Save to local storage cache immediately
    const cacheMap: Record<string, { status: number; recordId?: number }> = {};

    recs.forEach((r) => {
      cacheMap[r.studentId] = { status: r.status, recordId: r.recordId };

      if (r.recordId) {
        // PUT /api/Attendance/{id}
        const updatePayload: UpdateAttendanceDto = { status: r.status };
        this.lms.updateAttendance(r.recordId, updatePayload).subscribe({
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
        // POST /api/Attendance
        const createPayload: CreateAttendanceDto = {
          sessionId,
          studentId: r.studentId,
          status: r.status,
        };
        this.lms.createAttendance(createPayload).subscribe({
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

    if (recs.length === 0) {
      this.finishSave(cacheMap, hasError);
    }
  }

  private finishSave(
    cacheMap: Record<string, { status: number; recordId?: number }>,
    hasError: boolean
  ): void {
    const sessionId = this.selectedSessionId();
    if (sessionId && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(`lms_attendance_${sessionId}`, JSON.stringify(cacheMap));
    }
    this.saving.set(false);
    if (hasError) {
      this.notify.showSuccess('Attendance sheet saved locally (server sync pending)');
    } else {
      this.notify.showSuccess('Attendance sheet saved successfully!');
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

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  formatTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  getStatusBadgeClass(status: string): string {
    const norm = (status ?? '').toLowerCase();
    if (norm.includes('running')) return 'session-status-running';
    if (norm.includes('completed')) return 'session-status-completed';
    if (norm.includes('cancel')) return 'session-status-cancelled';
    return 'session-status-scheduled';
  }
}
