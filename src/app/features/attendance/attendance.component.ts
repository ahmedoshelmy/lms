import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { catchError, of } from 'rxjs';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { AttendanceResponseDto, BulkAttendanceItem } from '../../core/interfaces/Attendance';
import { AttendanceStatus } from '../../core/enums/AttendanceStatus';
import { User } from '../../core/interfaces/User';
import { Group } from '../../core/interfaces/Group';

export type StudentStatus = 'Pending' | 'Present' | 'Late' | 'Excused' | 'Absent';

export interface StudentAttendanceRecord {
  studentId: number;
  studentName: string;
  studentEmail: string;
  status: StudentStatus;
  recordId?: number; // Existing record ID if updating
  isSaved?: boolean;
}

export type RosterFilterOption = 'all' | StudentStatus;
export type SessionStatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';
export type DateRangeFilter = 'all' | 'today' | 'week' | 'month';

export function statusToApiEnum(status: StudentStatus): AttendanceStatus {
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

export function normalizeAttendanceStatus(raw: any): StudentStatus {
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
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, SelectModule, DialogModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  sessions = signal<ScheduleSession[]>([]);
  students = signal<User[]>([]);
  selectedSessionId = signal<number>(0);
  sessionDetail = signal<ScheduleSession | null>(null);
  records = signal<StudentAttendanceRecord[]>([]);

  loading = signal(false);
  saving = signal(false);
  isDirty = signal(false);
  searchQuery = signal('');
  rosterStatusFilter = signal<RosterFilterOption>('all');
  sessionStatusFilter = signal<SessionStatusFilter>('all');
  selectedGroupFilter = signal<string>('all');
  dateRangeFilter = signal<DateRangeFilter>('all');
  instructors = signal<User[]>([]);
  selectedInstructorFilter = signal<number>(0);
  selectedStudentIds = signal<number[]>([]);

  // Admin Student Management Modal Signals
  groups = signal<Group[]>([]);
  showStudentDetailsModal = signal<boolean>(false);
  showEditStudentModal = signal<boolean>(false);
  showDeleteStudentModal = signal<boolean>(false);
  showStudentHistoryModal = signal<boolean>(false);
  historyStudent = signal<StudentAttendanceRecord | null>(null);
  selectedStudentUser = signal<User | null>(null);
  selectedStudentRec = signal<StudentAttendanceRecord | null>(null);
  formStudentName = signal<string>('');
  formStudentEmail = signal<string>('');
  formStudentGroupId = signal<number>(0);
  savingStudent = signal<boolean>(false);
  deletingStudent = signal<boolean>(false);

  readonly selectedSession = computed(() => {
    const detail = this.sessionDetail();
    if (detail && detail.id === this.selectedSessionId()) {
      return detail;
    }
    return this.sessions().find((s) => s.id === this.selectedSessionId());
  });

  /** Extract unique group names for group filter dropdown */
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
      this.selectedInstructorFilter() !== 0
    );
  });

  /** Session sequence progress percentage */
  readonly sessionProgressPercent = computed(() => {
    const s = this.selectedSession();
    if (!s || !s.currentSessionNumber || !s.totalSessions) return 0;
    return Math.min(100, Math.round((s.currentSessionNumber / s.totalSessions) * 100));
  });

  /** Filtered list of sessions based on Status, Group, Date Range, and Instructor filters */
  readonly filteredSessionsList = computed(() => {
    const statusFilter = this.sessionStatusFilter();
    const groupFilter = this.selectedGroupFilter();
    const dateFilter = this.dateRangeFilter();
    const instFilter = this.selectedInstructorFilter();
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
      // 0. Instructor Filter for Admin
      if (instFilter !== 0) {
        const selectedInst = this.instructors().find((i) => i.id === instFilter);
        const matchesInstId =
          String(s.instructorId) === String(instFilter);
        const matchesInstName =
          selectedInst && s.instructorName
            ? s.instructorName.toLowerCase().includes(selectedInst.name.toLowerCase())
            : false;
        if (!matchesInstId && !matchesInstName) return false;
      }

      // 1. Status Filter
      const normStatus = (s.status ?? '').toLowerCase();
      if (statusFilter === 'scheduled' && !normStatus.includes('scheduled')) return false;
      if (statusFilter === 'completed' && !normStatus.includes('completed')) return false;
      if (statusFilter === 'cancelled' && !normStatus.includes('cancel')) return false;

      // 2. Group Filter
      if (groupFilter !== 'all' && s.groupName !== groupFilter) return false;

      // 3. Date Range Filter
      if (dateFilter !== 'all') {
        const time = new Date(s.startsAt).getTime();
        if (dateFilter === 'today' && (time < todayStart || time >= todayEnd)) return false;
        if (dateFilter === 'week' && (time < weekStart.getTime() || time >= weekEnd.getTime()))
          return false;
        if (dateFilter === 'month' && (time < monthStart || time > monthEnd)) return false;
      }

      return true;
    });
  });

  /** True when the session started more than 24 hours ago */
  readonly isLocked = computed(() => {
    const s = this.selectedSession();
    if (!s) return false;
    const elapsed = Date.now() - new Date(s.startsAt).getTime();
    return elapsed > 24 * 60 * 60 * 1000;
  });

  /** True when the session is cancelled */
  readonly isCancelled = computed(() => {
    const s = this.selectedSession();
    if (!s) return false;
    return (s.status ?? '').toLowerCase().includes('cancel');
  });

  /** True when the session is scheduled for a future day (after today) */
  readonly isUpcoming = computed(() => {
    const s = this.selectedSession();
    if (!s) return false;
    const start = new Date(s.startsAt);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return start.getTime() > todayEnd.getTime();
  });

  /** True when attendance marking is disabled (upcoming, cancelled, or 24h locked) */
  readonly isAttendanceDisabled = computed(() => {
    return this.isUpcoming() || this.isCancelled() || this.isLocked();
  });

  /** Helper to verify attendance modification permission and display appropriate alert if disabled */
  checkAttendanceAllowed(): boolean {
    if (this.isCancelled()) {
      this.notify.showError('Attendance cannot be taken or modified for cancelled sessions.');
      return false;
    }
    if (this.isUpcoming()) {
      this.notify.showError('Attendance cannot be marked before the session begins.');
      return false;
    }
    if (this.isLocked()) {
      this.notify.showError('Attendance cannot be changed after 24 hours from session start.');
      return false;
    }
    return true;
  }

  rosterSortColumn = signal<string>('studentName');
  rosterSortDirection = signal<'asc' | 'desc'>('asc');

  toggleRosterSort(col: string): void {
    if (this.rosterSortColumn() === col) {
      this.rosterSortDirection.set(this.rosterSortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.rosterSortColumn.set(col);
      this.rosterSortDirection.set('asc');
    }
  }

  getRosterSortIcon(col: string): string {
    if (this.rosterSortColumn() !== col)
      return 'pi-sort-alt text-[var(--color-text-muted)] opacity-40';
    return this.rosterSortDirection() === 'asc'
      ? 'pi-sort-amount-up-alt text-[var(--color-secondary)] font-bold'
      : 'pi-sort-amount-down text-[var(--color-secondary)] font-bold';
  }

  readonly filteredRecords = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const filter = this.rosterStatusFilter();

    const list = this.records().filter((r) => {
      const matchesSearch =
        !q || r.studentName.toLowerCase().includes(q) || r.studentEmail.toLowerCase().includes(q);

      const matchesStatus = filter === 'all' || r.status === filter;

      return matchesSearch && matchesStatus;
    });

    const col = this.rosterSortColumn();
    const dir = this.rosterSortDirection();

    return list.sort((a: any, b: any) => {
      let valA: any = a[col] || '';
      let valB: any = b[col] || '';

      const comp = valA
        .toString()
        .localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    });
  });

  readonly presentRate = computed(() => {
    const total = this.records().length;
    if (total === 0) return 0;
    const presentCount = this.countByStatus('Present');
    return Math.round((presentCount / total) * 100);
  });

  readonly isAllSelected = computed(() => {
    const visible = this.filteredRecords();
    if (visible.length === 0) return false;
    const selectedSet = new Set(this.selectedStudentIds());
    return visible.every((r) => selectedSet.has(r.studentId));
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
        this.sessions.set(sessions || []);
        if (sessions && sessions.length > 0) {
          // Check query parameters for deep-linked sessionId or id
          const queryParams = this.route.snapshot.queryParams;
          const paramId = Number(queryParams['sessionId'] || queryParams['id']);

          const targetSession = sessions.find((s) => s.id === paramId) || sessions[0];
          this.selectedSessionId.set(targetSession.id);
          this.loadAttendanceForSession(targetSession.id);
        } else {
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  onSessionChange(sessionId: number): void {
    if (this.isDirty()) {
      if (!confirm('You have unsaved attendance changes. Switch session anyway?')) {
        return;
      }
    }
    this.selectedSessionId.set(sessionId);
    this.selectedStudentIds.set([]);
    this.loadAttendanceForSession(sessionId);
  }

  setSessionStatusFilter(filter: SessionStatusFilter): void {
    this.sessionStatusFilter.set(filter);
    this.syncSelectedSessionWithFilter();
  }

  setGroupFilter(group: string): void {
    this.selectedGroupFilter.set(group);
    this.syncSelectedSessionWithFilter();
  }

  setDateRangeFilter(filter: DateRangeFilter): void {
    this.dateRangeFilter.set(filter);
    this.syncSelectedSessionWithFilter();
  }

  setInstructorFilter(instId: number): void {
    this.selectedInstructorFilter.set(instId);
    this.syncSelectedSessionWithFilter();
  }

  resetFilters(): void {
    this.sessionStatusFilter.set('all');
    this.selectedGroupFilter.set('all');
    this.dateRangeFilter.set('all');
    this.selectedInstructorFilter.set(0);
    this.syncSelectedSessionWithFilter();
  }

  exportToCsv(): void {
    const session = this.selectedSession();
    const records = this.filteredRecords();
    if (!records || records.length === 0) {
      this.notify.showWarn('No student records available to export.');
      return;
    }

    const headers = ['Student ID', 'Student Name', 'Email', 'Attendance Status'];
    const rows = records.map((r) => [
      r.studentId,
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.studentEmail.replace(/"/g, '""')}"`,
      `"${r.status}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const sessionName = session
      ? `session_${session.id}_${session.courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}`
      : 'attendance';
    link.setAttribute('download', `${sessionName}_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.notify.showSuccess('Attendance roster exported as CSV.');
  }

  private syncSelectedSessionWithFilter(): void {
    const list = this.filteredSessionsList();
    const currentId = this.selectedSessionId();
    const exists = list.some((s) => s.id === currentId);

    if (!exists) {
      if (list.length > 0) {
        const newTargetId = list[0].id;
        this.selectedSessionId.set(newTargetId);
        this.loadAttendanceForSession(newTargetId);
      } else {
        this.selectedSessionId.set(0);
        this.sessionDetail.set(null);
        this.records.set([]);
      }
    }
  }

  setRosterFilter(filter: RosterFilterOption): void {
    this.rosterStatusFilter.set(filter);
  }

  toggleStudentSelection(studentId: number): void {
    const current = new Set(this.selectedStudentIds());
    if (current.has(studentId)) {
      current.delete(studentId);
    } else {
      current.add(studentId);
    }
    this.selectedStudentIds.set(Array.from(current));
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      const allVisibleIds = this.filteredRecords().map((r) => r.studentId);
      this.selectedStudentIds.set(allVisibleIds);
    } else {
      this.selectedStudentIds.set([]);
    }
  }

  isStudentSelected(studentId: number): boolean {
    return this.selectedStudentIds().includes(studentId);
  }

  private loadAttendanceForSession(sessionId: number): void {
    this.loading.set(true);
    this.isDirty.set(false);
    this.selectedStudentIds.set([]);

    // Call GET /api/Schedule/sessions/{id} endpoint
    this.lms
      .getSessionDetails(sessionId)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (detail: ScheduleSession | null) => {
          if (detail) {
            this.sessionDetail.set(detail);

            // Convert detail.attendances to StudentAttendanceRecord format
            const apiAtts: AttendanceResponseDto[] = (detail.attendances || []).map((att) => ({
              id: att.id,
              sessionId,
              studentId: att.studentId,
              studentName: att.studentName,
              studentEmail: att.studentEmail,
              status: att.status,
            }));

            this.buildRecordsFromApi(sessionId, apiAtts, []);
          } else {
            // Fallback to legacy getSessionAttendance API if getSessionDetails is unavailable
            this.loadLegacySessionAttendance(sessionId);
          }
        },
        error: () => {
          this.loadLegacySessionAttendance(sessionId);
        },
      });
  }

  private loadLegacySessionAttendance(sessionId: number): void {
    this.lms.getSessionAttendance(sessionId).subscribe({
      next: (apiRecords: AttendanceResponseDto[]) => {
        this.buildRecordsFromApi(sessionId, apiRecords, []);
      },
      error: () => {
        this.buildRecordsFromApi(sessionId, [], []);
      },
    });
  }

  private buildRecordsFromApi(
    sessionId: number,
    apiRecords: AttendanceResponseDto[],
    studentUsers: User[] = []
  ): void {
    const apiMap = new Map<number, AttendanceResponseDto>();
    (apiRecords || []).forEach((r) => apiMap.set(r.studentId, r));

    const storedKey = `lms_attendance_${sessionId}`;
    const storedJson = isPlatformBrowser(this.platformId) ? localStorage.getItem(storedKey) : null;
    const storedMap: Record<string, { status: string; recordId?: number }> = storedJson
      ? JSON.parse(storedJson)
      : {};

    const recs: StudentAttendanceRecord[] = [];

    // 1. First add students from studentUsers list (if loaded by Admin)
    studentUsers.forEach((st) => {
      const apiRec = apiMap.get(st.id);
      if (apiRec) {
        recs.push({
          studentId: st.id,
          studentName: st.name,
          studentEmail: st.email,
          status: normalizeAttendanceStatus(apiRec.status),
          recordId: apiRec.id,
          isSaved: true,
        });
        apiMap.delete(st.id);
      } else {
        recs.push({
          studentId: st.id,
          studentName: st.name,
          studentEmail: st.email,
          status: normalizeAttendanceStatus(storedMap[st.id]?.status ?? 'Pending'),
          recordId: storedMap[st.id]?.recordId ? Number(storedMap[st.id].recordId) : undefined,
          isSaved: false,
        });
      }
    });

    // 2. Add any remaining students from apiRecords (e.g. for Instructors where getStudents was skipped)
    apiMap.forEach((apiRec, stId) => {
      recs.push({
        studentId: stId,
        studentName: apiRec.studentName || `Student #${stId}`,
        studentEmail: apiRec.studentEmail || '',
        status: normalizeAttendanceStatus(apiRec.status),
        recordId: apiRec.id,
        isSaved: true,
      });
    });

    // 3. Add any remaining students from local storage cache
    Object.entries(storedMap).forEach(([stIdStr, data]) => {
      const stId = Number(stIdStr);
      if (!recs.some((r) => r.studentId === stId)) {
        recs.push({
          studentId: stId,
          studentName: `Student #${stId}`,
          studentEmail: '',
          status: normalizeAttendanceStatus(data.status),
          recordId: data.recordId,
          isSaved: false,
        });
      }
    });

    this.records.set(recs);
    this.isDirty.set(false);
    this.loading.set(false);
  }

  setStatus(record: StudentAttendanceRecord, status: StudentStatus): void {
    if (!this.checkAttendanceAllowed()) return;
    if (record.status === status) return;

    this.records.update((list) =>
      list.map((r) => (r.studentId === record.studentId ? { ...r, status } : r))
    );
    this.isDirty.set(true);
  }

  bulkSetStatus(status: StudentStatus): void {
    if (!this.checkAttendanceAllowed()) return;
    this.records.update((list) => list.map((r) => ({ ...r, status })));
    this.isDirty.set(true);
  }

  bulkSetSelectedStatus(status: StudentStatus): void {
    if (!this.checkAttendanceAllowed()) return;
    const selectedSet = new Set(this.selectedStudentIds());
    if (selectedSet.size === 0) return;

    this.records.update((list) =>
      list.map((r) => (selectedSet.has(r.studentId) ? { ...r, status } : r))
    );
    this.isDirty.set(true);
    this.notify.showSuccess(`Updated ${selectedSet.size} selected student(s) to ${status}`);
  }

  resetChanges(): void {
    const sessionId = this.selectedSessionId();
    if (sessionId) {
      this.loadAttendanceForSession(sessionId);
    }
  }

  exportAttendanceCsv(): void {
    const session = this.selectedSession();
    const recs = this.filteredRecords();
    if (!session || recs.length === 0) {
      this.notify.showError('No records to export');
      return;
    }

    const headers = [
      'Student ID',
      'Student Name',
      'Email',
      'Status',
      'Session Topic',
      'Course',
      'Group',
      'Date',
    ];
    const rows = recs.map((r) => [
      r.studentId,
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.studentEmail}"`,
      r.status,
      `"${(session.topic || '').replace(/"/g, '""')}"`,
      `"${(session.courseTitle || '').replace(/"/g, '""')}"`,
      `"${(session.groupName || '').replace(/"/g, '""')}"`,
      `"${this.formatDate(session.startsAt)}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Attendance_${(session.topic || 'Session').replace(/[^a-zA-Z0-9]/g, '_')}_${this.formatDate(session.startsAt)}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.notify.showSuccess('Attendance sheet exported as CSV');
  }

  countByStatus(status: StudentStatus): number {
    return this.records().filter((r) => r.status === status).length;
  }

  saveAttendance(): void {
    if (!this.checkAttendanceAllowed()) return;
    const sessionId = this.selectedSessionId();
    if (!sessionId) return;

    this.saving.set(true);
    const recs = this.records();

    // Prepare local storage cache map
    const cacheMap: Record<string, { status: string; recordId?: number }> = {};
    recs.forEach((r) => {
      cacheMap[r.studentId] = { status: r.status, recordId: r.recordId };
    });

    // Prepare payload array for POST /api/Attendance/session/{sessionId}
    const bulkPayload: BulkAttendanceItem[] = recs.map((r) => ({
      studentId: r.studentId,
      status: statusToApiEnum(r.status), // 0 = Absent, 1 = Present, 2 = Late, 3 = Excused
    }));

    // Primary: Call bulk attendance save endpoint POST /api/Attendance/session/{sessionId}
    this.lms.saveBulkAttendance(sessionId, bulkPayload).subscribe({
      next: () => {
        this.finishSave(cacheMap, false);
      },
      error: () => {
        // Fallback: If bulk endpoint encounters issue, save individual records or save locally
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
              .createAttendance({ sessionId, studentId: r.studentId, status: numericStatus })
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

        if (recs.length === 0) {
          this.finishSave(cacheMap, true);
        }
      },
    });
  }

  private finishSave(
    cacheMap: Record<string, { status: string; recordId?: number }>,
    hasError: boolean
  ): void {
    const sessionId = this.selectedSessionId();
    if (sessionId && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(`lms_attendance_${sessionId}`, JSON.stringify(cacheMap));
    }
    this.saving.set(false);
    this.isDirty.set(false);

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
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  getStatusBadgeClass(status: string): string {
    const norm = (status ?? '').toLowerCase();
    if (norm.includes('running')) return 'session-status-running';
    if (norm.includes('completed')) return 'session-status-completed';
    if (norm.includes('cancel')) return 'session-status-cancelled';
    return 'session-status-scheduled';
  }

  // ─── Admin Student Management Methods ─────────────────────────────────────

  openStudentHistoryModal(rec: StudentAttendanceRecord): void {
    this.historyStudent.set(rec);
    this.showStudentHistoryModal.set(true);
  }

  closeStudentHistoryModal(): void {
    this.showStudentHistoryModal.set(false);
    this.historyStudent.set(null);
  }

  openStudentDetailsModal(rec: StudentAttendanceRecord): void {
    this.selectedStudentRec.set(rec);
    this.selectedStudentUser.set(null);
    this.showStudentDetailsModal.set(true);

    this.lms.getStudents().subscribe({
      next: (users) => {
        const match = users?.find((u) => u.id === rec.studentId);
        if (match) {
          this.selectedStudentUser.set(match);
        }
      },
    });
  }

  openEditStudentModal(rec: StudentAttendanceRecord): void {
    this.selectedStudentRec.set(rec);
    this.formStudentName.set(rec.studentName);
    this.formStudentEmail.set(rec.studentEmail);
    this.formStudentGroupId.set(0);

    this.lms.getGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups || []);
      },
    });

    this.lms.getStudents().subscribe({
      next: (users) => {
        const match = users?.find((u) => u.id === rec.studentId);
        if (match) {
          this.selectedStudentUser.set(match);
          this.formStudentGroupId.set(match.groupId || 0);
        }
        this.showEditStudentModal.set(true);
      },
      error: () => {
        this.showEditStudentModal.set(true);
      },
    });
  }

  saveStudentChanges(): void {
    const rec = this.selectedStudentRec();
    if (!rec) return;

    const name = this.formStudentName().trim();
    const email = this.formStudentEmail().trim();
    const groupId = this.formStudentGroupId() || undefined;

    if (!name || !email) {
      this.notify.showWarn('Please enter student name and email.');
      return;
    }

    this.savingStudent.set(true);
    this.lms
      .updateUser(rec.studentId, {
        name,
        email,
        role: Role.Student,
        groupId,
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess(`Student ${name} updated.`);
          this.savingStudent.set(false);
          this.showEditStudentModal.set(false);

          // Update local record
          this.records.update((list) =>
            list.map((r) =>
              r.studentId === rec.studentId ? { ...r, studentName: name, studentEmail: email } : r
            )
          );

          // Reload current session details
          const sId = this.selectedSessionId();
          if (sId) this.loadAttendanceForSession(sId);
        },
        error: () => {
          this.savingStudent.set(false);
        },
      });
  }

  openDeleteStudentModal(rec: StudentAttendanceRecord): void {
    this.selectedStudentRec.set(rec);
    this.showDeleteStudentModal.set(true);
  }

  confirmDeleteStudent(): void {
    const rec = this.selectedStudentRec();
    if (!rec) return;

    this.deletingStudent.set(true);
    this.lms.deleteUser(rec.studentId).subscribe({
      next: () => {
        this.notify.showSuccess(`Student ${rec.studentName} deleted.`);
        this.deletingStudent.set(false);
        this.showDeleteStudentModal.set(false);

        // Remove from local records
        this.records.update((list) => list.filter((r) => r.studentId !== rec.studentId));

        // Reload current session
        const sId = this.selectedSessionId();
        if (sId) this.loadAttendanceForSession(sId);
      },
      error: () => {
        this.deletingStudent.set(false);
      },
    });
  }
}
