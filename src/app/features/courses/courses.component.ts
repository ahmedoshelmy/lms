import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, Course, User, Enrollment } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// PrimeNG Modules
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">Courses Catalog</h1>
          <p class="text-sm text-[#64748b] mt-1">Manage platform syllabus and course catalogs</p>
        </div>
        <div>
          <button
            pButton
            type="button"
            label="New Course"
            icon="pi pi-plus"
            class="p-button-primary cursor-pointer w-full sm:w-auto"
            (click)="openCreateDialog()">
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="mb-8 max-w-md">
        <span class="p-input-icon-left w-full relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
          <input
            pInputText
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search by course title, description or instructor..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border-[#cbd5e1] hover:border-violet-500 focus:border-violet-500" />
        </span>
      </div>

      <!-- Skeleton Loading -->
      @if (loading) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden">
              <div class="h-24 bg-[#f8fafc]"></div>
              <div class="p-5">
                <p-skeleton width="70%" height="16px" styleClass="mb-2" />
                <p-skeleton width="100%" height="12px" styleClass="mb-1" />
                <p-skeleton width="80%" height="12px" styleClass="mb-4" />
                <div class="flex justify-between">
                  <p-skeleton width="100px" height="12px" />
                  <p-skeleton width="80px" height="12px" />
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Courses Grid -->
      @if (!loading) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (course of filteredCourses; track course.id) {
            <div class="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_24px_rgba(139,92,246,0.1)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col group">
              <!-- Cover Top -->
              <div class="h-24 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 p-5 flex items-end justify-between shrink-0 border-b border-[#f1f5f9]">
                <span class="text-[10px] font-bold text-violet-600 bg-violet-100/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Syllabus
                </span>
                <!-- Action buttons (show on hover) -->
                <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    pButton
                    type="button"
                    icon="pi pi-users"
                    class="p-button-sm p-button-text p-button-secondary cursor-pointer !rounded-lg !p-1.5"
                    title="View enrolled students"
                    (click)="viewEnrollments(course); $event.stopPropagation()">
                  </button>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-pencil"
                    class="p-button-sm p-button-text cursor-pointer !rounded-lg !p-1.5"
                    title="Edit course"
                    (click)="openEditDialog(course); $event.stopPropagation()">
                  </button>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-trash"
                    class="p-button-sm p-button-text p-button-danger cursor-pointer !rounded-lg !p-1.5"
                    title="Delete course"
                    (click)="confirmDelete(course); $event.stopPropagation()">
                  </button>
                </div>
              </div>

              <!-- Body -->
              <div class="p-5 flex flex-col justify-between flex-grow">
                <div>
                  <h3 class="text-base font-bold text-[#1e293b] line-clamp-1 mb-1.5">{{ course.title }}</h3>
                  <p class="text-xs text-[#64748b] leading-relaxed line-clamp-3 mb-4">{{ course.description }}</p>
                </div>

                <div class="flex items-center justify-between text-xs text-[#94a3b8] pt-3 border-t border-[#f1f5f9]">
                  <span class="inline-flex items-center gap-1.5 font-semibold text-[#64748b]">
                    <i class="pi pi-user-edit text-violet-500"></i>
                    {{ course.instructorName || 'Unknown Instructor' }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-bold text-cyan-600 hover:text-cyan-800 cursor-pointer transition-colors duration-200"
                    (click)="viewEnrollments(course)">
                    <i class="pi pi-users"></i>
                    {{ course.enrollments?.length || 0 }} Enrolled
                  </button>
                </div>
              </div>
            </div>
          } @empty {
            <div class="col-span-full bg-white border border-[#e2e8f0] rounded-2xl p-12 text-center text-sm text-[#94a3b8]">
              <i class="pi pi-folder-open text-4xl text-[#cbd5e1] mb-3 block"></i>
              No courses found. Click "New Course" to publish your first syllabus!
            </div>
          }
        </div>
      }

      <!-- Dialog: Create Course -->
      <p-dialog
        header="Create New Course"
        [(visible)]="showCreateDialog"
        [modal]="true"
        [style]="{ width: '500px' }"
        [draggable]="false"
        [resizable]="false">
        <form (submit)="createCourse($event)" class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Course Title</label>
            <input pInputText type="text" [(ngModel)]="courseForm.title" name="title" placeholder="e.g. Advanced Distributed Systems" required class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Description</label>
            <textarea pInputText rows="4" [(ngModel)]="courseForm.description" name="description" placeholder="Outline of syllabus and credentials required..." required class="w-full rounded-xl border-[#cbd5e1] p-3 text-sm focus:border-violet-500 focus:outline-none"></textarea>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Assign Instructor</label>
            <p-select [options]="instructors" [(ngModel)]="courseForm.instructorId" name="instructorId" optionLabel="name" optionValue="id" placeholder="-- Choose Instructor --" styleClass="w-full" [filter]="true" filterBy="name"></p-select>
          </div>
          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9] mt-3">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showCreateDialog = false"></button>
            <button pButton type="submit" label="Create Course" class="p-button-primary cursor-pointer" [disabled]="!courseForm.title || !courseForm.description || !courseForm.instructorId"></button>
          </div>
        </form>
      </p-dialog>

      <!-- Dialog: Edit Course -->
      <p-dialog
        header="Edit Course"
        [(visible)]="showEditDialog"
        [modal]="true"
        [style]="{ width: '500px' }"
        [draggable]="false"
        [resizable]="false">
        <form (submit)="updateCourse($event)" class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Course Title</label>
            <input pInputText type="text" [(ngModel)]="courseForm.title" name="editTitle" required class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Description</label>
            <textarea pInputText rows="4" [(ngModel)]="courseForm.description" name="editDescription" required class="w-full rounded-xl border-[#cbd5e1] p-3 text-sm focus:border-violet-500 focus:outline-none"></textarea>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Assign Instructor</label>
            <p-select [options]="instructors" [(ngModel)]="courseForm.instructorId" name="editInstructorId" optionLabel="name" optionValue="id" placeholder="-- Choose Instructor --" styleClass="w-full" [filter]="true" filterBy="name"></p-select>
          </div>
          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9] mt-3">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showEditDialog = false"></button>
            <button pButton type="submit" label="Save Changes" icon="pi pi-check" class="p-button-primary cursor-pointer" [disabled]="!courseForm.title || !courseForm.description || !courseForm.instructorId"></button>
          </div>
        </form>
      </p-dialog>

      <!-- Dialog: Delete Confirm -->
      <p-dialog
        header="Delete Course"
        [(visible)]="showDeleteConfirm"
        [modal]="true"
        [style]="{ width: '380px' }"
        [draggable]="false"
        [resizable]="false">
        <p class="text-sm text-[#64748b] py-3">
          Are you sure you want to delete <strong>{{ deletingCourse?.title }}</strong>? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
          <button pButton type="button" label="Cancel" class="p-button-text cursor-pointer" (click)="showDeleteConfirm = false"></button>
          <button pButton type="button" label="Delete" icon="pi pi-trash" class="p-button-danger cursor-pointer" (click)="deleteCourse()"></button>
        </div>
      </p-dialog>

      <!-- Dialog: Enrolled Students -->
      <p-dialog
        [header]="selectedCourse?.title + ' — Enrolled Students'"
        [(visible)]="showEnrollmentsDialog"
        [modal]="true"
        [style]="{ width: '500px', maxWidth: '95vw' }"
        [draggable]="false"
        [resizable]="false">
        @if (selectedCourse) {
          <div class="py-2">
            @if ((selectedCourse.enrollments?.length || 0) === 0) {
              <p class="text-sm text-[#94a3b8] text-center py-8">No students enrolled in this course yet.</p>
            } @else {
              <div class="flex flex-col gap-3 max-h-80 overflow-y-auto">
                @for (enrollment of selectedCourse.enrollments; track enrollment.id) {
                  <div class="flex items-center justify-between p-3.5 border border-[#e2e8f0] rounded-xl">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-cyan-100 text-cyan-700 font-bold text-sm flex items-center justify-center">
                        {{ getInitials(enrollment.studentName || 'S') }}
                      </div>
                      <div>
                        <p class="text-sm font-semibold text-[#1e293b]">{{ enrollment.studentName || 'Student' }}</p>
                        <p class="text-xs text-[#94a3b8]">Enrolled {{ enrollment.enrollmentDate | date:'mediumDate' }}</p>
                      </div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                      <span class="text-xs font-bold" [class]="getProgressTagClass(enrollment.progressPercentage)">
                        {{ enrollment.progressPercentage }}%
                      </span>
                      <div class="w-20 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div class="h-full rounded-full" [style.width.%]="enrollment.progressPercentage" [class]="getProgressBarClass(enrollment.progressPercentage)"></div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-select { border-radius: 10px; border-color: #cbd5e1; }
      .p-button { border-radius: 10px; font-weight: 600; }
      .p-dialog { border-radius: 16px; }
    }
  `
})
export class CoursesComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  courses: Course[] = [];
  instructors: User[] = [];
  searchQuery = '';
  loading = true;

  showCreateDialog = false;
  showEditDialog = false;
  showDeleteConfirm = false;
  showEnrollmentsDialog = false;

  editingCourse: Course | null = null;
  deletingCourse: Course | null = null;
  selectedCourse: Course | null = null;

  courseForm = { title: '', description: '', instructorId: '' };

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.loading = true;
    this.lmsService.getCourses().subscribe({
      next: (courses) => {
        this.courses = courses;
        // Load enrollments for all courses
        const calls = courses.map(c =>
          this.lmsService.getCourseEnrollments(c.id).pipe(catchError(() => of([])))
        );
        if (courses.length === 0) { this.loading = false; return; }
        forkJoin(calls).subscribe({
          next: (allEnrolls) => {
            this.courses.forEach((course, i) => {
              course.enrollments = allEnrolls[i] as Enrollment[];
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

    this.lmsService.getUsers().subscribe({
      next: (users) => { this.instructors = users.filter(u => u.role === 2); }
    });
  }

  get filteredCourses(): Course[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.courses;
    return this.courses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c.instructorName && c.instructorName.toLowerCase().includes(q))
    );
  }

  openCreateDialog(): void {
    this.courseForm = { title: '', description: '', instructorId: '' };
    this.showCreateDialog = true;
  }

  openEditDialog(course: Course): void {
    this.editingCourse = course;
    this.courseForm = {
      title: course.title,
      description: course.description,
      instructorId: course.instructorId,
    };
    this.showEditDialog = true;
  }

  confirmDelete(course: Course): void {
    this.deletingCourse = course;
    this.showDeleteConfirm = true;
  }

  viewEnrollments(course: Course): void {
    this.selectedCourse = course;
    this.showEnrollmentsDialog = true;
  }

  createCourse(event: Event): void {
    event.preventDefault();
    if (!this.courseForm.title || !this.courseForm.description || !this.courseForm.instructorId) return;
    this.lmsService.createCourse(this.courseForm).subscribe({
      next: (course) => {
        this.notify.showSuccess(`Course "${course.title}" created successfully!`);
        this.showCreateDialog = false;
        this.loadData();
      },
      error: (err) => { this.notify.showError(`Failed to publish course: ${err.message}`); }
    });
  }

  updateCourse(event: Event): void {
    event.preventDefault();
    if (!this.editingCourse) return;
    this.lmsService.updateCourse(this.editingCourse.id, this.courseForm).subscribe({
      next: () => {
        this.notify.showSuccess('Course updated successfully!');
        this.showEditDialog = false;
        this.loadData();
      },
      error: (err) => { this.notify.showError(`Failed to update course: ${err.message}`); }
    });
  }

  deleteCourse(): void {
    if (!this.deletingCourse) return;
    this.lmsService.deleteCourse(this.deletingCourse.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Course "${this.deletingCourse!.title}" deleted.`);
        this.showDeleteConfirm = false;
        this.deletingCourse = null;
        this.loadData();
      },
      error: (err) => { this.notify.showError(`Failed to delete course: ${err.message}`); }
    });
  }

  getInitials(name: string): string {
    return name?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  getProgressTagClass(pct: number): string {
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 40) return 'text-violet-600';
    return 'text-amber-500';
  }

  getProgressBarClass(pct: number): string {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-violet-500';
    return 'bg-amber-400';
  }
}
