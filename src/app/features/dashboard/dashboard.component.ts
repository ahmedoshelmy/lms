import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LmsService, User, Course } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';

// PrimeNG Modules
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select'; // PrimeNG v21 uses 'select' instead of 'dropdown'
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DialogModule,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">Platform Overview</h1>
          <p class="text-sm text-[#64748b] mt-1">Real-time learning metrics and server config</p>
        </div>
        <div class="flex items-center gap-3">
          <button 
            pButton 
            type="button" 
            icon="pi pi-cog" 
            label="API Settings" 
            class="p-button-outlined p-button-secondary cursor-pointer"
            (click)="showSettings = true">
          </button>
          <button 
            pButton 
            type="button" 
            icon="pi pi-refresh" 
            label="Refresh Data" 
            class="p-button-primary cursor-pointer"
            (click)="loadData()">
          </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <!-- Courses Stat -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 flex items-center gap-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300">
          <div class="w-14 h-14 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-2xl shadow-[0_4px_12px_rgba(139,92,246,0.1)]">
            <i class="pi pi-book"></i>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-[#1e293b]">{{ courses.length }}</h3>
            <p class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mt-1">Total Courses</p>
          </div>
        </div>

        <!-- Students Stat -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 flex items-center gap-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300">
          <div class="w-14 h-14 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center text-2xl shadow-[0_4px_12px_rgba(6,182,212,0.1)]">
            <i class="pi pi-user-plus"></i>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-[#1e293b]">{{ students.length }}</h3>
            <p class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mt-1">Total Students</p>
          </div>
        </div>

        <!-- Instructors Stat -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 flex items-center gap-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300">
          <div class="w-14 h-14 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-2xl shadow-[0_4px_12px_rgba(244,63,94,0.1)]">
            <i class="pi pi-users"></i>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-[#1e293b]">{{ instructors.length }}</h3>
            <p class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mt-1">Instructors</p>
          </div>
        </div>

        <!-- Enrollments Stat -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 flex items-center gap-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300">
          <div class="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shadow-[0_4px_12px_rgba(16,185,129,0.1)]">
            <i class="pi pi-bookmark"></i>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-[#1e293b]">{{ totalEnrollments }}</h3>
            <p class="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mt-1">Enrollments</p>
          </div>
        </div>
      </div>

      <!-- Main Columns Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Recent Courses Column -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] lg:col-span-2 flex flex-col">
          <div class="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-5">
            <h2 class="text-lg font-bold text-[#1e293b]">Recent Courses</h2>
            <a routerLink="/courses" class="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors duration-200">View Catalog &rarr;</a>
          </div>
          
          <div class="flex-grow">
            <p-table [value]="recentCourses" [responsiveLayout]="'scroll'" styleClass="p-datatable-sm">
              <ng-template pTemplate="header">
                <tr>
                  <th class="text-xs font-bold text-[#64748b] bg-[#f8fafc]">Course Title</th>
                  <th class="text-xs font-bold text-[#64748b] bg-[#f8fafc]">Instructor</th>
                  <th class="text-xs font-bold text-[#64748b] bg-[#f8fafc]">Created</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-course>
                <tr class="hover:bg-[#f8fafc] transition-colors duration-150">
                  <td class="text-sm font-semibold text-[#1e293b] py-3.5">{{ course.title }}</td>
                  <td class="text-sm text-[#64748b] py-3.5">
                    <span class="inline-flex items-center gap-1.5">
                      <i class="pi pi-user text-xs text-violet-500"></i>
                      {{ course.instructorName || 'Unassigned' }}
                    </span>
                  </td>
                  <td class="text-xs text-[#94a3b8] py-3.5">{{ course.createdAt | date:'mediumDate' }}</td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptystate">
                <tr>
                  <td colspan="3" class="text-center text-[#94a3b8] py-8 text-sm">
                    No courses found. Head over to Courses tab to create one!
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>
        </div>

        <!-- Quick Enrollment Column -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col">
          <div class="border-b border-[#f1f5f9] pb-4 mb-5">
            <h2 class="text-lg font-bold text-[#1e293b]">Quick Enrollment</h2>
          </div>

          <form (submit)="enrollStudent($event)" class="flex flex-col gap-5 flex-grow justify-between">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-[#64748b]">Select Course</label>
                <p-select 
                  [options]="courses" 
                  [(ngModel)]="selectedCourseId" 
                  name="selectedCourse"
                  optionLabel="title" 
                  optionValue="id" 
                  placeholder="Choose Course" 
                  styleClass="w-full"
                  [filter]="true"
                  filterBy="title">
                </p-select>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-[#64748b]">Select Student</label>
                <p-select 
                  [options]="students" 
                  [(ngModel)]="selectedStudentId" 
                  name="selectedStudent"
                  optionLabel="name" 
                  optionValue="id" 
                  placeholder="Choose Student" 
                  styleClass="w-full"
                  [filter]="true"
                  filterBy="name">
                </p-select>
              </div>
            </div>

            <button 
              pButton 
              type="submit" 
              label="Enroll Student" 
              icon="pi pi-user-plus" 
              class="p-button-secondary w-full cursor-pointer mt-6"
              [disabled]="!selectedCourseId || !selectedStudentId">
            </button>
          </form>
        </div>
      </div>

      <!-- Dialog: API Settings -->
      <p-dialog 
        header="API Endpoint Settings" 
        [(visible)]="showSettings" 
        [modal]="true" 
        [style]="{ width: '450px' }" 
        [draggable]="false" 
        [resizable]="false">
        <div class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Backend Base URL</label>
            <input 
              pInputText 
              type="url" 
              [(ngModel)]="settingsApiUrl" 
              placeholder="e.g. https://mv-api.inite.tech/api" 
              class="w-full" />
            <span class="text-[11px] text-[#94a3b8]">Active Base API Endpoint: <code>{{ currentApiUrl }}</code></span>
          </div>
        </div>
        <ng-template pTemplate="footer">
          <div class="flex justify-end gap-2 pt-2">
            <button pButton type="button" label="Reset to Default" class="p-button-text p-button-secondary cursor-pointer" (click)="resetApi()"></button>
            <button pButton type="button" label="Save Endpoint" class="p-button-primary cursor-pointer" (click)="saveSettings()"></button>
          </div>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-select {
        border-radius: 10px;
        border-color: #cbd5e1;
        &:hover {
          border-color: #8b5cf6;
        }
        &.p-focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
      }
      .p-button {
        border-radius: 10px;
        font-weight: 600;
      }
      .p-datatable .p-datatable-thead > tr > th {
        border-bottom: 1px solid #e2e8f0;
      }
      .p-dialog {
        border-radius: 16px;
        overflow: hidden;
      }
    }
  `,
})
export class DashboardComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);

  users: User[] = [];
  courses: Course[] = [];
  students: User[] = [];
  instructors: User[] = [];
  recentCourses: Course[] = [];
  totalEnrollments = 0;

  selectedCourseId = '';
  selectedStudentId = '';

  // API Config settings
  showSettings = false;
  settingsApiUrl = '';
  currentApiUrl = '';

  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    this.lmsService.apiUrl$.subscribe(url => {
      this.currentApiUrl = url;
      this.settingsApiUrl = url;
    });
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.lmsService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.students = users.filter(u => u.role === 1);
        this.instructors = users.filter(u => u.role === 2);
        this.loadCourses();
      },
      error: (err) => {
        this.notify.showError(`Unreachable server: ${err.message || err.statusText}`);
      }
    });
  }

  loadCourses(): void {
    this.lmsService.getCourses().subscribe({
      next: (courses) => {
        this.courses = courses;
        
        // Sort and select 5 recent
        this.recentCourses = [...courses]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        // Fetch enrollments counts
        this.totalEnrollments = 0;
        this.courses.forEach(course => {
          this.lmsService.getCourseEnrollments(course.id).subscribe({
            next: (enrollments) => {
              course.enrollments = enrollments;
              this.totalEnrollments += enrollments.length;
            },
            error: () => {
              course.enrollments = [];
            }
          });
        });
      },
      error: (err) => {
        this.notify.showError(`Failed to load courses catalog: ${err.message}`);
      }
    });
  }

  enrollStudent(event: Event): void {
    event.preventDefault();
    if (!this.selectedCourseId || !this.selectedStudentId) return;

    this.lmsService.enrollStudent(this.selectedCourseId, this.selectedStudentId).subscribe({
      next: (res) => {
        this.notify.showSuccess(`Enrolled student ${res.studentName || 'successfully'} in course!`);
        this.selectedCourseId = '';
        this.selectedStudentId = '';
        this.loadData(); // refresh counts
      },
      error: (err) => {
        this.notify.showError(`Enrollment failed: ${err.error?.message || err.message}`);
      }
    });
  }

  saveSettings(): void {
    if (!this.settingsApiUrl.trim()) return;
    this.lmsService.setApiUrl(this.settingsApiUrl);
    this.showSettings = false;
    this.notify.showSuccess('API endpoint updated successfully!');
    this.loadData(); // reload statistics
  }

  resetApi(): void {
    this.lmsService.resetApiUrl();
    this.showSettings = false;
    this.notify.showSuccess('API Endpoint restored to default.');
    this.loadData();
  }
}
