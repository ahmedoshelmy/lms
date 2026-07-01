import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, User, Enrollment, Course } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
          <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">Users & Directory</h1>
          <p class="text-sm text-[#64748b] mt-1">Manage platform members, students and course staff</p>
        </div>
        <div>
          <button
            pButton
            type="button"
            label="Add User"
            icon="pi pi-user-plus"
            class="p-button-primary cursor-pointer w-full sm:w-auto"
            (click)="openCreateDialog()">
          </button>
        </div>
      </div>

      <!-- Search Filter -->
      <div class="mb-8 max-w-md">
        <span class="p-input-icon-left w-full relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
          <input
            pInputText
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search users by name or email..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border-[#cbd5e1] hover:border-violet-500 focus:border-violet-500" />
        </span>
      </div>

      <!-- Skeleton Loading -->
      @if (loading) {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          @for (col of [1, 2]; track col) {
            <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
              <p-skeleton width="100px" height="28px" borderRadius="999px" styleClass="mb-5" />
              <div class="flex flex-col gap-3">
                @for (i of [1,2,3,4]; track i) {
                  <div class="flex items-center gap-3 p-4 border border-[#e2e8f0] rounded-xl">
                    <p-skeleton shape="circle" size="40px" />
                    <div class="flex-1">
                      <p-skeleton width="60%" height="14px" styleClass="mb-1.5" />
                      <p-skeleton width="80%" height="12px" />
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Split Columns Layout -->
      @if (!loading) {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Instructors Directory -->
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col">
            <div class="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-5">
              <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100">
                <i class="pi pi-users text-[10px]"></i> Instructors
              </span>
              <span class="text-xs font-semibold text-[#94a3b8]">{{ filteredInstructors.length }} active</span>
            </div>

            <div class="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
              @for (inst of filteredInstructors; track inst.id) {
                <div
                  class="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-xl hover:border-rose-400 hover:bg-[#fffbfb] transition-all duration-200 cursor-pointer group"
                  (click)="openDetail(inst)">
                  <div class="flex items-center gap-3.5">
                    <div class="w-10 h-10 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-sm shrink-0">
                      {{ getInitials(inst.name) }}
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-sm font-semibold text-[#1e293b] truncate">{{ inst.name }}</span>
                      <span class="text-xs text-[#64748b] truncate mt-0.5">{{ inst.email }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="text-[10px] text-[#94a3b8] font-medium">Since {{ inst.createdAt | date:'MMM yyyy' }}</div>
                    <!-- Action buttons -->
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2">
                      <button
                        pButton type="button" icon="pi pi-pencil"
                        class="p-button-text p-button-sm cursor-pointer !rounded-lg !p-1.5"
                        title="Edit"
                        (click)="openEditDialog(inst); $event.stopPropagation()">
                      </button>
                      <button
                        pButton type="button" icon="pi pi-trash"
                        class="p-button-text p-button-danger p-button-sm cursor-pointer !rounded-lg !p-1.5"
                        title="Delete"
                        (click)="confirmDelete(inst); $event.stopPropagation()">
                      </button>
                    </div>
                  </div>
                </div>
              } @empty {
                <p class="text-center text-sm text-[#94a3b8] py-8">No instructors found.</p>
              }
            </div>
          </div>

          <!-- Students Directory -->
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col">
            <div class="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-5">
              <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50 text-cyan-600 font-bold text-xs border border-cyan-100">
                <i class="pi pi-user-plus text-[10px]"></i> Students
              </span>
              <span class="text-xs font-semibold text-[#94a3b8]">{{ filteredStudents.length }} active</span>
            </div>

            <div class="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
              @for (stud of filteredStudents; track stud.id) {
                <div
                  class="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-xl hover:border-cyan-400 hover:bg-[#fbfefe] transition-all duration-200 cursor-pointer group"
                  (click)="openDetail(stud)">
                  <div class="flex items-center gap-3.5">
                    <div class="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 font-bold flex items-center justify-center text-sm shrink-0">
                      {{ getInitials(stud.name) }}
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-sm font-semibold text-[#1e293b] truncate">{{ stud.name }}</span>
                      <span class="text-xs text-[#64748b] truncate mt-0.5">{{ stud.email }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="text-[10px] text-[#94a3b8] font-medium">Since {{ stud.createdAt | date:'MMM yyyy' }}</div>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2">
                      <button
                        pButton type="button" icon="pi pi-pencil"
                        class="p-button-text p-button-sm cursor-pointer !rounded-lg !p-1.5"
                        title="Edit"
                        (click)="openEditDialog(stud); $event.stopPropagation()">
                      </button>
                      <button
                        pButton type="button" icon="pi pi-trash"
                        class="p-button-text p-button-danger p-button-sm cursor-pointer !rounded-lg !p-1.5"
                        title="Delete"
                        (click)="confirmDelete(stud); $event.stopPropagation()">
                      </button>
                    </div>
                  </div>
                </div>
              } @empty {
                <p class="text-center text-sm text-[#94a3b8] py-8">No students found.</p>
              }
            </div>
          </div>
        </div>
      }

      <!-- Dialog: Create User -->
      <p-dialog
        header="Add New Platform Member"
        [(visible)]="showCreateDialog"
        [modal]="true"
        [style]="{ width: '450px' }"
        [draggable]="false"
        [resizable]="false">
        <form (submit)="createUser($event)" class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Full Name</label>
            <input pInputText type="text" [(ngModel)]="userForm.name" name="name" placeholder="e.g. Dr. Ada Lovelace" required class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Email Address</label>
            <input pInputText type="email" [(ngModel)]="userForm.email" name="email" placeholder="e.g. ada@inite.tech" required class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Assign Role</label>
            <p-select [options]="roles" [(ngModel)]="userForm.role" name="role" optionLabel="label" optionValue="value" placeholder="Choose Platform Role" styleClass="w-full"></p-select>
          </div>
          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9] mt-3">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showCreateDialog = false"></button>
            <button pButton type="submit" label="Add User" class="p-button-primary cursor-pointer" [disabled]="!userForm.name || !userForm.email || !userForm.role"></button>
          </div>
        </form>
      </p-dialog>

      <!-- Dialog: Edit User -->
      <p-dialog
        header="Edit User"
        [(visible)]="showEditDialog"
        [modal]="true"
        [style]="{ width: '450px' }"
        [draggable]="false"
        [resizable]="false">
        <form (submit)="updateUser($event)" class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Full Name</label>
            <input pInputText type="text" [(ngModel)]="userForm.name" name="editName" required class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Email Address</label>
            <input pInputText type="email" [(ngModel)]="userForm.email" name="editEmail" required class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Role</label>
            <p-select [options]="roles" [(ngModel)]="userForm.role" name="editRole" optionLabel="label" optionValue="value" styleClass="w-full"></p-select>
          </div>
          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9] mt-3">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showEditDialog = false"></button>
            <button pButton type="submit" label="Save Changes" icon="pi pi-check" class="p-button-primary cursor-pointer" [disabled]="!userForm.name || !userForm.email || !userForm.role"></button>
          </div>
        </form>
      </p-dialog>

      <!-- Dialog: Delete Confirm -->
      <p-dialog
        header="Delete User"
        [(visible)]="showDeleteConfirm"
        [modal]="true"
        [style]="{ width: '380px' }"
        [draggable]="false"
        [resizable]="false">
        <p class="text-sm text-[#64748b] py-3">
          Are you sure you want to remove <strong>{{ deletingUser?.name }}</strong> from the platform? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
          <button pButton type="button" label="Cancel" class="p-button-text cursor-pointer" (click)="showDeleteConfirm = false"></button>
          <button pButton type="button" label="Delete" icon="pi pi-trash" class="p-button-danger cursor-pointer" (click)="deleteUser()"></button>
        </div>
      </p-dialog>

      <!-- Dialog: User Detail -->
      <p-dialog
        [header]="selectedUser?.name + ' — Profile'"
        [(visible)]="showDetailDialog"
        [modal]="true"
        [style]="{ width: '520px', maxWidth: '95vw' }"
        [draggable]="false"
        [resizable]="false">
        @if (selectedUser) {
          <div class="flex flex-col gap-5 py-2">
            <!-- User card -->
            <div class="flex items-center gap-4 p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
              <div
                class="w-14 h-14 rounded-full font-bold flex items-center justify-center text-lg shrink-0"
                [class]="selectedUser.role === 1 ? 'bg-cyan-100 text-cyan-700' : 'bg-rose-100 text-rose-600'">
                {{ getInitials(selectedUser.name) }}
              </div>
              <div>
                <p class="font-bold text-[#1e293b] text-base">{{ selectedUser.name }}</p>
                <p class="text-sm text-[#64748b]">{{ selectedUser.email }}</p>
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block"
                  [class]="selectedUser.role === 1 ? 'bg-cyan-100 text-cyan-700' : 'bg-rose-100 text-rose-600'">
                  {{ selectedUser.role === 1 ? 'Student' : 'Instructor' }}
                </span>
              </div>
              <div class="ml-auto text-right">
                <p class="text-xs text-[#94a3b8]">Member since</p>
                <p class="text-sm font-semibold text-[#1e293b]">{{ selectedUser.createdAt | date:'mediumDate' }}</p>
              </div>
            </div>

            <!-- Enrollments / Courses section -->
            <div>
              <p class="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">
                {{ selectedUser.role === 1 ? 'Enrolled Courses' : 'Assigned Courses' }}
              </p>

              @if (detailLoading) {
                <div class="flex flex-col gap-2">
                  @for (i of [1,2,3]; track i) {
                    <p-skeleton width="100%" height="60px" borderRadius="12px" />
                  }
                </div>
              } @else if (selectedUserEnrollments.length === 0 && selectedUserCourses.length === 0) {
                <p class="text-sm text-[#94a3b8] text-center py-6 border border-dashed border-[#e2e8f0] rounded-xl">
                  {{ selectedUser.role === 1 ? 'Not enrolled in any courses.' : 'No courses assigned.' }}
                </p>
              }

              @if (selectedUser.role === 1) {
                <div class="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  @for (enroll of selectedUserEnrollments; track enroll.id) {
                    <div class="p-3.5 border border-[#e2e8f0] rounded-xl flex items-center justify-between">
                      <div>
                        <p class="text-sm font-semibold text-[#1e293b]">{{ enroll.courseTitle || 'Course' }}</p>
                        <p class="text-xs text-[#94a3b8]">Enrolled {{ enroll.enrollmentDate | date:'mediumDate' }}</p>
                      </div>
                      <div class="flex flex-col items-end gap-1">
                        <span class="text-xs font-bold" [class]="getProgressColor(enroll.progressPercentage)">
                          {{ enroll.progressPercentage }}%
                        </span>
                        <div class="w-16 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                          <div class="h-full rounded-full" [style.width.%]="enroll.progressPercentage" [class]="getBarColor(enroll.progressPercentage)"></div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              @if (selectedUser.role === 2) {
                <div class="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  @for (course of selectedUserCourses; track course.id) {
                    <div class="p-3.5 border border-[#e2e8f0] rounded-xl flex items-center justify-between">
                      <div>
                        <p class="text-sm font-semibold text-[#1e293b]">{{ course.title }}</p>
                        <p class="text-xs text-[#94a3b8]">{{ course.enrollments?.length || 0 }} students enrolled</p>
                      </div>
                      <span class="text-[10px] font-bold text-violet-600 bg-violet-100/60 px-2.5 py-1 rounded-full uppercase">
                        Instructor
                      </span>
                    </div>
                  }
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
      .p-dialog { border-radius: 16px; }
    }
  `
})
export class UsersComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  users: User[] = [];
  allCourses: Course[] = [];
  searchQuery = '';
  loading = true;

  showCreateDialog = false;
  showEditDialog = false;
  showDeleteConfirm = false;
  showDetailDialog = false;

  editingUser: User | null = null;
  deletingUser: User | null = null;
  selectedUser: User | null = null;
  detailLoading = false;
  selectedUserEnrollments: Enrollment[] = [];
  selectedUserCourses: Course[] = [];

  roles = [
    { label: 'Instructor', value: 2 },
    { label: 'Student', value: 1 }
  ];

  userForm: { name: string; email: string; role: number | null } = {
    name: '', email: '', role: null
  };

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      users: this.lmsService.getUsers().pipe(catchError(() => of([]))),
      courses: this.lmsService.getCourses().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ users, courses }) => {
        this.users = users;
        this.allCourses = courses;
        this.loading = false;
      },
      error: (err) => {
        this.notify.showError(`Failed to load directory: ${err.message}`);
        this.loading = false;
      }
    });
  }

  get filteredInstructors(): User[] { return this.filterUsers(2); }
  get filteredStudents(): User[] { return this.filterUsers(1); }

  private filterUsers(role: number): User[] {
    const roleUsers = this.users.filter(u => u.role === role);
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return roleUsers;
    return roleUsers.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  openCreateDialog(): void {
    this.userForm = { name: '', email: '', role: null };
    this.showCreateDialog = true;
  }

  openEditDialog(user: User): void {
    this.editingUser = user;
    this.userForm = { name: user.name, email: user.email, role: user.role };
    this.showEditDialog = true;
  }

  confirmDelete(user: User): void {
    this.deletingUser = user;
    this.showDeleteConfirm = true;
  }

  openDetail(user: User): void {
    this.selectedUser = user;
    this.selectedUserEnrollments = [];
    this.selectedUserCourses = [];
    this.detailLoading = true;
    this.showDetailDialog = true;

    if (user.role === 1) {
      // Student: fetch their enrollments
      this.lmsService.getStudentEnrollments(user.id).subscribe({
        next: (enrolls) => {
          // Try to attach course titles from allCourses
          this.selectedUserEnrollments = enrolls.map(e => ({
            ...e,
            courseTitle: e.courseTitle || this.allCourses.find(c => c.id === e.courseId)?.title,
          }));
          if (enrolls.length === 0) {
            // Fallback: scan course enrollments
            this.fallbackStudentEnrollments(user.id);
            return;
          }
          this.detailLoading = false;
        },
        error: () => { this.fallbackStudentEnrollments(user.id); }
      });
    } else {
      // Instructor: find their courses
      this.selectedUserCourses = this.allCourses.filter(c => c.instructorId === user.id);
      this.detailLoading = false;
    }
  }

  private fallbackStudentEnrollments(studentId: string): void {
    if (this.allCourses.length === 0) { this.detailLoading = false; return; }
    const calls = this.allCourses.map(c =>
      this.lmsService.getCourseEnrollments(c.id).pipe(catchError(() => of([])))
    );
    forkJoin(calls).subscribe({
      next: (allEnrolls) => {
        const result: Enrollment[] = [];
        this.allCourses.forEach((course, i) => {
          const enroll = (allEnrolls[i] as Enrollment[]).find(e => e.studentId === studentId);
          if (enroll) result.push({ ...enroll, courseTitle: course.title });
        });
        this.selectedUserEnrollments = result;
        this.detailLoading = false;
      },
      error: () => { this.detailLoading = false; }
    });
  }

  createUser(event: Event): void {
    event.preventDefault();
    if (!this.userForm.name || !this.userForm.email || this.userForm.role === null) return;
    this.lmsService.createUser(this.userForm as any).subscribe({
      next: (user) => {
        this.notify.showSuccess(`User "${user.name}" registered successfully!`);
        this.showCreateDialog = false;
        this.loadData();
      },
      error: (err) => { this.notify.showError(`Failed to add user: ${err.message}`); }
    });
  }

  updateUser(event: Event): void {
    event.preventDefault();
    if (!this.editingUser) return;
    this.lmsService.updateUser(this.editingUser.id, this.userForm as any).subscribe({
      next: () => {
        this.notify.showSuccess('User updated successfully!');
        this.showEditDialog = false;
        this.loadData();
      },
      error: (err) => { this.notify.showError(`Failed to update user: ${err.message}`); }
    });
  }

  deleteUser(): void {
    if (!this.deletingUser) return;
    this.lmsService.deleteUser(this.deletingUser.id).subscribe({
      next: () => {
        this.notify.showSuccess(`User "${this.deletingUser!.name}" removed.`);
        this.showDeleteConfirm = false;
        this.deletingUser = null;
        this.loadData();
      },
      error: (err) => { this.notify.showError(`Failed to delete user: ${err.message}`); }
    });
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
