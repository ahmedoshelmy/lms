import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import {
  LmsService,
  CreateGroupPayload,
  UpdateGroupPayload,
} from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { Group } from '../../core/interfaces/Group';
import { User } from '../../core/interfaces/User';
import { Course } from '../../core/interfaces/Course';

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
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss',
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
