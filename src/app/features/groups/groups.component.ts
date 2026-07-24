import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { CreateGroupPayload, Group, UpdateGroupPayload } from '../../core/interfaces/Group';
import { User } from '../../core/interfaces/User';
import { Course } from '../../core/interfaces/Course';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';

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
  private router = inject(Router);
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  viewGroupDetails(group: Group): void {
    this.router.navigate(['/groups', group.id]);
  }

  groups = signal<Group[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  statusFilter = signal('All');
  courseFilter = signal('');
  topicFilter = signal('');
  instructorFilter = signal('');
  locationFilter = signal('');

  instructors = signal<User[]>([]);
  availableCourses = signal<Course[]>([]);

  // Modal signals
  showModal = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  selectedGroupId = signal<number | null>(null);
  saving = signal(false);

  // Form signals
  formName = '';
  formStartDate = '';
  formEndDate = '';
  formInstructorId = 0;
  formStatus = 0;
  formLocation = '';
  formSelectedCourseIds: number[] = [];

  // Delete modal signals
  showDeleteConfirmModal = signal(false);
  groupToDelete = signal<Group | null>(null);

  // Instructor Reassignment confirmation signals
  editingGroup = signal<Group | null>(null);
  originalInstructorId = signal<number>(0);
  showInstructorConfirmModal = signal<boolean>(false);
  pendingInstructorName = signal<string>('');
  pendingRemainingSessions = signal<number>(0);
  scheduleSessions = signal<ScheduleSession[]>([]);

  statusFilters = ['All', 'Running', 'Stopped', 'Completed', 'Archived'];
  statusOptions = STATUS_OPTIONS;

  readonly hasActiveFilters = computed(() => {
    return !!(
      this.courseFilter() ||
      this.topicFilter() ||
      this.instructorFilter() ||
      this.locationFilter()
    );
  });

  readonly uniqueCourses = computed(() => {
    const countMap = new Map<string, number>();
    for (const g of this.groups()) {
      for (const c of g.courses) {
        const key = c.title;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }
    return Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  });

  readonly uniqueTopics = computed(() => {
    const countMap = new Map<string, number>();
    for (const g of this.groups()) {
      for (const c of g.courses) {
        const key = c.topic || 'Other';
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }
    return Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  });

  readonly uniqueLocations = computed(() => {
    const countMap = new Map<string, number>();
    for (const g of this.groups()) {
      if (g.location) {
        countMap.set(g.location, (countMap.get(g.location) || 0) + 1);
      }
    }
    return Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  });

  readonly uniqueInstructors = computed(() => {
    const countMap = new Map<string, number>();
    for (const g of this.groups()) {
      const key = g.defaultInstructorName;
      if (key) {
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }
    return Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  });

  filteredGroups = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const course = this.courseFilter();
    const topic = this.topicFilter();
    const instructor = this.instructorFilter();
    const location = this.locationFilter();
    return this.groups().filter((g) => {
      const matchesStatus = status === 'All' || g.status === status;
      const matchesSearch =
        !query ||
        g.name.toLowerCase().includes(query) ||
        g.defaultInstructorName.toLowerCase().includes(query) ||
        g.courses.some((c) => c.title.toLowerCase().includes(query));
      const matchesCourse = !course || g.courses.some((c) => c.title === course);
      const matchesTopic = !topic || g.courses.some((c) => (c.topic || 'Other') === topic);
      const matchesInstructor = !instructor || g.defaultInstructorName === instructor;
      const matchesLocation = !location || g.location === location;
      return (
        matchesStatus &&
        matchesSearch &&
        matchesCourse &&
        matchesTopic &&
        matchesInstructor &&
        matchesLocation
      );
    });
  });

  totalStudents = computed(() => this.groups().reduce((sum, g) => sum + g.studentCount, 0));

  countByStatus(status: string): number {
    return this.groups().filter((g) => g.status === status).length;
  }

  clearAllFilters(): void {
    this.courseFilter.set('');
    this.topicFilter.set('');
    this.instructorFilter.set('');
    this.locationFilter.set('');
  }

  ngOnInit(): void {
    this.loadGroups();
    this.loadSchedule();
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

  loadSchedule(): void {
    this.lmsService.getSchedule().subscribe({
      next: (data) => this.scheduleSessions.set(data || []),
      error: () => {},
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
    this.editingGroup.set(null);
    this.originalInstructorId.set(0);
    this.formName = '';
    this.formStartDate = '';
    this.formEndDate = '';
    this.formInstructorId = 0;
    this.formStatus = 0;
    this.formLocation = '';
    this.formSelectedCourseIds = [];
    this.showModal.set(true);
  }

  openEditModal(group: Group): void {
    this.modalMode.set('edit');
    this.selectedGroupId.set(group.id);
    this.editingGroup.set(group);
    this.originalInstructorId.set(group.defaultInstructorId || 0);
    this.formName = group.name;
    this.formStartDate = group.startDate ? group.startDate.split('T')[0] : '';
    this.formEndDate = group.endDate ? group.endDate.split('T')[0] : '';
    this.formInstructorId = group.defaultInstructorId || 0;
    this.formStatus = STATUS_MAP[group.status] ?? 0;
    this.formLocation = group.location || '';
    this.formSelectedCourseIds = [];
    this.showModal.set(true);
  }

  getRemainingSessions(group: Group | null): number {
    if (!group) return 0;

    // 1. Check schedule sessions if available for accurate upcoming count
    const groupSchedule = this.scheduleSessions().filter(
      (s) => s.groupId === group.id || s.groupName === group.name
    );
    if (groupSchedule.length > 0) {
      const upcoming = groupSchedule.filter(
        (s) => s.status !== 'Completed' && new Date(s.startsAt) >= new Date()
      );
      if (upcoming.length > 0) {
        return upcoming.length;
      }
    }

    // 2. Otherwise calculate based on GroupCourses (Total Sessions - Current Session Number)
    if (!group.courses || group.courses.length === 0) return 0;
    return group.courses.reduce((sum, c) => {
      const total = parseInt(c.sessionCount || '12', 10) || 12;
      const current = c.currentSessionNumber || 0;
      return sum + Math.max(0, total - current);
    }, 0);
  }

  isCourseSelected(courseId: number): boolean {
    return this.formSelectedCourseIds.includes(courseId);
  }

  toggleCourseSelection(courseId: number): void {
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

    // Check if default instructor has changed during edit
    if (this.modalMode() === 'edit' && this.formInstructorId !== this.originalInstructorId()) {
      const group = this.editingGroup();
      const remaining = this.getRemainingSessions(group);
      const targetInst = this.instructors().find((i) => i.id === this.formInstructorId);
      const targetName = targetInst ? targetInst.name : 'the selected instructor';

      this.pendingRemainingSessions.set(remaining);
      this.pendingInstructorName.set(targetName);
      this.showInstructorConfirmModal.set(true);
      return;
    }

    this.executeSaveGroup();
  }

  confirmInstructorAssignment(): void {
    this.showInstructorConfirmModal.set(false);
    this.executeSaveGroup();
  }

  executeSaveGroup(): void {
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
          this.loadSchedule();
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
          this.loadSchedule();
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

  getGroupProgress(group: Group): number {
    if (!group.courses || group.courses.length === 0) return 0;
    let totalSessions = 0;
    let completedSessions = 0;
    for (const c of group.courses) {
      const total = parseInt(c.sessionCount || '0', 10) || 0;
      totalSessions += total;
      completedSessions += c.currentSessionNumber || 0;
    }
    if (totalSessions === 0) return 0;
    return Math.round((completedSessions / totalSessions) * 100);
  }
}
