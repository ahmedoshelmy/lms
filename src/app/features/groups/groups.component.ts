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
import {
  CreateGroupPayload,
  GROUP_STATUS,
  GROUP_STATUS_OPTIONS,
  Group,
  GroupScheduleSlot,
  STALLED_COPY,
  StalledReason,
  UpdateGroupPayload,
} from '../../core/interfaces/Group';
import { User } from '../../core/interfaces/User';
import { Topic } from '../../core/interfaces/Topic';
import { CourseLevel } from '../../core/interfaces/CourseLevel';
import { GroupCourseAssignDto } from '../../core/interfaces/GroupCourse';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';

const STATUS_CONFIG: Record<string, { label: string; css: string; icon: string }> = {
  Running: { label: 'Running', css: 'status-running', icon: 'pi-play-circle' },
  Stopped: { label: 'Stopped', css: 'status-stopped', icon: 'pi-pause-circle' },
  Completed: { label: 'Completed', css: 'status-completed', icon: 'pi-check-circle' },
  Archived: { label: 'Archived', css: 'status-archived', icon: 'pi-archive' },
};

const DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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
  dayFilter = signal('');

  instructors = signal<User[]>([]);
  topics = signal<Topic[]>([]);

  // Modal signals
  showModal = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  selectedGroupId = signal<number | null>(null);
  saving = signal(false);

  // Form signals & atomic single-step creation
  formName = '';
  formStartDate = '';
  formEndDate = '';
  formInstructorId = 0;
  formStatus = 0;
  formLocation = '';
  formSelectedCourseLevelId = signal<number | null>(null);
  formInitialSessionNumber = signal<number>(0);
  formAutoGenerateSessions = signal<boolean>(true);

  // Schedule slot form array
  scheduleSlots = signal<GroupScheduleSlot[]>([
    { dayOfWeek: 'Saturday', startTime: '13:30', endTime: '15:00', location: 'MOA' },
  ]);

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
  statusOptions = GROUP_STATUS_OPTIONS;
  readonly stalledCopy = STALLED_COPY;

  /**
   * Running groups with nothing coming up. Hoisted above the list because a
   * group that has quietly stopped being scheduled is the thing worth knowing
   * before anything else on this page.
   */
  readonly stalledGroups = computed(() =>
    this.groups()
      .filter((g) => !!g.stalledReason)
      .sort((a, b) => (a.stalledReason! > b.stalledReason! ? 1 : -1))
  );

  readonly stalledOwed = computed(() =>
    this.stalledGroups().filter((g) => g.stalledReason === 'Owed')
  );

  /**
   * Groups dragging unmarked classes behind them. Counted separately from the
   * stalled list because a group can be running perfectly well and still have a
   * fortnight of registers nobody took.
   */
  readonly groupsWithOverdue = computed(() =>
    this.groups()
      .filter((g) => (g.overdueSessions ?? 0) > 0)
      .sort((a, b) => (b.overdueSessions ?? 0) - (a.overdueSessions ?? 0))
  );

  readonly overdueTotal = computed(() =>
    this.groupsWithOverdue().reduce((n, g) => n + (g.overdueSessions ?? 0), 0)
  );

  readonly showOverdue = signal(false);

  /** Moves classes that never happened forward onto the group's pattern. */
  rescheduleOverdue(group: Group): void {
    this.saving.set(true);
    this.lmsService.rescheduleOverdueSessions(group.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadGroups();
        this.loadSchedule();
        this.notify.showSuccess(
          `${group.name}: ${group.overdueSessions} moved to the next free slots.`
        );
      },
      error: () => this.saving.set(false),
    });
  }

  /**
   * Groups whose progress and sessions tell different stories. The number
   * labels every session on the schedule and decides when a group moves up a
   * level, so a wrong one is worth putting in front of somebody rather than
   * leaving for the next person who notices a session called the wrong thing.
   */
  readonly groupsWithDrift = computed(() =>
    this.groups().filter((g) => g.progressShouldBe != null)
  );

  readonly showDrift = signal(false);

  /** Sets a group's progress to what its delivered sessions say it is. */
  reconcileProgress(group: Group): void {
    this.saving.set(true);
    const shouldBe = group.progressShouldBe;
    this.lmsService.reconcileProgress(group.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadGroups();
        this.loadSchedule();
        this.notify.showSuccess(`${group.name} is now at session ${shouldBe}.`);
      },
      error: () => this.saving.set(false),
    });
  }

  readonly showStalled = signal(false);

  /** Creates what a group is owed, putting it back on the schedule. */
  generateMissing(group: Group): void {
    this.saving.set(true);
    this.lmsService.generateMissingSessions(group.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadGroups();
        this.loadSchedule();
        this.notify.showSuccess(`${group.name} is back on the schedule.`);
      },
      error: () => this.saving.set(false),
    });
  }

  /** Marks a taught-out group completed, which is what its status should say. */
  markCompleted(group: Group): void {
    this.saving.set(true);
    this.lmsService
      .updateGroup(group.id, {
        name: group.name,
        startDate: group.startDate,
        endDate: group.endDate,
        defaultInstructorId: group.defaultInstructorId,
        status: GROUP_STATUS['Completed'],
        location: group.location || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.loadGroups();
          this.notify.showSuccess(`${group.name} marked completed.`);
        },
        error: () => this.saving.set(false),
      });
  }
  daysOfWeek = DAYS_OF_WEEK;
  protected readonly Math = Math;

  readonly allCourseLevels = computed(() => {
    const result: { level: CourseLevel; topicName: string; topicCode: string }[] = [];
    for (const t of this.topics()) {
      if (t.levels) {
        for (const l of t.levels) {
          result.push({ level: l, topicName: t.name, topicCode: t.code });
        }
      }
    }
    return result;
  });

  readonly hasActiveFilters = computed(() => {
    return !!(
      this.courseFilter() ||
      this.topicFilter() ||
      this.instructorFilter() ||
      this.locationFilter() ||
      this.dayFilter()
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

  /**
   * The days groups actually meet on, in week order rather than alphabetical —
   * a list running Friday, Monday, Saturday would be useless for finding
   * Tuesday's groups. A group meeting twice a week appears under both days.
   */
  readonly uniqueDays = computed(() => {
    const countMap = new Map<string, number>();
    for (const g of this.groups()) {
      for (const day of new Set((g.schedules || []).map((s) => s.dayOfWeek))) {
        countMap.set(day, (countMap.get(day) || 0) + 1);
      }
    }
    return DAYS_OF_WEEK.filter((d) => countMap.has(d)).map((name) => ({
      name,
      count: countMap.get(name)!,
    }));
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
    const day = this.dayFilter();
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
      const matchesDay = !day || (g.schedules || []).some((s) => s.dayOfWeek === day);
      return (
        matchesStatus &&
        matchesSearch &&
        matchesCourse &&
        matchesTopic &&
        matchesInstructor &&
        matchesLocation &&
        matchesDay
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
    this.dayFilter.set('');
  }

  ngOnInit(): void {
    this.loadGroups();
    this.loadSchedule();
    if (this.isAdmin()) {
      this.loadInstructors();
      this.loadTopics();
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

  loadTopics(): void {
    this.lmsService.getTopics().subscribe({
      next: (data) => this.topics.set(data || []),
      error: () => {},
    });
  }

  openCreateModal(): void {
    this.modalMode.set('create');
    this.selectedGroupId.set(null);
    this.editingGroup.set(null);
    this.originalInstructorId.set(0);
    this.formName = '';

    const today = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    this.formStartDate = today.toISOString().split('T')[0];
    this.formEndDate = end.toISOString().split('T')[0];

    this.formInstructorId = this.instructors().length > 0 ? this.instructors()[0].id : 0;
    this.formStatus = 0;
    this.formLocation = 'MOA';
    this.formInitialSessionNumber.set(0);
    this.formAutoGenerateSessions.set(true);

    const levels = this.allCourseLevels();
    this.formSelectedCourseLevelId.set(levels.length > 0 ? levels[0].level.id : null);

    this.scheduleSlots.set([
      { dayOfWeek: 'Saturday', startTime: '13:30', endTime: '15:00', location: 'MOA' },
    ]);

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
    this.formStatus = GROUP_STATUS[group.status] ?? 0;
    this.formLocation = group.location || '';
    this.showModal.set(true);
  }

  addScheduleSlot(): void {
    this.scheduleSlots.update((slots) => [
      ...slots,
      {
        dayOfWeek: 'Sunday',
        startTime: '15:00',
        endTime: '16:30',
        location: this.formLocation || 'MOA',
      },
    ]);
  }

  removeScheduleSlot(index: number): void {
    this.scheduleSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  getRemainingSessions(group: Group | null): number {
    if (!group) return 0;
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
    if (!group.courses || group.courses.length === 0) return 0;
    return group.courses.reduce((sum, c) => {
      const total = c.sessionCount || 12;
      const current = c.currentSessionNumber || 0;
      return sum + Math.max(0, total - current);
    }, 0);
  }

  saveGroup(): void {
    if (!this.formName || !this.formStartDate || !this.formEndDate || !this.formInstructorId) {
      this.notify.showError('Please fill in all required fields.');
      return;
    }

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
      const levelId = this.formSelectedCourseLevelId();

      const courseLevels: GroupCourseAssignDto[] = levelId
        ? [
            {
              courseLevelId: levelId,
              courseId: levelId,
              currentSessionNumber: Number(this.formInitialSessionNumber()) || 0,
              initialCurrentSessionNumber: Number(this.formInitialSessionNumber()) || 0,
              status: 'Active',
              isActive: true,
            },
          ]
        : [];

      const payload: CreateGroupPayload = {
        name: this.formName,
        startDate: this.formStartDate,
        endDate: this.formEndDate,
        defaultInstructorId: this.formInstructorId,
        status: this.formStatus,
        location: this.formLocation || undefined,
        courses: courseLevels,
        courseLevels: courseLevels,
        schedules: this.scheduleSlots(),
        generateSessions: this.formAutoGenerateSessions(),
        sessionsStartFrom: this.formStartDate,
      };

      this.lmsService.createGroup(payload).subscribe({
        next: (createdGroup) => {
          this.notify.showSuccess(
            `Group "${createdGroup.name}" created with schedule and sessions generated in one step!`
          );
          this.saving.set(false);
          this.showModal.set(false);
          this.router.navigate(['/groups', createdGroup.id]);
        },
        error: (err) => {
          this.notify.showError(`Failed to create group: ${err.error?.message || 'Server error'}`);
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

  getLevelBadgeClass(level: string | number): string {
    if (level === 1 || level === '1') return 'level-1';
    if (level === 2 || level === '2') return 'level-2';
    return 'level-default';
  }

  getGroupProgress(group: Group): number {
    if (!group.courses || group.courses.length === 0) return 0;
    let totalSessions = 0;
    let completedSessions = 0;
    for (const c of group.courses) {
      const total = c.totalSessions || c.sessionCount || 0;
      totalSessions += total;
      completedSessions += c.currentSessionNumber || 0;
    }
    if (totalSessions === 0) return 0;
    return Math.min(100, Math.round((completedSessions / totalSessions) * 100));
  }

  getGroupTotalSessions(group: Group): number {
    if (!group.courses) return 0;
    return group.courses.reduce((sum, c) => sum + (c.totalSessions || c.sessionCount || 0), 0);
  }

  getGroupCompletedSessions(group: Group): number {
    if (!group.courses) return 0;
    return group.courses.reduce((sum, c) => sum + (c.currentSessionNumber || 0), 0);
  }
}
