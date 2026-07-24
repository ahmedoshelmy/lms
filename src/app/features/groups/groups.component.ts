import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import {
  LmsService,
  Group,
  User,
  Course,
  CreateGroupPayload,
  UpdateGroupPayload,
} from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';

const STATUS_CONFIG: Record<string, { label: string; css: string; icon: string }> = {
  Running: { label: 'Running', css: 'status-running', icon: 'pi-play-circle' },
  Stopped: { label: 'Stopped', css: 'status-stopped', icon: 'pi-pause-circle' },
  Completed: { label: 'Completed', css: 'status-completed', icon: 'pi-check-circle' },
  Archived: { label: 'Archived', css: 'status-archived', icon: 'pi-archive' },
};

const STATUS_OPTIONS = [
  { label: 'Running', value: 0 },
  { label: 'Stopped', value: 1 },
  { label: 'Completed', value: 2 },
  { label: 'Archived', value: 3 },
];

const STATUS_MAP: Record<string, number> = {
  Running: 0,
  Stopped: 1,
  Completed: 2,
  Archived: 3,
};

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, DialogModule, ButtonModule],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
            Groups
          </h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">
            Overview of all groups, their instructors, courses, and students
          </p>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <!-- Status Filter -->
          <div
            class="flex rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            @for (s of statusFilters; track s) {
              <button
                (click)="statusFilter.set(s)"
                [class.filter-active]="statusFilter() === s"
                class="filter-btn px-3 py-2 text-xs font-semibold transition-all duration-200"
              >
                {{ s }}
              </button>
            }
          </div>

          <!-- Search -->
          <div class="relative w-full md:w-64">
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Search groups..."
              class="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] transition-all duration-200"
            />
            <i
              class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            ></i>
          </div>

          <!-- Admin Add Group Button -->
          @if (isAdmin()) {
            <button
              (click)="openCreateModal()"
              class="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-xs hover:bg-[var(--color-primary-hover)] transition-all duration-200 shadow-md"
            >
              <i class="pi pi-plus text-xs"></i>
              Create Group
            </button>
          }
        </div>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="flex justify-center items-center py-20">
          <p-progressSpinner styleClass="w-12 h-12" strokeWidth="4" />
        </div>
      } @else {
        <!-- Stats row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div
            class="stat-card p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-1"
          >
            <span
              class="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider"
              >Total Groups</span
            >
            <span class="text-2xl font-extrabold text-[var(--color-text-primary)]">{{
              groups().length
            }}</span>
          </div>
          <div
            class="stat-card p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-1"
          >
            <span
              class="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider"
              >Running</span
            >
            <span class="text-2xl font-extrabold text-[var(--color-success)]">{{
              countByStatus('Running')
            }}</span>
          </div>
          <div
            class="stat-card p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-1"
          >
            <span
              class="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider"
              >Total Students</span
            >
            <span class="text-2xl font-extrabold text-[var(--color-secondary)]">{{
              totalStudents()
            }}</span>
          </div>
          <div
            class="stat-card p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-1"
          >
            <span
              class="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider"
              >Completed</span
            >
            <span class="text-2xl font-extrabold text-[var(--color-text-muted)]">{{
              countByStatus('Completed')
            }}</span>
          </div>
        </div>

        <!-- Groups Table/Cards -->
        <div class="flex flex-col gap-4">
          @for (group of filteredGroups(); track group.id) {
            <div
              class="group-card p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-secondary)] hover:shadow-[0_8px_24px_rgba(62,109,181,0.07)] transition-all duration-300"
            >
              <!-- Header row -->
              <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div class="flex items-start gap-3">
                  <div
                    class="group-avatar rounded-xl flex items-center justify-center w-11 h-11 shrink-0 text-lg font-black text-white"
                  >
                    {{ group.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <h2 class="text-base font-bold text-[var(--color-text-primary)] leading-tight">
                      {{ group.name }}
                    </h2>
                    <div
                      class="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--color-text-muted)]"
                    >
                      <i class="pi pi-user text-[10px]"></i>
                      {{ group.defaultInstructorName }}
                      @if (group.location) {
                        <span class="mx-1">·</span>
                        <i class="pi pi-map-marker text-[10px]"></i>
                        {{ group.location }}
                      }
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3 flex-shrink-0 flex-wrap">
                  <span
                    class="status-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    [ngClass]="getStatusCss(group.status)"
                  >
                    <i [ngClass]="'pi ' + getStatusIcon(group.status)"></i>
                    {{ group.status }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]"
                  >
                    <i class="pi pi-users text-[var(--color-secondary)]"></i>
                    {{ group.studentCount }} student{{ group.studentCount !== 1 ? 's' : '' }}
                  </span>
                  <span class="text-xs text-[var(--color-text-muted)]">
                    {{ group.startDate | date: 'MMM y' }} – {{ group.endDate | date: 'MMM y' }}
                  </span>

                  <!-- Admin Actions -->
                  @if (isAdmin()) {
                    <div
                      class="flex items-center gap-1 ml-2 border-l border-[var(--color-border)] pl-3"
                    >
                      <button
                        (click)="openEditModal(group)"
                        title="Edit Group"
                        class="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-secondary)] hover:bg-[var(--color-background-alt)] transition-all duration-200"
                      >
                        <i class="pi pi-pencil text-sm"></i>
                      </button>
                      <button
                        (click)="confirmDelete(group)"
                        title="Delete Group"
                        class="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-background-alt)] transition-all duration-200"
                      >
                        <i class="pi pi-trash text-sm"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Courses row -->
              @if (group.courses.length > 0) {
                <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                  @for (course of group.courses; track course.courseId) {
                    <div
                      class="course-chip flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-xs"
                    >
                      <span class="font-semibold text-[var(--color-text-primary)]">{{
                        course.title
                      }}</span>
                      <span class="text-[var(--color-text-muted)]">·</span>
                      <span class="text-[var(--color-text-secondary)]"
                        >S{{ course.currentSessionNumber }} / {{ course.sessionCount }}</span
                      >
                      <span
                        class="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                        [ngClass]="getLevelBadgeClass(course.level)"
                      >
                        L{{ course.level }}
                      </span>
                    </div>
                  }
                </div>
              } @else {
                <p
                  class="text-xs text-[var(--color-text-muted)] mt-2 pt-2 border-t border-[var(--color-border)]"
                >
                  No courses assigned yet.
                </p>
              }
            </div>
          } @empty {
            <div
              class="text-center py-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl"
            >
              <i class="pi pi-users text-4xl text-[var(--color-text-muted)] mb-3 block"></i>
              <p class="text-[var(--color-text-secondary)] font-medium">
                No groups found matching your criteria
              </p>
            </div>
          }
        </div>
      }

      <!-- Create / Edit Group Modal -->
      <p-dialog
        [(visible)]="showModal"
        [header]="modalMode() === 'create' ? 'Create Group' : 'Edit Group'"
        [modal]="true"
        [style]="{ width: '90%', maxWidth: '560px' }"
        [draggable]="false"
        [resizable]="false"
      >
        <form (ngSubmit)="saveGroup()" class="flex flex-col gap-4 pt-2">
          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
              >Group Name *</label
            >
            <input
              type="text"
              [(ngModel)]="formName"
              name="name"
              required
              placeholder="e.g. Group A - Spring 2026"
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] text-sm"
            />
          </div>

          <!-- Instructor -->
          <div>
            <label class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
              >Default Instructor *</label
            >
            <select
              [(ngModel)]="formInstructorId"
              name="defaultInstructorId"
              required
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] text-sm"
            >
              <option value="">Select Instructor...</option>
              @for (inst of instructors(); track inst.id) {
                <option [value]="inst.id">{{ inst.name }} ({{ inst.email }})</option>
              }
            </select>
          </div>

          <!-- Dates Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
                >Start Date *</label
              >
              <input
                type="date"
                [(ngModel)]="formStartDate"
                name="startDate"
                required
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] text-sm"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
                >End Date *</label
              >
              <input
                type="date"
                [(ngModel)]="formEndDate"
                name="endDate"
                required
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] text-sm"
              />
            </div>
          </div>

          <!-- Status & Location Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
                >Status *</label
              >
              <select
                [(ngModel)]="formStatus"
                name="status"
                required
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] text-sm"
              >
                @for (opt of statusOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
                >Location</label
              >
              <input
                type="text"
                [(ngModel)]="formLocation"
                name="location"
                placeholder="e.g. MOA Room 1"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] text-sm"
              />
            </div>
          </div>

          <!-- Course Selection (Create Mode only) -->
          @if (modalMode() === 'create') {
            <div>
              <label class="block text-xs font-semibold text-[var(--color-text-primary)] mb-1"
                >Assigned Courses</label
              >
              <div
                class="max-h-40 overflow-y-auto border border-[var(--color-border)] rounded-xl p-3 bg-[var(--color-surface)] flex flex-col gap-2"
              >
                @for (course of availableCourses(); track course.id) {
                  <label
                    class="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      [checked]="isCourseSelected(course.id)"
                      (change)="toggleCourseSelection(course.id)"
                      class="rounded text-[var(--color-secondary)] focus:ring-[var(--color-secondary)]"
                    />
                    <span class="font-medium">{{ course.title }}</span>
                    <span class="text-[var(--color-text-muted)]"
                      >({{ course.topic }} - L{{ course.level }})</span
                    >
                  </label>
                } @empty {
                  <p class="text-xs text-[var(--color-text-muted)]">No courses available.</p>
                }
              </div>
            </div>
          }

          <!-- Submit buttons -->
          <div class="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              (click)="showModal.set(false)"
              class="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] font-semibold text-xs hover:bg-[var(--color-background-alt)] transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="saving()"
              class="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-xs hover:bg-[var(--color-primary-hover)] transition-all duration-200 disabled:opacity-50"
            >
              {{
                saving() ? 'Saving...' : modalMode() === 'create' ? 'Create Group' : 'Save Changes'
              }}
            </button>
          </div>
        </form>
      </p-dialog>

      <!-- Delete Confirmation Modal -->
      <p-dialog
        [(visible)]="showDeleteConfirmModal"
        header="Delete Group"
        [modal]="true"
        [style]="{ width: '90%', maxWidth: '440px' }"
        [draggable]="false"
        [resizable]="false"
      >
        <div class="pt-2">
          <p class="text-sm text-[var(--color-text-primary)]">
            Are you sure you want to delete group
            <strong class="text-[var(--color-danger)]">{{ groupToDelete()?.name }}</strong
            >? This will delete all sessions, schedules, and enrollments linked to this group.
          </p>

          <div class="flex justify-end gap-3 pt-6 mt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              (click)="showDeleteConfirmModal.set(false)"
              class="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] font-semibold text-xs hover:bg-[var(--color-background-alt)] transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="deleteGroup()"
              [disabled]="saving()"
              class="px-4 py-2 rounded-xl bg-[var(--color-danger)] text-white font-semibold text-xs hover:opacity-90 transition-all duration-200 disabled:opacity-50"
            >
              {{ saving() ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </p-dialog>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .group-avatar {
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    }

    .filter-btn {
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
    }
    .filter-btn:hover {
      background: var(--color-background-alt);
      color: var(--color-text-primary);
    }
    .filter-active {
      background: var(--color-secondary) !important;
      color: #fff !important;
    }

    .status-running {
      background: color-mix(in srgb, var(--color-success) 12%, transparent);
      color: var(--color-success);
    }
    .status-stopped {
      background: color-mix(in srgb, var(--color-warning) 12%, transparent);
      color: var(--color-warning);
    }
    .status-completed {
      background: color-mix(in srgb, var(--color-text-muted) 12%, transparent);
      color: var(--color-text-muted);
    }
    .status-archived {
      background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
      color: var(--color-text-muted);
    }

    .level-1 {
      background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
      color: var(--color-secondary);
    }
    .level-2 {
      background: color-mix(in srgb, var(--color-success) 12%, transparent);
      color: var(--color-success);
    }
    .level-default {
      background: color-mix(in srgb, var(--color-text-muted) 10%, transparent);
      color: var(--color-text-muted);
    }
  `,
})
export class GroupsComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  groups = signal<Group[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  statusFilter = signal('All');

  instructors = signal<User[]>([]);
  availableCourses = signal<Course[]>([]);

  // Modal signals
  showModal = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  selectedGroupId = signal<string | null>(null);
  saving = signal(false);

  // Form signals
  formName = '';
  formStartDate = '';
  formEndDate = '';
  formInstructorId = '';
  formStatus = 0;
  formLocation = '';
  formSelectedCourseIds: string[] = [];

  // Delete modal signals
  showDeleteConfirmModal = signal(false);
  groupToDelete = signal<Group | null>(null);

  statusFilters = ['All', 'Running', 'Stopped', 'Completed', 'Archived'];
  statusOptions = STATUS_OPTIONS;

  filteredGroups = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    return this.groups().filter((g) => {
      const matchesStatus = status === 'All' || g.status === status;
      const matchesSearch =
        !query ||
        g.name.toLowerCase().includes(query) ||
        g.defaultInstructorName.toLowerCase().includes(query) ||
        g.courses.some((c) => c.title.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  });

  totalStudents = computed(() => this.groups().reduce((sum, g) => sum + g.studentCount, 0));

  countByStatus(status: string): number {
    return this.groups().filter((g) => g.status === status).length;
  }

  ngOnInit(): void {
    this.loadGroups();
    if (this.isAdmin()) {
      this.loadInstructors();
      this.loadCourses();
    }
  }

  loadGroups(): void {
    this.loading.set(true);
    this.lmsService.getGroups().subscribe({
      next: (data) => {
        this.groups.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  loadInstructors(): void {
    this.lmsService.getInstructors().subscribe({
      next: (data) => this.instructors.set(data || []),
      error: () => {},
    });
  }

  loadCourses(): void {
    this.lmsService.getCourses().subscribe({
      next: (data) => this.availableCourses.set(data || []),
      error: () => {},
    });
  }

  openCreateModal(): void {
    this.modalMode.set('create');
    this.selectedGroupId.set(null);
    this.formName = '';
    this.formStartDate = '';
    this.formEndDate = '';
    this.formInstructorId = '';
    this.formStatus = 0;
    this.formLocation = '';
    this.formSelectedCourseIds = [];
    this.showModal.set(true);
  }

  openEditModal(group: Group): void {
    this.modalMode.set('edit');
    this.selectedGroupId.set(group.id);
    this.formName = group.name;
    this.formStartDate = group.startDate ? group.startDate.split('T')[0] : '';
    this.formEndDate = group.endDate ? group.endDate.split('T')[0] : '';
    this.formInstructorId = group.defaultInstructorId || '';
    this.formStatus = STATUS_MAP[group.status] ?? 0;
    this.formLocation = group.location || '';
    this.formSelectedCourseIds = [];
    this.showModal.set(true);
  }

  isCourseSelected(courseId: string): boolean {
    return this.formSelectedCourseIds.includes(courseId);
  }

  toggleCourseSelection(courseId: string): void {
    if (this.isCourseSelected(courseId)) {
      this.formSelectedCourseIds = this.formSelectedCourseIds.filter((id) => id !== courseId);
    } else {
      this.formSelectedCourseIds = [...this.formSelectedCourseIds, courseId];
    }
  }

  saveGroup(): void {
    if (!this.formName || !this.formStartDate || !this.formEndDate || !this.formInstructorId) {
      this.notify.showError('Please fill in all required fields.');
      return;
    }

    this.saving.set(true);

    if (this.modalMode() === 'create') {
      const payload: CreateGroupPayload = {
        name: this.formName,
        startDate: this.formStartDate,
        endDate: this.formEndDate,
        defaultInstructorId: this.formInstructorId,
        status: this.formStatus,
        location: this.formLocation || undefined,
        courseIds: this.formSelectedCourseIds,
      };

      this.lmsService.createGroup(payload).subscribe({
        next: () => {
          this.notify.showSuccess('Group created successfully.');
          this.saving.set(false);
          this.showModal.set(false);
          this.loadGroups();
        },
        error: () => {
          this.saving.set(false);
        },
      });
    } else {
      const id = this.selectedGroupId();
      if (!id) return;

      const payload: UpdateGroupPayload = {
        name: this.formName,
        startDate: this.formStartDate,
        endDate: this.formEndDate,
        defaultInstructorId: this.formInstructorId,
        status: this.formStatus,
        location: this.formLocation || undefined,
      };

      this.lmsService.updateGroup(id, payload).subscribe({
        next: () => {
          this.notify.showSuccess('Group updated successfully.');
          this.saving.set(false);
          this.showModal.set(false);
          this.loadGroups();
        },
        error: () => {
          this.saving.set(false);
        },
      });
    }
  }

  confirmDelete(group: Group): void {
    this.groupToDelete.set(group);
    this.showDeleteConfirmModal.set(true);
  }

  deleteGroup(): void {
    const group = this.groupToDelete();
    if (!group) return;

    this.saving.set(true);
    this.lmsService.deleteGroup(group.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Group ${group.name} deleted.`);
        this.saving.set(false);
        this.showDeleteConfirmModal.set(false);
        this.groupToDelete.set(null);
        this.loadGroups();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  getStatusCss(status: string): string {
    return STATUS_CONFIG[status]?.css ?? 'status-archived';
  }

  getStatusIcon(status: string): string {
    return STATUS_CONFIG[status]?.icon ?? 'pi-circle';
  }

  getLevelBadgeClass(level: string): string {
    if (level === '1') return 'level-1';
    if (level === '2') return 'level-2';
    return 'level-default';
  }
}
