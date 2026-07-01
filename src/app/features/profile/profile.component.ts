import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LmsService, Course, Enrollment } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { User } from '../../core/models/User';
import { Role } from '../../core/interfaces/Role';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    SkeletonModule,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-4xl mx-auto min-h-screen">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">My Profile</h1>
        <p class="text-sm text-[#64748b] mt-1">View and manage your account information</p>
      </div>

      @if (user) {
        <!-- Profile card -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden mb-8">
          <!-- Gradient header strip -->
          <div class="h-28 bg-gradient-to-r from-violet-500/20 via-indigo-500/15 to-cyan-500/20 relative">
            <!-- Avatar -->
            <div
              class="absolute -bottom-7 left-8 w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold border-4 border-white shadow-lg"
              [class]="avatarClass">
              {{ initials }}
            </div>
          </div>

          <!-- Content -->
          <div class="px-8 pt-12 pb-7">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 class="text-2xl font-extrabold text-[#1e293b]">{{ user.name }}</h2>
                <p class="text-sm text-[#64748b] mt-0.5">{{ user.email }}</p>
                <span
                  class="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mt-2 inline-block border"
                  [class]="roleBadgeClass">
                  {{ user.role }}
                </span>
              </div>
              <button
                pButton
                type="button"
                icon="pi pi-pencil"
                label="Edit Profile"
                class="p-button-outlined p-button-secondary cursor-pointer shrink-0"
                (click)="openEditDialog()">
              </button>
            </div>
          </div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <p class="text-2xl font-bold text-violet-600">{{ enrollments.length }}</p>
            <p class="text-xs text-[#94a3b8] font-semibold uppercase tracking-wider mt-1">
              {{ isStudent ? 'Courses' : 'Assigned' }}
            </p>
          </div>
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <p class="text-2xl font-bold text-emerald-600">{{ avgProgress }}%</p>
            <p class="text-xs text-[#94a3b8] font-semibold uppercase tracking-wider mt-1">
              {{ isStudent ? 'Avg Progress' : 'Completion' }}
            </p>
          </div>
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <p class="text-2xl font-bold text-cyan-600">{{ completedCount }}</p>
            <p class="text-xs text-[#94a3b8] font-semibold uppercase tracking-wider mt-1">Completed</p>
          </div>
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <p class="text-2xl font-bold text-[#1e293b]">{{ user.role }}</p>
            <p class="text-xs text-[#94a3b8] font-semibold uppercase tracking-wider mt-1">Role</p>
          </div>
        </div>

        <!-- Courses/Enrollment section -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
          <h3 class="text-lg font-bold text-[#1e293b] mb-5 pb-4 border-b border-[#f1f5f9]">
            {{ isStudent ? 'My Enrolled Courses' : 'My Courses' }}
          </h3>

          @if (loadingEnrollments) {
            <div class="flex flex-col gap-3">
              @for (i of [1,2,3]; track i) {
                <div class="flex items-center gap-4 p-4 border border-[#e2e8f0] rounded-xl">
                  <p-skeleton shape="circle" size="40px" />
                  <div class="flex-1">
                    <p-skeleton width="50%" height="14px" styleClass="mb-2" />
                    <p-skeleton width="80%" height="10px" />
                  </div>
                </div>
              }
            </div>
          } @else if (enrollments.length === 0 && assignedCourses.length === 0) {
            <div class="text-center py-12 text-sm text-[#94a3b8]">
              <i class="pi pi-book text-4xl text-[#cbd5e1] mb-3 block"></i>
              {{ isStudent ? 'You are not enrolled in any courses yet.' : 'No courses assigned to you yet.' }}
            </div>
          } @else {
            <div class="flex flex-col gap-3">
              @if (isStudent) {
                @for (enroll of enrollments; track enroll.id) {
                  <div class="flex items-center gap-4 p-4 border border-[#e2e8f0] rounded-xl hover:border-violet-300 hover:bg-violet-50/30 transition-all duration-200">
                    <div class="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <i class="pi pi-book text-sm"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-[#1e293b] truncate">{{ enroll.courseTitle || 'Course' }}</p>
                      <p class="text-xs text-[#94a3b8]">Enrolled {{ enroll.enrollmentDate | date:'mediumDate' }}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      <span class="text-xs font-bold" [class]="getProgressColor(enroll.progressPercentage)">
                        {{ enroll.progressPercentage }}%
                      </span>
                      <div class="w-20 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-500" [style.width.%]="enroll.progressPercentage" [class]="getBarColor(enroll.progressPercentage)"></div>
                      </div>
                    </div>
                  </div>
                }
              } @else {
                @for (course of assignedCourses; track course.id) {
                  <div class="flex items-center gap-4 p-4 border border-[#e2e8f0] rounded-xl hover:border-violet-300 hover:bg-violet-50/30 transition-all duration-200">
                    <div class="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <i class="pi pi-book text-sm"></i>
                    </div>
                    <div class="flex-1">
                      <p class="text-sm font-bold text-[#1e293b]">{{ course.title }}</p>
                      <p class="text-xs text-[#94a3b8]">{{ course.enrollments?.length || 0 }} students enrolled</p>
                    </div>
                    <span class="text-[10px] font-bold text-violet-600 bg-violet-100 px-2.5 py-1 rounded-full uppercase shrink-0">
                      Instructor
                    </span>
                  </div>
                }
              }
            </div>
          }
        </div>
      }

      <!-- Edit Profile Dialog -->
      <p-dialog
        header="Edit Profile"
        [(visible)]="showEditDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        [draggable]="false"
        [resizable]="false">
        <div class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Display Name</label>
            <input
              pInputText
              type="text"
              [(ngModel)]="editName"
              placeholder="Your full name"
              class="w-full" />
          </div>
          <p class="text-xs text-[#94a3b8] bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0]">
            <i class="pi pi-info-circle mr-1"></i>
            Email and role changes require an administrator.
          </p>
          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showEditDialog = false"></button>
            <button pButton type="button" label="Save" icon="pi pi-check" class="p-button-primary cursor-pointer" [disabled]="!editName.trim()" (click)="saveProfile()"></button>
          </div>
        </div>
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-button { border-radius: 10px; font-weight: 600; }
      .p-dialog { border-radius: 16px; overflow: hidden; }
    }
  `
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  user: User | null = null;
  loadingEnrollments = true;
  enrollments: Enrollment[] = [];
  assignedCourses: Course[] = [];

  showEditDialog = false;
  editName = '';

  ngOnInit(): void {
    this.user = this.authService.currentUser;
    if (isPlatformBrowser(this.platformId)) {
      this.loadEnrollments();
    }
  }

  loadEnrollments(): void {
    if (!this.user) { this.loadingEnrollments = false; return; }
    this.loadingEnrollments = true;

    if (this.isStudent) {
      this.lmsService.getStudentEnrollments(String(this.user.id)).subscribe({
        next: (enrolls) => {
          if (enrolls.length > 0) {
            this.enrollments = enrolls;
            this.loadingEnrollments = false;
          } else {
            this.fallbackEnrollments();
          }
        },
        error: () => { this.fallbackEnrollments(); }
      });
    } else {
      // Instructor / Admin: show assigned courses
      this.lmsService.getCourses().subscribe({
        next: (courses) => {
          this.assignedCourses = this.user?.role === Role.Instructor
            ? courses // For real instructor matching we'd need lms user id
            : courses;
          this.loadingEnrollments = false;
        },
        error: () => { this.loadingEnrollments = false; }
      });
    }
  }

  private fallbackEnrollments(): void {
    this.lmsService.getCourses().subscribe({
      next: (courses) => {
        if (courses.length === 0) { this.loadingEnrollments = false; return; }
        const calls = courses.map(c =>
          this.lmsService.getCourseEnrollments(c.id).pipe(catchError(() => of([])))
        );
        forkJoin(calls).subscribe({
          next: (allEnrolls) => {
            const result: Enrollment[] = [];
            courses.forEach((course, i) => {
              // We try matching by name since auth user id ≠ lms user id
              const enrolls = allEnrolls[i] as Enrollment[];
              const match = enrolls.find(e =>
                e.studentName?.toLowerCase() === this.user?.name?.toLowerCase()
              );
              if (match) result.push({ ...match, courseTitle: course.title });
            });
            this.enrollments = result;
            this.loadingEnrollments = false;
          },
          error: () => { this.loadingEnrollments = false; }
        });
      },
      error: () => { this.loadingEnrollments = false; }
    });
  }

  openEditDialog(): void {
    this.editName = this.user?.name || '';
    this.showEditDialog = true;
  }

  saveProfile(): void {
    if (!this.editName.trim() || !this.user) return;
    // Update locally in auth session
    const updated: User = { ...this.user, name: this.editName.trim() };
    this.authService.login(updated, this.authService.getToken() || '');
    this.user = updated;
    this.notify.showSuccess('Profile updated!');
    this.showEditDialog = false;
  }

  get isStudent(): boolean {
    return this.user?.role === Role.Student;
  }

  get initials(): string {
    return this.user?.name?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'U';
  }

  get avatarClass(): string {
    switch (this.user?.role) {
      case Role.Admin: return 'bg-violet-100 text-violet-700';
      case Role.Instructor: return 'bg-rose-100 text-rose-600';
      case Role.Student: return 'bg-cyan-100 text-cyan-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  get roleBadgeClass(): string {
    switch (this.user?.role) {
      case Role.Admin: return 'bg-violet-100 text-violet-700 border-violet-200';
      case Role.Instructor: return 'bg-rose-100 text-rose-600 border-rose-200';
      case Role.Student: return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  get avgProgress(): number {
    if (!this.enrollments.length) return 0;
    return Math.round(this.enrollments.reduce((s, e) => s + (e.progressPercentage || 0), 0) / this.enrollments.length);
  }

  get completedCount(): number {
    return this.enrollments.filter(e => e.progressPercentage >= 100).length;
  }

  getProgressColor(pct: number): string {
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 40) return 'text-violet-600';
    return 'text-amber-500';
  }

  getBarColor(pct: number): string {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-violet-500';
    return 'bg-amber-400';
  }
}
