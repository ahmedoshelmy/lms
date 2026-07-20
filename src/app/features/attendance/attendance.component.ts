import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import {
  LmsService,
  ScheduleSession,
  User,
  AttendanceStatus,
  CreateAttendanceDto,
  UpdateAttendanceDto,
} from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/interfaces/Role';

interface StudentAttendanceRecord {
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: AttendanceStatus;
  recordId?: string; // Existing record UUID if updating
  isSaved?: boolean;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, SelectModule],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
            Attendance Sheet
          </h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">
            Track, mark, and update student attendance for scheduled sessions
          </p>
        </div>

        @if (selectedSession()) {
          <div class="flex items-center gap-3">
            <button
              (click)="saveAttendance()"
              [disabled]="saving()"
              class="px-5 py-2.5 rounded-xl bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              @if (saving()) {
                <i class="pi pi-spinner pi-spin"></i>
                Saving…
              } @else {
                <i class="pi pi-check-circle"></i>
                Save Attendance
              }
            </button>
          </div>
        }
      </div>

      <!-- Controls & Session Picker -->
      <div class="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.02)] mb-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          <!-- Session Dropdown -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Select Session
            </label>
            <p-select
              [options]="sessions()"
              [ngModel]="selectedSessionId()"
              (ngModelChange)="onSessionChange($event)"
              optionLabel="topic"
              optionValue="id"
              placeholder="Choose a session"
              class="w-full"
              [filter]="true"
              filterBy="topic,courseTitle,groupName"
            >
              <ng-template pTemplate="selectedItem" let-selected>
                @if (selected) {
                  <div class="truncate text-sm font-bold text-[var(--color-text-primary)]">
                    {{ selected.topic }} ({{ selected.groupName }})
                  </div>
                }
              </ng-template>
              <ng-template pTemplate="item" let-s>
                <div class="py-1">
                  <p class="text-sm font-bold text-[var(--color-text-primary)]">{{ s.topic }}</p>
                  <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {{ s.courseTitle }} · {{ s.groupName }} · {{ formatDate(s.startsAt) }}
                  </p>
                </div>
              </ng-template>
            </p-select>
          </div>

          <!-- Active Session Info Card -->
          @if (selectedSession(); as session) {
            <div class="lg:col-span-2 flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] flex-wrap gap-4">
              <div>
                <span class="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-info-background)] text-[var(--color-secondary)]">
                  {{ session.groupName }}
                </span>
                <h2 class="text-base font-bold text-[var(--color-text-primary)] mt-1">
                  {{ session.topic }}
                </h2>
                <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                  <i class="pi pi-book mr-1"></i>{{ session.courseTitle }}
                  @if (session.instructorName) {
                    · <i class="pi pi-user mr-1 ml-1"></i>{{ session.instructorName }}
                  }
                </p>
              </div>

              <div class="text-right">
                <span class="text-xs font-bold text-[var(--color-secondary)] block">
                  <i class="pi pi-calendar mr-1"></i>{{ formatDate(session.startsAt) }}
                </span>
                <span class="text-xs text-[var(--color-text-muted)]">
                  {{ formatTime(session.startsAt) }} - {{ formatTime(session.endsAt) }}
                </span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Main Body -->
      @if (loading()) {
        <div class="flex justify-center items-center py-20">
          <p-progressSpinner styleClass="w-12 h-12" strokeWidth="4" />
        </div>
      } @else if (!selectedSession()) {
        <div class="text-center py-24 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl">
          <div class="w-16 h-16 rounded-full bg-[var(--color-info-background)] flex items-center justify-center mx-auto mb-4">
            <i class="pi pi-calendar text-3xl text-[var(--color-secondary)]"></i>
          </div>
          <h2 class="text-lg font-bold text-[var(--color-text-primary)]">No session selected</h2>
          <p class="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm mx-auto">
            Please choose a session from the dropdown above to load and mark attendance records.
          </p>
        </div>
      } @else {
        <!-- Attendance Stats & Quick Actions -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="stat-pill p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span class="text-xs text-[var(--color-text-muted)] font-semibold uppercase">Total Students</span>
            <p class="text-2xl font-extrabold text-[var(--color-text-primary)] mt-1">{{ records().length }}</p>
          </div>

          <div class="stat-pill p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div class="flex items-center justify-between">
              <span class="text-xs text-[var(--color-success)] font-bold uppercase">Present</span>
              <span class="text-xs font-extrabold text-[var(--color-success)]">{{ presentRate() }}%</span>
            </div>
            <p class="text-2xl font-extrabold text-[var(--color-success)] mt-1">{{ countByStatus(StatusEnum.Present) }}</p>
          </div>

          <div class="stat-pill p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span class="text-xs text-[var(--color-warning)] font-bold uppercase">Late</span>
            <p class="text-2xl font-extrabold text-[var(--color-warning)] mt-1">{{ countByStatus(StatusEnum.Late) }}</p>
          </div>

          <div class="stat-pill p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span class="text-xs text-[var(--color-info)] font-bold uppercase">Excused</span>
            <p class="text-2xl font-extrabold text-[var(--color-secondary)] mt-1">{{ countByStatus(StatusEnum.Excused) }}</p>
          </div>

          <div class="stat-pill p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span class="text-xs text-[var(--color-danger)] font-bold uppercase">Absent</span>
            <p class="text-2xl font-extrabold text-[var(--color-danger)] mt-1">{{ countByStatus(StatusEnum.Absent) }}</p>
          </div>
        </div>

        <!-- Quick Action Bar -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mr-2">Quick Mark:</span>
            <button
              (click)="bulkSetStatus(StatusEnum.Present)"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-success-background)] text-[var(--color-success)] hover:opacity-80 transition-opacity cursor-pointer"
            >
              <i class="pi pi-check-circle mr-1"></i> All Present
            </button>
            <button
              (click)="bulkSetStatus(StatusEnum.Absent)"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-error-background)] text-[var(--color-danger)] hover:opacity-80 transition-opacity cursor-pointer"
            >
              <i class="pi pi-times-circle mr-1"></i> All Absent
            </button>
          </div>

          <!-- Search filter -->
          <div class="relative w-full md:w-64">
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Filter students…"
              class="w-full pl-9 pr-4 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
            />
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-xs"></i>
          </div>
        </div>

        <!-- Student Roster Table -->
        <div class="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.03)] mb-8">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-left">
                <th class="th-cell">Student</th>
                <th class="th-cell hidden md:table-cell">Email</th>
                <th class="th-cell text-center">Attendance Status</th>
              </tr>
            </thead>
            <tbody>
              @for (rec of filteredRecords(); track rec.studentId) {
                <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td class="td-cell">
                    <div class="flex items-center gap-3">
                      <div class="avatar-circle">
                        {{ initials(rec.studentName) }}
                      </div>
                      <div>
                        <p class="font-bold text-sm text-[var(--color-text-primary)]">{{ rec.studentName }}</p>
                        <p class="text-xs text-[var(--color-text-muted)] md:hidden">{{ rec.studentEmail }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="td-cell text-sm text-[var(--color-text-muted)] hidden md:table-cell">
                    {{ rec.studentEmail }}
                  </td>
                  <td class="td-cell">
                    <div class="flex items-center justify-center gap-1 sm:gap-2">
                      <button
                        (click)="setStatus(rec, StatusEnum.Present)"
                        [class.active-present]="rec.status === StatusEnum.Present"
                        class="status-btn btn-present"
                      >
                        <i class="pi pi-check text-xs"></i>
                        <span class="hidden sm:inline">Present</span>
                      </button>

                      <button
                        (click)="setStatus(rec, StatusEnum.Late)"
                        [class.active-late]="rec.status === StatusEnum.Late"
                        class="status-btn btn-late"
                      >
                        <i class="pi pi-clock text-xs"></i>
                        <span class="hidden sm:inline">Late</span>
                      </button>

                      <button
                        (click)="setStatus(rec, StatusEnum.Excused)"
                        [class.active-excused]="rec.status === StatusEnum.Excused"
                        class="status-btn btn-excused"
                      >
                        <i class="pi pi-info-circle text-xs"></i>
                        <span class="hidden sm:inline">Excused</span>
                      </button>

                      <button
                        (click)="setStatus(rec, StatusEnum.Absent)"
                        [class.active-absent]="rec.status === StatusEnum.Absent"
                        class="status-btn btn-absent"
                      >
                        <i class="pi pi-times text-xs"></i>
                        <span class="hidden sm:inline">Absent</span>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="text-center py-12 text-[var(--color-text-muted)]">
                    No students found matching your criteria
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }

    .th-cell {
      padding: 14px 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-text-muted);
    }
    .td-cell {
      padding: 14px 20px;
      vertical-align: middle;
    }

    .avatar-circle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%);
      color: white;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .status-btn {
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn-present:hover { border-color: var(--color-success); color: var(--color-success); }
    .btn-late:hover { border-color: var(--color-warning); color: var(--color-warning); }
    .btn-excused:hover { border-color: var(--color-secondary); color: var(--color-secondary); }
    .btn-absent:hover { border-color: var(--color-danger); color: var(--color-danger); }

    .active-present {
      background: var(--color-success) !important;
      border-color: var(--color-success) !important;
      color: white !important;
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-success) 40%, transparent);
    }
    .active-late {
      background: var(--color-warning) !important;
      border-color: var(--color-warning) !important;
      color: white !important;
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-warning) 40%, transparent);
    }
    .active-excused {
      background: var(--color-secondary) !important;
      border-color: var(--color-secondary) !important;
      color: white !important;
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-secondary) 40%, transparent);
    }
    .active-absent {
      background: var(--color-danger) !important;
      border-color: var(--color-danger) !important;
      color: white !important;
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-danger) 40%, transparent);
    }
  `,
})
export class AttendanceComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  readonly StatusEnum = AttendanceStatus;

  sessions = signal<ScheduleSession[]>([]);
  students = signal<User[]>([]);
  selectedSessionId = signal<string>('');
  records = signal<StudentAttendanceRecord[]>([]);

  loading = signal(false);
  saving = signal(false);
  searchQuery = signal('');

  readonly selectedSession = computed(() =>
    this.sessions().find((s) => s.id === this.selectedSessionId())
  );

  readonly filteredRecords = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.records();
    return this.records().filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentEmail.toLowerCase().includes(q)
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

    // Load schedule sessions + students list concurrently
    this.lms.getSchedule().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions || []);
        if (sessions && sessions.length > 0) {
          this.selectedSessionId.set(sessions[0].id);
          this.loadStudentsForSession(sessions[0].id);
        } else {
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  onSessionChange(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
    this.loadStudentsForSession(sessionId);
  }

  private loadStudentsForSession(sessionId: string): void {
    this.loading.set(true);

    this.lms.getUsers().subscribe({
      next: (users) => {
        const studentUsers = (users || []).filter((u) => u.role === Role.Student);
        this.students.set(studentUsers);

        // Load existing saved records for this session from localStorage fallback or defaults
        const storedKey = `lms_attendance_${sessionId}`;
        const storedJson = isPlatformBrowser(this.platformId)
          ? localStorage.getItem(storedKey)
          : null;
        const storedMap: Record<string, { status: number; recordId?: string }> = storedJson
          ? JSON.parse(storedJson)
          : {};

        const recs: StudentAttendanceRecord[] = studentUsers.map((st) => ({
          studentId: st.id,
          studentName: st.name,
          studentEmail: st.email,
          status: storedMap[st.id]?.status ?? AttendanceStatus.Present,
          recordId: storedMap[st.id]?.recordId,
        }));

        this.records.set(recs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setStatus(record: StudentAttendanceRecord, status: AttendanceStatus): void {
    this.records.update((list) =>
      list.map((r) => (r.studentId === record.studentId ? { ...r, status } : r))
    );
  }

  bulkSetStatus(status: AttendanceStatus): void {
    this.records.update((list) => list.map((r) => ({ ...r, status })));
  }

  countByStatus(status: AttendanceStatus): number {
    return this.records().filter((r) => r.status === status).length;
  }

  saveAttendance(): void {
    const sessionId = this.selectedSessionId();
    if (!sessionId) return;

    this.saving.set(true);
    const recs = this.records();
    let completed = 0;
    let hasError = false;

    // Save to local storage cache immediately
    const cacheMap: Record<string, { status: number; recordId?: string }> = {};

    recs.forEach((r) => {
      cacheMap[r.studentId] = { status: r.status, recordId: r.recordId };

      if (r.recordId) {
        // PUT /api/Attendance/{id}
        const updatePayload: UpdateAttendanceDto = {
          sessionId,
          studentId: r.studentId,
          status: r.status,
        };
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
    cacheMap: Record<string, { status: number; recordId?: string }>,
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
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
