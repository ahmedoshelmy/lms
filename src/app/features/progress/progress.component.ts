import { Component, OnInit, inject, PLATFORM_ID, computed, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, User, Course, Enrollment } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// PrimeNG
import { ProgressBarModule } from 'primeng/progressbar';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

interface StudentProgress {
  student: User;
  enrollments: Enrollment[];
  avgProgress: number;
  completedCount: number;
}

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProgressBarModule,
    AvatarModule,
    TagModule,
    SkeletonModule,
    InputTextModule,
    SelectModule,
    DialogModule,
    ButtonModule,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">Student Progress</h1>
          <p class="text-sm text-[#64748b] mt-1">Track enrollment progress across all platform courses</p>
        </div>
        <button
          pButton
          type="button"
          icon="pi pi-refresh"
          label="Refresh"
          class="p-button-outlined p-button-secondary cursor-pointer"
          (click)="loadData()">
        </button>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span class="text-2xl font-bold text-[#1e293b]">{{ studentProgress.length }}</span>
          <span class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Total Students</span>
        </div>
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span class="text-2xl font-bold text-violet-600">{{ totalEnrollments }}</span>
          <span class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Enrollments</span>
        </div>
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span class="text-2xl font-bold text-emerald-600">{{ overallAvgProgress }}%</span>
          <span class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Avg Progress</span>
        </div>
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span class="text-2xl font-bold text-cyan-600">{{ topPerformers.length }}</span>
          <span class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Top Performers</span>
        </div>
      </div>

      <!-- Search + Filter row -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <span class="p-input-icon-left relative flex-1 max-w-sm">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
          <input
            pInputText
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search students..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border-[#cbd5e1]" />
        </span>
        <p-select
          [options]="filterOptions"
          [(ngModel)]="filterBy"
          optionLabel="label"
          optionValue="value"
          styleClass="rounded-xl min-w-[160px]">
        </p-select>
      </div>

      <!-- Skeleton Loading -->
      @if (loading) {
        <div class="flex flex-col gap-4">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div class="flex items-center gap-4 mb-4">
                <p-skeleton shape="circle" size="44px" />
                <div class="flex-1">
                  <p-skeleton width="40%" height="14px" styleClass="mb-2" />
                  <p-skeleton width="60%" height="12px" />
                </div>
                <p-skeleton width="80px" height="24px" borderRadius="999px" />
              </div>
              <p-skeleton width="100%" height="8px" borderRadius="4px" />
            </div>
          }
        </div>
      }

      <!-- Progress List -->
      @if (!loading) {
        @if (filteredProgress.length === 0) {
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-16 text-center text-sm text-[#94a3b8]">
            <i class="pi pi-chart-line text-4xl text-[#cbd5e1] mb-3 block"></i>
            No progress data found.
          </div>
        } @else {
          <div class="flex flex-col gap-4">
            @for (sp of filteredProgress; track sp.student.id) {
              <div
                class="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.08)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                (click)="openDetail(sp)">
                <div class="flex items-center gap-4 mb-4">
                  <!-- Avatar -->
                  <div
                    class="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    [class]="getAvatarClass(sp.avgProgress)">
                    {{ getInitials(sp.student.name) }}
                  </div>
                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-[#1e293b] truncate">{{ sp.student.name }}</p>
                    <p class="text-xs text-[#94a3b8] truncate">{{ sp.student.email }}</p>
                  </div>
                  <!-- Stats -->
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="text-xs text-[#64748b]">{{ sp.enrollments.length }} course{{ sp.enrollments.length !== 1 ? 's' : '' }}</span>
                    <span
                      class="px-2.5 py-1 rounded-full text-xs font-bold"
                      [class]="getTagClass(sp.avgProgress)">
                      {{ sp.avgProgress }}%
                    </span>
                  </div>
                </div>

                <!-- Overall progress bar -->
                <div class="relative">
                  <div class="flex justify-between text-[10px] text-[#94a3b8] mb-1.5">
                    <span>Overall Progress</span>
                    <span>{{ sp.completedCount }} / {{ sp.enrollments.length }} completed</span>
                  </div>
                  <div class="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      [style.width.%]="sp.avgProgress"
                      [class]="getBarClass(sp.avgProgress)">
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- Detail Dialog -->
      <p-dialog
        [header]="selectedProgress?.student?.name + ' — Progress Detail'"
        [(visible)]="showDetail"
        [modal]="true"
        [style]="{ width: '560px', maxWidth: '95vw' }"
        [draggable]="false"
        [resizable]="false">
        @if (selectedProgress) {
          <div class="flex flex-col gap-4 py-2">
            <!-- Student card -->
            <div class="flex items-center gap-4 p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                [class]="getAvatarClass(selectedProgress.avgProgress)">
                {{ getInitials(selectedProgress.student.name) }}
              </div>
              <div>
                <p class="font-bold text-[#1e293b]">{{ selectedProgress.student.name }}</p>
                <p class="text-xs text-[#94a3b8]">{{ selectedProgress.student.email }}</p>
              </div>
              <div class="ml-auto">
                <span
                  class="px-3 py-1.5 rounded-full text-sm font-bold"
                  [class]="getTagClass(selectedProgress.avgProgress)">
                  {{ selectedProgress.avgProgress }}% avg
                </span>
              </div>
            </div>

            <!-- Per-course progress -->
            <div class="flex flex-col gap-3">
              @if (selectedProgress.enrollments.length === 0) {
                <p class="text-sm text-[#94a3b8] text-center py-4">Not enrolled in any courses yet.</p>
              }
              @for (enroll of selectedProgress.enrollments; track enroll.id) {
                <div class="p-4 border border-[#e2e8f0] rounded-xl">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-sm font-semibold text-[#1e293b] truncate flex-1 mr-3">
                      {{ enroll.courseTitle || 'Course #' + enroll.courseId.slice(0, 6) }}
                    </p>
                    <span class="text-xs font-bold shrink-0" [class]="getTagClass(enroll.progressPercentage)">
                      {{ enroll.progressPercentage }}%
                    </span>
                  </div>
                  <div class="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      [style.width.%]="enroll.progressPercentage"
                      [class]="getBarClass(enroll.progressPercentage)">
                    </div>
                  </div>
                  <p class="text-[10px] text-[#94a3b8] mt-1.5">Enrolled {{ enroll.enrollmentDate | date:'mediumDate' }}</p>
                </div>
              }
            </div>
          </div>
        }
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-select { border-radius: 10px; border-color: #cbd5e1; }
      .p-button { border-radius: 10px; font-weight: 600; }
      .p-dialog { border-radius: 16px; overflow: hidden; }
      .p-progressbar { border-radius: 4px; height: 8px; }
    }
  `
})
export class ProgressComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  loading = true;
  studentProgress: StudentProgress[] = [];
  searchQuery = '';
  filterBy = 'all';
  showDetail = false;
  selectedProgress: StudentProgress | null = null;

  filterOptions = [
    { label: 'All Students', value: 'all' },
    { label: 'Top Performers (≥80%)', value: 'top' },
    { label: 'At Risk (<40%)', value: 'risk' },
    { label: 'Not Started (0%)', value: 'none' },
  ];

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.loading = true;
    this.studentProgress = [];

    this.lmsService.getUsers().subscribe({
      next: (users) => {
        const students = users.filter(u => u.role === 1);

        if (students.length === 0) {
          this.loading = false;
          return;
        }

        const calls = students.map(s =>
          this.lmsService.getStudentEnrollments(s.id).pipe(catchError(() => of([])))
        );

        forkJoin(calls).subscribe({
          next: (allEnrollments) => {
            this.studentProgress = students.map((student, i) => {
              const enrollments = allEnrollments[i] as Enrollment[];
              const avgProgress = enrollments.length
                ? Math.round(enrollments.reduce((sum, e) => sum + (e.progressPercentage || 0), 0) / enrollments.length)
                : 0;
              const completedCount = enrollments.filter(e => e.progressPercentage >= 100).length;
              return { student, enrollments, avgProgress, completedCount };
            });
            this.loading = false;
          },
          error: () => {
            // Fallback: fetch per-course enrollments
            this.loadProgressFromCourses(students);
          }
        });
      },
      error: (err) => {
        this.notify.showError(`Failed to load users: ${err.message}`);
        this.loading = false;
      }
    });
  }

  /** Fallback: build progress from course enrollments */
  private loadProgressFromCourses(students: User[]): void {
    this.lmsService.getCourses().subscribe({
      next: (courses) => {
        if (courses.length === 0) {
          this.buildProgress(students, []);
          return;
        }

        const calls = courses.map(c =>
          this.lmsService.getCourseEnrollments(c.id).pipe(catchError(() => of([])))
        );

        forkJoin(calls).subscribe({
          next: (allEnrolls) => {
            // Merge all enrollments with course title
            const allEnrollments: Enrollment[] = [];
            courses.forEach((course, i) => {
              const enrolls = (allEnrolls[i] as Enrollment[]).map(e => ({
                ...e,
                courseTitle: course.title
              }));
              allEnrollments.push(...enrolls);
            });
            this.buildProgress(students, allEnrollments);
          },
          error: () => {
            this.buildProgress(students, []);
          }
        });
      },
      error: () => {
        this.buildProgress(students, []);
        this.loading = false;
      }
    });
  }

  private buildProgress(students: User[], allEnrollments: Enrollment[]): void {
    this.studentProgress = students.map(student => {
      const enrollments = allEnrollments.filter(e => e.studentId === student.id);
      const avgProgress = enrollments.length
        ? Math.round(enrollments.reduce((sum, e) => sum + (e.progressPercentage || 0), 0) / enrollments.length)
        : 0;
      const completedCount = enrollments.filter(e => e.progressPercentage >= 100).length;
      return { student, enrollments, avgProgress, completedCount };
    });
    this.loading = false;
  }

  get filteredProgress(): StudentProgress[] {
    let result = this.studentProgress;

    // Apply filter
    if (this.filterBy === 'top') result = result.filter(sp => sp.avgProgress >= 80);
    else if (this.filterBy === 'risk') result = result.filter(sp => sp.avgProgress < 40 && sp.enrollments.length > 0);
    else if (this.filterBy === 'none') result = result.filter(sp => sp.avgProgress === 0);

    // Apply search
    const q = this.searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(sp =>
        sp.student.name.toLowerCase().includes(q) ||
        sp.student.email.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => b.avgProgress - a.avgProgress);
  }

  get totalEnrollments(): number {
    return this.studentProgress.reduce((sum, sp) => sum + sp.enrollments.length, 0);
  }

  get overallAvgProgress(): number {
    if (!this.studentProgress.length) return 0;
    const total = this.studentProgress.reduce((sum, sp) => sum + sp.avgProgress, 0);
    return Math.round(total / this.studentProgress.length);
  }

  get topPerformers(): StudentProgress[] {
    return this.studentProgress.filter(sp => sp.avgProgress >= 80);
  }

  openDetail(sp: StudentProgress): void {
    this.selectedProgress = sp;
    this.showDetail = true;
  }

  getInitials(name: string): string {
    return name?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'U';
  }

  getAvatarClass(progress: number): string {
    if (progress >= 80) return 'bg-emerald-100 text-emerald-700';
    if (progress >= 50) return 'bg-violet-100 text-violet-700';
    if (progress >= 20) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-500';
  }

  getTagClass(progress: number): string {
    if (progress >= 80) return 'bg-emerald-100 text-emerald-700';
    if (progress >= 50) return 'bg-violet-100 text-violet-700';
    if (progress >= 20) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-500';
  }

  getBarClass(progress: number): string {
    if (progress >= 80) return 'bg-emerald-500';
    if (progress >= 50) return 'bg-violet-500';
    if (progress >= 20) return 'bg-amber-400';
    return 'bg-slate-300';
  }
}
