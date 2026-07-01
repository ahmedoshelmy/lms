import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, Course, User, Enrollment, AttendanceSession, AttendanceRecord } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    InputTextModule,
    SkeletonModule,
    TagModule,
    ToggleSwitchModule,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">Attendance</h1>
          <p class="text-sm text-[#64748b] mt-1">Manage session-based student roll calls per course</p>
        </div>
        <div class="flex gap-3">
          <button
            pButton
            type="button"
            icon="pi pi-plus"
            label="New Session"
            class="p-button-primary cursor-pointer"
            (click)="openNewSessionDialog()">
          </button>
        </div>
      </div>

      <!-- Local-only notice -->
      <div class="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <i class="pi pi-info-circle text-amber-500 text-base mt-0.5 shrink-0"></i>
        <span>Attendance sessions are stored <strong>locally in your browser</strong> until an API endpoint is available. Data persists between sessions.</span>
      </div>

      <!-- Summary stats -->
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span class="text-2xl font-bold text-[#1e293b]">{{ sessions.length }}</span>
          <p class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mt-1">Total Sessions</p>
        </div>
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span class="text-2xl font-bold text-emerald-600">{{ totalPresent }}</span>
          <p class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mt-1">Total Present</p>
        </div>
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span class="text-2xl font-bold text-rose-500">{{ totalAbsent }}</span>
          <p class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mt-1">Total Absent</p>
        </div>
      </div>

      <!-- Skeleton -->
      @if (loading) {
        <div class="flex flex-col gap-4">
          @for (i of [1,2,3]; track i) {
            <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
              <div class="flex justify-between mb-4">
                <p-skeleton width="200px" height="16px" />
                <p-skeleton width="80px" height="24px" borderRadius="999px" />
              </div>
              <p-skeleton width="100%" height="12px" />
            </div>
          }
        </div>
      }

      <!-- Sessions list -->
      @if (!loading) {
        @if (sessions.length === 0) {
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-16 text-center text-sm text-[#94a3b8]">
            <i class="pi pi-calendar text-4xl text-[#cbd5e1] mb-3 block"></i>
            No attendance sessions recorded yet. Click "New Session" to begin.
          </div>
        } @else {
          <div class="flex flex-col gap-4">
            @for (session of sessions; track session.id) {
              <div class="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.08)] transition-all duration-300">
                <!-- Session header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-[#f1f5f9]">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                      <i class="pi pi-calendar text-base"></i>
                    </div>
                    <div>
                      <p class="font-bold text-[#1e293b] text-sm">{{ session.courseTitle || 'Unknown Course' }}</p>
                      <p class="text-xs text-[#94a3b8]">{{ session.date | date:'fullDate' }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full">
                      {{ getPresentCount(session) }} present
                    </span>
                    <span class="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-1 rounded-full">
                      {{ getAbsentCount(session) }} absent
                    </span>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-pencil"
                      class="p-button-text p-button-sm cursor-pointer"
                      title="Edit session"
                      (click)="editSession(session)">
                    </button>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-trash"
                      class="p-button-text p-button-danger p-button-sm cursor-pointer"
                      title="Delete session"
                      (click)="confirmDelete(session)">
                    </button>
                  </div>
                </div>

                <!-- Attendance pills -->
                <div class="flex flex-wrap gap-2 p-5">
                  @for (record of session.records; track record.studentId) {
                    <span
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200"
                      [class]="record.present
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-600 border-rose-200'">
                      <i [class]="record.present ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
                      {{ record.studentName || record.studentId.slice(0, 8) }}
                    </span>
                  }
                  @if (session.records.length === 0) {
                    <span class="text-xs text-[#94a3b8]">No students recorded.</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- Dialog: New/Edit Session -->
      <p-dialog
        [header]="editingSession ? 'Edit Session' : 'New Attendance Session'"
        [(visible)]="showSessionDialog"
        [modal]="true"
        [style]="{ width: '560px', maxWidth: '95vw' }"
        [draggable]="false"
        [resizable]="false">
        <div class="flex flex-col gap-5 py-3">
          <!-- Course select -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Select Course</label>
            <p-select
              [options]="courses"
              [(ngModel)]="sessionForm.courseId"
              optionLabel="title"
              optionValue="id"
              placeholder="-- Choose Course --"
              styleClass="w-full"
              [filter]="true"
              filterBy="title"
              (onChange)="onCourseSelected($event.value)">
            </p-select>
          </div>

          <!-- Date -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Session Date</label>
            <input
              pInputText
              type="date"
              [(ngModel)]="sessionForm.date"
              class="w-full rounded-xl" />
          </div>

          <!-- Roll Call -->
          @if (sessionStudents.length > 0) {
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-[#64748b]">Roll Call</label>
                <div class="flex gap-2">
                  <button pButton type="button" label="All Present" class="p-button-text p-button-sm p-button-success cursor-pointer text-xs" (click)="setAll(true)"></button>
                  <button pButton type="button" label="All Absent" class="p-button-text p-button-sm p-button-danger cursor-pointer text-xs" (click)="setAll(false)"></button>
                </div>
              </div>
              <div class="max-h-60 overflow-y-auto flex flex-col gap-2 pr-1">
                @for (rec of sessionRecords; track rec.studentId) {
                  <div
                    class="flex items-center justify-between p-3 border rounded-xl transition-all duration-200"
                    [class]="rec.present ? 'border-emerald-200 bg-emerald-50' : 'border-[#e2e8f0] bg-white'">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        [class]="rec.present ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'">
                        {{ getInitials(rec.studentName || '') }}
                      </div>
                      <span class="text-sm font-semibold text-[#1e293b]">{{ rec.studentName }}</span>
                    </div>
                    <p-toggleswitch [(ngModel)]="rec.present" />
                  </div>
                }
              </div>
            </div>
          }

          @if (sessionForm.courseId && sessionStudents.length === 0) {
            <p class="text-sm text-[#94a3b8] text-center py-4 border border-dashed border-[#e2e8f0] rounded-xl">
              No enrolled students found for this course.
            </p>
          }

          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showSessionDialog = false"></button>
            <button
              pButton
              type="button"
              [label]="editingSession ? 'Save Changes' : 'Create Session'"
              icon="pi pi-check"
              class="p-button-primary cursor-pointer"
              [disabled]="!sessionForm.courseId || !sessionForm.date"
              (click)="saveSession()">
            </button>
          </div>
        </div>
      </p-dialog>

      <!-- Confirm Delete Dialog -->
      <p-dialog
        header="Delete Session"
        [(visible)]="showDeleteConfirm"
        [modal]="true"
        [style]="{ width: '380px' }"
        [draggable]="false"
        [resizable]="false">
        <p class="text-sm text-[#64748b] py-3">
          Are you sure you want to delete the attendance session for
          <strong>{{ deletingSession?.courseTitle }}</strong> on
          <strong>{{ deletingSession?.date | date:'mediumDate' }}</strong>?
          This action cannot be undone.
        </p>
        <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
          <button pButton type="button" label="Cancel" class="p-button-text cursor-pointer" (click)="showDeleteConfirm = false"></button>
          <button pButton type="button" label="Delete" icon="pi pi-trash" class="p-button-danger cursor-pointer" (click)="deleteSession()"></button>
        </div>
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-select { border-radius: 10px; border-color: #cbd5e1; }
      .p-button { border-radius: 10px; font-weight: 600; }
      .p-dialog { border-radius: 16px; overflow: hidden; }
    }
  `
})
export class AttendanceComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  loading = true;
  sessions: AttendanceSession[] = [];
  courses: Course[] = [];
  allEnrollments: Record<string, Enrollment[]> = {};

  // Dialog state
  showSessionDialog = false;
  showDeleteConfirm = false;
  editingSession: AttendanceSession | null = null;
  deletingSession: AttendanceSession | null = null;

  sessionForm = {
    courseId: '',
    date: new Date().toISOString().split('T')[0],
  };
  sessionStudents: User[] = [];
  sessionRecords: AttendanceRecord[] = [];

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.loading = true;
    this.sessions = this.lmsService.getAttendanceSessions();

    this.lmsService.getCourses().subscribe({
      next: (courses) => {
        this.courses = courses;
        // Pre-load enrollments
        if (courses.length === 0) { this.loading = false; return; }
        const calls = courses.map(c =>
          this.lmsService.getCourseEnrollments(c.id).pipe(catchError(() => of([])))
        );
        forkJoin(calls).subscribe({
          next: (allEnrolls) => {
            courses.forEach((c, i) => {
              this.allEnrollments[c.id] = allEnrolls[i] as Enrollment[];
            });
            this.loading = false;
          },
          error: () => { this.loading = false; }
        });
      },
      error: (err) => {
        this.notify.showError(`Failed to load courses: ${err.message}`);
        this.loading = false;
      }
    });
  }

  openNewSessionDialog(): void {
    this.editingSession = null;
    this.sessionForm = { courseId: '', date: new Date().toISOString().split('T')[0] };
    this.sessionStudents = [];
    this.sessionRecords = [];
    this.showSessionDialog = true;
  }

  editSession(session: AttendanceSession): void {
    this.editingSession = session;
    this.sessionForm = { courseId: session.courseId, date: session.date };
    this.sessionRecords = session.records.map(r => ({ ...r }));
    const enrolls = this.allEnrollments[session.courseId] || [];
    this.sessionStudents = enrolls.map(e => ({ id: e.studentId, name: e.studentName || '' } as any));
    this.showSessionDialog = true;
  }

  onCourseSelected(courseId: string): void {
    const enrolls = this.allEnrollments[courseId] || [];
    this.sessionStudents = enrolls.map(e => ({ id: e.studentId, name: e.studentName || '' } as any));
    this.sessionRecords = enrolls.map(e => ({
      studentId: e.studentId,
      studentName: e.studentName || 'Unknown',
      present: true,
    }));
  }

  setAll(present: boolean): void {
    this.sessionRecords = this.sessionRecords.map(r => ({ ...r, present }));
  }

  saveSession(): void {
    const course = this.courses.find(c => c.id === this.sessionForm.courseId);
    if (this.editingSession) {
      const updated: AttendanceSession = {
        ...this.editingSession,
        courseId: this.sessionForm.courseId,
        courseTitle: course?.title,
        date: this.sessionForm.date,
        records: this.sessionRecords,
      };
      this.lmsService.updateAttendanceSession(updated);
      this.notify.showSuccess('Session updated successfully!');
    } else {
      this.lmsService.createAttendanceSession({
        courseId: this.sessionForm.courseId,
        courseTitle: course?.title,
        date: this.sessionForm.date,
        records: this.sessionRecords,
      });
      this.notify.showSuccess('Attendance session created!');
    }
    this.sessions = this.lmsService.getAttendanceSessions();
    this.showSessionDialog = false;
  }

  confirmDelete(session: AttendanceSession): void {
    this.deletingSession = session;
    this.showDeleteConfirm = true;
  }

  deleteSession(): void {
    if (!this.deletingSession) return;
    this.lmsService.deleteAttendanceSession(this.deletingSession.id);
    this.sessions = this.lmsService.getAttendanceSessions();
    this.notify.showSuccess('Session deleted.');
    this.showDeleteConfirm = false;
    this.deletingSession = null;
  }

  getPresentCount(session: AttendanceSession): number {
    return session.records.filter(r => r.present).length;
  }

  getAbsentCount(session: AttendanceSession): number {
    return session.records.filter(r => !r.present).length;
  }

  get totalPresent(): number {
    return this.sessions.reduce((sum, s) => sum + this.getPresentCount(s), 0);
  }

  get totalAbsent(): number {
    return this.sessions.reduce((sum, s) => sum + this.getAbsentCount(s), 0);
  }

  getInitials(name: string): string {
    return name?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  }
}
