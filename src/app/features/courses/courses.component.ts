import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, Course, User } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';

// PrimeNG Modules
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

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
            placeholder="Search by course title, syllabus or instructor..." 
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border-[#cbd5e1] hover:border-violet-500 focus:border-violet-500" />
        </span>
      </div>

      <!-- Courses Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (course of filteredCourses; track course.id) {
          <div class="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_24px_rgba(139,92,246,0.1)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col h-[280px]">
            <!-- Cover Top -->
            <div class="h-24 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 p-5 flex items-end shrink-0 border-b border-[#f1f5f9]">
              <span class="text-[10px] font-bold text-violet-600 bg-violet-100/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Syllabus
              </span>
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
                <span class="inline-flex items-center gap-1 font-bold text-cyan-600">
                  <i class="pi pi-users"></i>
                  {{ course.enrollments?.length || 0 }} Enrolled
                </span>
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
            <input 
              pInputText 
              type="text" 
              [(ngModel)]="newCourse.title" 
              name="title" 
              placeholder="e.g. Advanced Distributed Systems" 
              required 
              class="w-full" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Description</label>
            <textarea 
              pInputText 
              rows="4" 
              [(ngModel)]="newCourse.description" 
              name="description" 
              placeholder="Outline of syllabus and credentials required..." 
              required 
              class="w-full rounded-xl border-[#cbd5e1] p-3 text-sm focus:border-violet-500 focus:outline-none"></textarea>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Assign Instructor</label>
            <p-select 
              [options]="instructors" 
              [(ngModel)]="newCourse.instructorId" 
              name="instructorId"
              optionLabel="name" 
              optionValue="id" 
              placeholder="-- Choose Instructor --" 
              styleClass="w-full"
              [filter]="true"
              filterBy="name">
            </p-select>
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9] mt-3">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showCreateDialog = false"></button>
            <button pButton type="submit" label="Create Course" class="p-button-primary cursor-pointer" [disabled]="!newCourse.title || !newCourse.description || !newCourse.instructorId"></button>
          </div>
        </form>
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-select {
        border-radius: 10px;
        border-color: #cbd5e1;
      }
      .p-button {
        border-radius: 10px;
        font-weight: 600;
      }
      .p-dialog {
        border-radius: 16px;
      }
    }
  `
})
export class CoursesComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);

  courses: Course[] = [];
  instructors: User[] = [];
  searchQuery = '';
  showCreateDialog = false;

  newCourse = {
    title: '',
    description: '',
    instructorId: ''
  };

  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.lmsService.getCourses().subscribe({
      next: (courses) => {
        this.courses = courses;
        this.courses.forEach(course => {
          this.lmsService.getCourseEnrollments(course.id).subscribe(enrolls => {
            course.enrollments = enrolls;
          });
        });
      },
      error: (err) => {
        this.notify.showError(`Failed to load courses: ${err.message}`);
      }
    });

    this.lmsService.getUsers().subscribe({
      next: (users) => {
        this.instructors = users.filter(u => u.role === 2);
      }
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
    this.newCourse = { title: '', description: '', instructorId: '' };
    this.showCreateDialog = true;
  }

  createCourse(event: Event): void {
    event.preventDefault();
    if (!this.newCourse.title || !this.newCourse.description || !this.newCourse.instructorId) return;

    this.lmsService.createCourse(this.newCourse).subscribe({
      next: (course) => {
        this.notify.showSuccess(`Course "${course.title}" created successfully!`);
        this.showCreateDialog = false;
        this.loadData();
      },
      error: (err) => {
        this.notify.showError(`Failed to publish course: ${err.message}`);
      }
    });
  }
}
