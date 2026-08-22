import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role, parseRole } from '../../../core/interfaces/Role';
import {
  CancelUpcomingSessionsPayload,
  CancelUpcomingSessionsResult,
  GROUP_STATUS,
  GenerateCustomSessionsPayload,
  Group,
  GroupStudent,
  UpdateGroupPayload,
  UpdateGroupSchedulePayload,
} from '../../../core/interfaces/Group';
import { GroupCourse } from '../../../core/interfaces/GroupCourse';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { User } from '../../../core/interfaces/User';
import { Course } from '../../../core/interfaces/Course';
import { CourseLevel } from '../../../core/interfaces/CourseLevel';
import { GroupHistory } from '../../../core/interfaces/History';
import { getSessionCode, getSessionDisplayTopic } from '../../../core/utils/session-code.utils';
import { CertificateCandidate, CertificateStudentRef } from '../../../core/interfaces/Certificate';
import { CertificateService } from '../../../core/services/certificate.service';
import { CertificateDialogComponent } from '../../../shared/components/certificate-dialog/certificate-dialog.component';

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

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProgressSpinnerModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    CertificateDialogComponent,
  ],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.scss',
})
export class GroupDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private certificates = inject(CertificateService);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  groupId = signal<number>(0);
  group = signal<Group | null>(null);
  loading = signal<boolean>(true);

  activeTab = signal<'students' | 'courses' | 'schedules' | 'sessions'>('students');
  studentSearchQuery = signal<string>('');

  sessions = signal<ScheduleSession[]>([]);
  instructors = signal<User[]>([]);
  groupHistory = signal<GroupHistory | null>(null);
  courses = signal<Course[]>([]);
  courseLevels = signal<CourseLevel[]>([]);

  // Certificates
  showCertificateDialog = signal<boolean>(false);
  loadingCertificates = signal<boolean>(false);
  certificateCandidates = signal<CertificateCandidate[]>([]);

  /** Who a manually added certificate course can be issued to — the group roster. */
  readonly certificateStudents = computed<CertificateStudentRef[]>(() =>
    (this.group()?.students || []).map((student) => ({
      id: student.studentId,
      name: student.studentName,
      email: student.studentEmail,
    }))
  );

  // Promote Modal
  showPromoteModal = signal<boolean>(false);
  selectedTargetCourseId: number | null = null;
  promoting = signal<boolean>(false);

  // Add Course Modal
  showAddCourseModal = signal<boolean>(false);
  selectedCourseIdToAdd = signal<number | null>(null);
  addingCourse = signal<boolean>(false);

  // Regenerate Sessions
  regeneratingCourseId = signal<number | null>(null);
  groupCourseIdMap = computed(() => {
    const map = new Map<number, number>();
    const gh = this.groupHistory();
    if (gh?.courseHistory) {
      for (const ch of gh.courseHistory) {
        map.set(ch.courseId, ch.groupCourseId);
      }
    }
    return map;
  });
  availableCourses = computed(() => {
    const grp = this.group();
    if (!grp) return [];
    const existingIds = new Set(grp.courses.map((c) => c.courseLevelId || c.courseId));
    return this.courseLevels().filter((c) => !existingIds.has(c.id));
  });

  // Computed recommendation for next level
  recommendedNextLevel = computed(() => {
    const grp = this.group();
    const allLevels = this.courseLevels();
    if (!grp || !allLevels || allLevels.length === 0) return null;

    const assigned = grp.courses || [];
    if (assigned.length === 0) {
      const first = allLevels[0];
      return first ? { completedCourseTitle: 'Initial Setup', recommendedCourse: first } : null;
    }

    const highestAssigned = [...assigned].sort((a, b) => b.level - a.level)[0];
    if (!highestAssigned) return null;

    const nextLevelNum = highestAssigned.level + 1;
    const match = allLevels.find(
      (c) =>
        (c.topicName || '').toLowerCase() === (highestAssigned.topic || '').toLowerCase() &&
        c.level === nextLevelNum
    );

    return {
      completedCourseTitle: `${highestAssigned.title} (Level ${highestAssigned.level})`,
      recommendedCourse: match || null,
    };
  });

  // Unified Edit / Manage Modal Signals
  manageTab = signal<'overview' | 'curriculum' | 'schedule'>('overview');
  showEditModal = signal<boolean>(false);
  saving = signal<boolean>(false);
  formName = '';
  formStartDate = '';
  formEndDate = '';
  formInstructorId = 0;
  formStatus = 0;
  formLocation = '';
  editCourseItems = signal<
    {
      groupCourseId: number;
      courseLevelId: number;
      title: string;
      topic: string;
      level: number;
      totalSessions: number;
      currentSessionNumber: number;
      isActive: boolean;
      status: string;
    }[]
  >([]);
  editScheduleSlots = signal<
    { dayOfWeek: string; startTime: string; endTime: string; location: string }[]
  >([]);
  editScheduleUpdateUpcoming = signal<boolean>(true);
  newCourseLevelToAdd = signal<number | null>(null);

  statusOptions = STATUS_OPTIONS;

  // Add / Move Student Modal Signals
  showAddStudentModal = signal<boolean>(false);
  allSystemStudents = signal<User[]>([]);
  addStudentSearchQuery = signal<string>('');
  selectedStudentToMove = signal<User | null>(null);
  movingStudent = signal<boolean>(false);

  // Admin Student Management Modal Signals
  showStudentDetailsModal = signal<boolean>(false);
  showEditStudentModal = signal<boolean>(false);
  showDeleteStudentModal = signal<boolean>(false);
  showRemoveStudentModal = signal<boolean>(false);
  selectedGroupStudent = signal<GroupStudent | null>(null);
  allGroups = signal<Group[]>([]);
  editFormName = signal<string>('');
  editFormEmail = signal<string>('');
  editFormGroupId = signal<number>(0);
  savingStudent = signal<boolean>(false);
  deletingStudent = signal<boolean>(false);
  removingStudent = signal<boolean>(false);

  // Edit Total Sessions Modal
  showEditSessionsModal = signal<boolean>(false);
  editingGroupCourseId = signal<number>(0);
  editingCourseTitle = signal<string>('');
  editTotalSessionsValue = signal<number>(0);
  savingSessions = signal<boolean>(false);

  // Remove Course Confirmation
  showRemoveCourseModal = signal<boolean>(false);
  removingCourseId = signal<number>(0);
  removingCourseTitle = signal<string>('');
  removingCourseSessionCount = signal<number>(0);
  removingCourse = signal<boolean>(false);

  protected readonly Math = Math;

  // Single Unified Group Course Management Modal
  showManageCourseModal = signal<boolean>(false);
  selectedCourseForManagement = signal<GroupCourse | null>(null);
  manageCourseCurrentSession = signal<number>(0);
  manageCourseTotalSessions = signal<number>(12);
  manageCourseStatus = signal<string>('Active');
  manageCourseCustomStartDate = signal<string>('');
  manageCourseCustomCount = signal<number | null>(null);
  manageCourseIncludeToday = signal<boolean>(true);
  savingCourseManagement = signal<boolean>(false);

  // Custom Session Generation Modal
  showCustomGenerateModal = signal<boolean>(false);
  customGenerateGroupCourseId = signal<number>(0);
  customGenerateCourseTitle = signal<string>('');
  customGenerateCount = signal<number | null>(null);
  customGenerateStartDate = signal<string>('');
  customGenerateIncludeToday = signal<boolean>(true);
  generatingCustom = signal<boolean>(false);

  // Pause / Hold Group Modal Signals
  showHoldModal = signal<boolean>(false);
  holdMode = signal<'count' | 'untilDate'>('count');
  holdCount = signal<number>(1);
  holdUntilDate = signal<string>('');
  holdReason = signal<string>('Holiday / Vacation Break');
  submittingHold = signal<boolean>(false);

  // Edit Schedule Modal
  showEditScheduleModal = signal<boolean>(false);
  savingSchedule = signal<boolean>(false);

  filteredCandidateStudents = computed(() => {
    const q = this.addStudentSearchQuery().toLowerCase().trim();
    const currentStudentIds = new Set((this.group()?.students || []).map((s) => s.studentId));

    return this.allSystemStudents().filter((st) => {
      if (currentStudentIds.has(st.id)) return false;
      const matchesName = st.name.toLowerCase().includes(q);
      const matchesEmail = (st.email || '').toLowerCase().includes(q);
      const matchesGroup = (st.groupName || '').toLowerCase().includes(q);
      return !q || matchesName || matchesEmail || matchesGroup;
    });
  });

  studentSortColumn = signal<string>('studentName');
  studentSortDirection = signal<'asc' | 'desc'>('asc');

  toggleStudentSort(col: string): void {
    if (this.studentSortColumn() === col) {
      this.studentSortDirection.set(this.studentSortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.studentSortColumn.set(col);
      this.studentSortDirection.set('asc');
    }
  }

  getStudentSortIcon(col: string): string {
    if (this.studentSortColumn() !== col)
      return 'pi-sort-alt text-[var(--color-text-muted)] opacity-40';
    return this.studentSortDirection() === 'asc'
      ? 'pi-sort-amount-up-alt text-[var(--color-secondary)] font-bold'
      : 'pi-sort-amount-down text-[var(--color-secondary)] font-bold';
  }

  filteredStudents = computed(() => {
    const q = this.studentSearchQuery().toLowerCase().trim();
    const grp = this.group();
    if (!grp || !grp.students) return [];

    const list = !q
      ? [...grp.students]
      : grp.students.filter(
          (s) =>
            s.studentName.toLowerCase().includes(q) ||
            s.studentEmail.toLowerCase().includes(q) ||
            s.studentId.toString().includes(q)
        );

    const col = this.studentSortColumn();
    const dir = this.studentSortDirection();

    return list.sort((a: any, b: any) => {
      let valA: any = a[col] || '';
      let valB: any = b[col] || '';

      if (col === 'joinedAt') {
        valA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        valB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return dir === 'asc' ? valA - valB : valB - valA;
      }
      const comp = valA
        .toString()
        .localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    });
  });

  groupSessions = computed(() => {
    const grp = this.group();
    if (!grp) return [];
    return this.sessions().filter((s) => s.groupId === grp.id || s.groupName === grp.name);
  });

  upcomingSessions = computed(() => {
    return this.groupSessions().filter((s) => s.status === 'Scheduled' || s.status === 'Running');
  });

  completedSessionsFeed = computed(() => {
    return this.groupSessions().filter((s) => s.status === 'Completed');
  });

  overallProgressPercent = computed(() => {
    const grp = this.group();
    if (!grp || !grp.courses || grp.courses.length === 0) return 0;
    let totalCompleted = 0;
    let totalAll = 0;
    for (const c of grp.courses) {
      totalCompleted += c.currentSessionNumber;
      totalAll += c.totalSessions;
    }
    return totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;
  });

  totalGroupSessionsCount = computed(() => {
    const grp = this.group();
    if (!grp || !grp.courses) return 0;
    return grp.courses.reduce((acc, c) => acc + (c.totalSessions || 0), 0);
  });

  // View Course Sessions Modal
  showCourseSessionsModal = signal<boolean>(false);
  selectedCourseForSessions = signal<GroupCourse | null>(null);
  courseSessions = computed(() => {
    const course = this.selectedCourseForSessions();
    if (!course) return [];
    return this.groupSessions().filter((s) => s.courseId === course.courseId);
  });

  // Add Course: selected course details preview
  selectedCourseToAddDetails = computed(() => {
    const id = this.selectedCourseIdToAdd();
    if (!id) return null;
    return this.courses().find((c) => c.id === id) || null;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) {
          this.groupId.set(id);
          this.loadGroupDetail(id);
          this.loadGroupHistory(id);
          this.loadScheduleSessions();
          this.loadCourses();
          if (this.isAdmin()) {
            this.loadInstructors();
          }
        }
      }
    });
  }

  loadGroupDetail(id: number): void {
    this.loading.set(true);
    this.lmsService.getGroup(id).subscribe({
      next: (data) => {
        this.group.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.showError('Failed to load group details');
      },
    });
  }

  loadGroupHistory(id: number): void {
    this.lmsService.getGroupHistory(id).subscribe({
      next: (data) => this.groupHistory.set(data),
      error: () => {},
    });
  }

  loadCourses(): void {
    this.lmsService.getCourseLevels().subscribe({
      next: (data) => {
        const levels = data || [];
        this.courseLevels.set(levels);
        this.courses.set(levels as any);
      },
      error: () => {},
    });
  }

  openPromoteDialog(): void {
    const rec = this.recommendedNextLevel();
    if (rec && rec.recommendedCourse) {
      this.selectedTargetCourseId = rec.recommendedCourse.id;
    } else {
      this.selectedTargetCourseId = null;
    }
    this.showPromoteModal.set(true);
  }

  confirmPromoteGroup(): void {
    const id = this.groupId();
    if (!id) return;
    this.promoting.set(true);

    this.lmsService
      .promoteGroupNextLevel(id, {
        targetCourseId: this.selectedTargetCourseId || undefined,
        autoGenerateSessions: true,
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess('Group promoted to next level!');
          this.showPromoteModal.set(false);
          this.promoting.set(false);
          this.loadGroupDetail(id);
          this.loadGroupHistory(id);
          this.loadScheduleSessions();
        },
        error: (err) => {
          this.notify.showError('Failed to promote group: ' + (err.error?.message || 'Error'));
          this.promoting.set(false);
        },
      });
  }

  /**
   * Opens the certificate dialog for every student in the group.
   *
   * Resolves one candidate per student per completed course level, so a group
   * that finished two levels yields two pages per student. Selection and the
   * attendance override are handled inside the dialog.
   */
  openCertificateDialog(): void {
    const group = this.group();
    if (!group) return;

    this.certificateCandidates.set([]);
    this.loadingCertificates.set(true);
    this.showCertificateDialog.set(true);

    this.certificates.getCandidatesForGroup(group, this.groupHistory()).subscribe({
      next: (candidates) => {
        this.certificateCandidates.set(candidates);
        this.loadingCertificates.set(false);
      },
      error: () => {
        // errorInterceptor already surfaces the failure to the user.
        this.loadingCertificates.set(false);
      },
    });
  }

  openAddCourseDialog(): void {
    this.openAddCourseModal();
  }

  viewSessionDetails(sessionId: number): void {
    this.router.navigate(['/sessions', sessionId]);
  }

  openAddCourseModal(): void {
    this.selectedCourseIdToAdd.set(null);
    this.showAddCourseModal.set(true);
  }

  confirmAddCourse(): void {
    const id = this.groupId();
    const courseId = this.selectedCourseIdToAdd();
    if (!id || !courseId) return;

    this.addingCourse.set(true);
    this.lmsService.addCourseToGroup(id, courseId).subscribe({
      next: (group: Group) => {
        const addedCourse = group.courses?.find((c) => c.courseId === courseId);
        if (!addedCourse) {
          this.notify.showError('Course added but could not find group course entry.');
          this.addingCourse.set(false);
          this.showAddCourseModal.set(false);
          this.loadGroupDetail(id);
          return;
        }
        this.lmsService.generateGroupCourseSessions(addedCourse.id).subscribe({
          next: () => {
            this.notify.showSuccess('Course added and sessions generated!');
            this.addingCourse.set(false);
            this.showAddCourseModal.set(false);
            this.selectedCourseIdToAdd.set(null);
            this.loadGroupDetail(id);
            this.loadGroupHistory(id);
            this.loadScheduleSessions();
          },
          error: (err) => {
            this.notify.showWarn(
              'Course added but session generation failed: ' +
                (err.error?.message || err.message || 'Error')
            );
            this.addingCourse.set(false);
            this.showAddCourseModal.set(false);
            this.loadGroupDetail(id);
            this.loadGroupHistory(id);
          },
        });
      },
      error: (err) => {
        this.notify.showError('Failed to add course: ' + (err.error?.message || 'Error'));
        this.addingCourse.set(false);
      },
    });
  }

  regenerateSessions(groupCourse: GroupCourse): void {
    const id = this.groupId();
    if (!id) return;

    const groupCourseId = this.groupCourseIdMap().get(groupCourse.courseId);
    if (!groupCourseId) {
      this.notify.showError('Could not find group course ID. Please reload and try again.');
      return;
    }

    this.regeneratingCourseId.set(groupCourse.courseId);
    this.lmsService.generateGroupCourseSessions(groupCourseId).subscribe({
      next: () => {
        this.notify.showSuccess('Sessions regenerated for ' + groupCourse.title);
        this.regeneratingCourseId.set(null);
        this.loadGroupDetail(id);
        this.loadGroupHistory(id);
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError('Failed to regenerate sessions: ' + (err.error?.message || 'Error'));
        this.regeneratingCourseId.set(null);
      },
    });
  }

  loadScheduleSessions(): void {
    this.lmsService.getSchedule().subscribe({
      next: (data) => this.sessions.set(data || []),
      error: () => {},
    });
  }

  loadInstructors(): void {
    this.lmsService.getInstructors().subscribe({
      next: (data) => this.instructors.set(data || []),
      error: () => {},
    });
  }

  openEditModal(): void {
    const grp = this.group();
    if (!grp) return;
    this.formName = grp.name;
    this.formStartDate = grp.startDate ? grp.startDate.split('T')[0] : '';
    this.formEndDate = grp.endDate ? grp.endDate.split('T')[0] : '';
    this.formInstructorId = grp.defaultInstructorId || 0;
    this.formStatus = GROUP_STATUS[grp.status] ?? 0;
    this.formLocation = grp.location || 'MOA';

    // Populate editable courses
    const coursesToEdit = (grp.courses || []).map((c, idx) => ({
      groupCourseId: c.id,
      courseLevelId: c.courseLevelId || c.courseId,
      title: c.title || `Level ${c.level}`,
      topic: c.topic || '',
      level: c.level,
      totalSessions: c.totalSessions || c.sessionCount || 12,
      currentSessionNumber: c.currentSessionNumber || 0,
      isActive: c.status === 'Active',
      status: c.status || (idx === 0 ? 'Active' : 'Pending'),
    }));
    this.editCourseItems.set(coursesToEdit);

    // Populate editable schedule slots
    const schedulesToEdit = (grp.schedules || []).map((s) => ({
      dayOfWeek: s.dayOfWeek || 'Saturday',
      startTime: s.startTime || '13:30',
      endTime: s.endTime || '15:00',
      location: s.location || grp.location || 'MOA',
    }));
    if (schedulesToEdit.length === 0) {
      schedulesToEdit.push({
        dayOfWeek: 'Saturday',
        startTime: '13:30',
        endTime: '15:00',
        location: grp.location || 'MOA',
      });
    }
    this.editScheduleSlots.set(schedulesToEdit);
    this.editScheduleUpdateUpcoming.set(true);
    this.newCourseLevelToAdd.set(null);
    this.manageTab.set('overview');
    this.showEditModal.set(true);
  }

  addCourseToUnifiedEdit(): void {
    const levelId = this.newCourseLevelToAdd();
    if (!levelId) return;
    const match = this.courseLevels().find((c) => c.id === levelId);
    if (!match) return;

    const existing = this.editCourseItems();
    const isFirst = existing.length === 0;
    this.editCourseItems.update((items) => [
      ...items,
      {
        groupCourseId: 0,
        courseLevelId: match.id,
        title: match.title || `Level ${match.level}`,
        topic: match.topicName || '',
        level: match.level,
        totalSessions: match.sessionCount || 12,
        currentSessionNumber: 0,
        isActive: isFirst,
        status: isFirst ? 'Active' : 'Pending',
      },
    ]);
    this.newCourseLevelToAdd.set(null);
  }

  removeCourseFromUnifiedEdit(index: number): void {
    this.editCourseItems.update((items) => items.filter((_, i) => i !== index));
  }

  setUnifiedActiveCourse(index: number): void {
    this.editCourseItems.update((items) =>
      items.map((item, i) => ({
        ...item,
        isActive: i === index,
        status: i === index ? 'Active' : item.status === 'Active' ? 'Pending' : item.status,
      }))
    );
  }

  addScheduleSlotToUnifiedEdit(): void {
    this.editScheduleSlots.update((slots) => [
      ...slots,
      {
        dayOfWeek: 'Sunday',
        startTime: '15:00',
        endTime: '16:30',
        location: this.formLocation || 'MOA',
      },
    ]);
  }

  removeScheduleSlotFromUnifiedEdit(index: number): void {
    this.editScheduleSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  saveGroup(): void {
    const id = this.groupId();
    if (!id) return;
    if (!this.formName || !this.formStartDate || !this.formEndDate || !this.formInstructorId) {
      this.notify.showError('Please fill in all required fields.');
      return;
    }

    this.saving.set(true);
    const payload: UpdateGroupPayload = {
      name: this.formName,
      startDate: this.formStartDate,
      endDate: this.formEndDate,
      defaultInstructorId: Number(this.formInstructorId),
      status: Number(this.formStatus),
      location: this.formLocation || undefined,
      schedules: this.editScheduleSlots().map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location || this.formLocation || undefined,
      })),
      courses: this.editCourseItems().map((c, idx) => ({
        groupCourseId: c.groupCourseId,
        courseLevelId: c.courseLevelId,
        orderIndex: idx,
        totalSessions: Number(c.totalSessions) || 12,
        currentSessionNumber: Number(c.currentSessionNumber) || 0,
        isActive: c.isActive,
        status: c.isActive ? ('Active' as any) : c.status,
      })),
      updateUpcomingSessions: this.editScheduleUpdateUpcoming(),
    };

    this.lmsService.updateGroup(id, payload).subscribe({
      next: () => {
        this.notify.showSuccess('All group details, curriculum, and schedules saved!');
        this.saving.set(false);
        this.showEditModal.set(false);
        this.loadGroupDetail(id);
      },
      error: (err) => {
        this.notify.showError(`Failed to update group: ${err.error?.message || 'Server error'}`);
        this.saving.set(false);
      },
    });
  }

  openManageCourseModal(course: GroupCourse): void {
    this.selectedCourseForManagement.set(course);
    this.manageCourseCurrentSession.set(course.currentSessionNumber || 0);
    this.manageCourseTotalSessions.set(course.totalSessions || course.sessionCount || 12);
    this.manageCourseStatus.set(course.status || 'Active');
    this.manageCourseCustomStartDate.set(new Date().toISOString().split('T')[0]);
    this.manageCourseCustomCount.set(null);
    this.manageCourseIncludeToday.set(true);
    this.showManageCourseModal.set(true);
  }

  saveManagedCourseDetails(): void {
    const course = this.selectedCourseForManagement();
    const grp = this.group();
    if (!course || !grp) return;

    this.savingCourseManagement.set(true);

    const payload: UpdateGroupPayload = {
      name: grp.name,
      startDate: grp.startDate ? grp.startDate.split('T')[0] : '',
      endDate: grp.endDate ? grp.endDate.split('T')[0] : '',
      defaultInstructorId: grp.defaultInstructorId,
      status: GROUP_STATUS[grp.status] ?? 0,
      courses: [
        {
          groupCourseId: course.id,
          courseLevelId: course.courseLevelId || course.courseId,
          totalSessions: Number(this.manageCourseTotalSessions()) || 12,
          currentSessionNumber: Number(this.manageCourseCurrentSession()) || 0,
          isActive: this.manageCourseStatus() === 'Active',
          status: this.manageCourseStatus() as any,
        },
      ],
    };

    this.lmsService.updateGroup(grp.id, payload).subscribe({
      next: () => {
        this.notify.showSuccess(`Course settings for "${course.title}" updated.`);
        this.savingCourseManagement.set(false);
        this.showManageCourseModal.set(false);
        this.loadGroupDetail(grp.id);
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError(`Failed to update course: ${err.error?.message || 'Server error'}`);
        this.savingCourseManagement.set(false);
      },
    });
  }

  generateCustomSessionsFromManagedModal(): void {
    const course = this.selectedCourseForManagement();
    if (!course) return;

    this.generatingCustom.set(true);

    const payload = {
      groupCourseId: course.id,
      count: this.manageCourseCustomCount() || undefined,
      startFromDate: this.manageCourseCustomStartDate() || undefined,
      includeTodayIfMatching: this.manageCourseIncludeToday(),
    };

    this.lmsService.generateCustomSessions(payload).subscribe({
      next: (res) => {
        this.notify.showSuccess(res.message || 'Custom sessions generated successfully.');
        this.generatingCustom.set(false);
        this.showManageCourseModal.set(false);
        this.loadGroupDetail(this.groupId());
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError(err.error?.message || 'Failed to generate custom sessions.');
        this.generatingCustom.set(false);
      },
    });
  }

  regenerateSessionsFromManagedModal(): void {
    const course = this.selectedCourseForManagement();
    if (!course) return;

    this.regeneratingCourseId.set(course.courseId);

    this.lmsService.generateGroupCourseSessions(course.id).subscribe({
      next: (res) => {
        this.notify.showSuccess(res.message || 'Sessions regenerated successfully.');
        this.regeneratingCourseId.set(null);
        this.showManageCourseModal.set(false);
        this.loadGroupDetail(this.groupId());
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError(err.error?.message || 'Failed to regenerate sessions.');
        this.regeneratingCourseId.set(null);
      },
    });
  }

  removeCourseFromManagedModal(): void {
    const course = this.selectedCourseForManagement();
    if (!course) return;
    this.showManageCourseModal.set(false);
    this.openRemoveCourseModal(course.courseId);
  }

  getStatusCss(status: string): string {
    return STATUS_CONFIG[status]?.css ?? 'status-archived';
  }

  getSessionCode(s: any): string {
    return getSessionCode(s);
  }

  getSessionDisplayTopic(s: any): string {
    return getSessionDisplayTopic(s);
  }

  getStatusIcon(status: string): string {
    return STATUS_CONFIG[status]?.icon ?? 'pi-circle';
  }

  getGroupProgress(group: Group | null): number {
    if (!group || !group.courses || group.courses.length === 0) return 0;
    let totalSessions = 0;
    let completedSessions = 0;
    for (const c of group.courses) {
      totalSessions += c.totalSessions || 0;
      completedSessions += c.currentSessionNumber || 0;
    }
    if (totalSessions === 0) return 0;
    return Math.round((completedSessions / totalSessions) * 100);
  }

  openAddStudentModal(): void {
    this.addStudentSearchQuery.set('');
    this.selectedStudentToMove.set(null);
    this.lmsService.getStudents().subscribe({
      next: (users) => {
        const studentsOnly = (users || []).filter(
          (u) => parseRole(u.role) === Role.Student || (u.role as any) === 'Student'
        );
        this.allSystemStudents.set(studentsOnly);
        this.showAddStudentModal.set(true);
      },
      error: () => {
        this.notify.showError('Failed to load students list.');
      },
    });
  }

  selectStudentToMove(student: User): void {
    this.selectedStudentToMove.set(student);
  }

  confirmMoveStudent(): void {
    const student = this.selectedStudentToMove();
    const grp = this.group();
    if (!student || !grp) return;

    this.movingStudent.set(true);
    this.lmsService
      .updateUser(student.id, {
        name: student.name,
        email: student.email,
        role: Role.Student,
        groupId: grp.id,
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess(`Added ${student.name} to ${grp.name}`);
          this.movingStudent.set(false);
          this.showAddStudentModal.set(false);
          this.selectedStudentToMove.set(null);
          this.loadGroupDetail(grp.id);
        },
        error: () => {
          this.movingStudent.set(false);
        },
      });
  }

  // ─── Admin Student Management Methods ─────────────────────────────────────

  openStudentDetailsModal(s: GroupStudent): void {
    this.router.navigate(['/students', s.studentId]);
  }

  openEditStudentModal(s: GroupStudent): void {
    this.selectedGroupStudent.set(s);
    this.editFormName.set(s.studentName);
    this.editFormEmail.set(s.studentEmail);
    this.editFormGroupId.set(this.groupId());

    this.lmsService.getGroups().subscribe({
      next: (groups) => {
        this.allGroups.set(groups || []);
        this.showEditStudentModal.set(true);
      },
      error: () => {
        this.showEditStudentModal.set(true);
      },
    });
  }

  saveStudentChanges(): void {
    const s = this.selectedGroupStudent();
    if (!s) return;

    const name = this.editFormName().trim();
    const email = this.editFormEmail().trim();
    const groupId = this.editFormGroupId() || undefined;

    if (!name || !email) {
      this.notify.showWarn('Please enter name and email.');
      return;
    }

    this.savingStudent.set(true);
    this.lmsService
      .updateUser(s.studentId, {
        name,
        email,
        role: Role.Student,
        groupId,
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess(`Student ${name} updated.`);
          this.savingStudent.set(false);
          this.showEditStudentModal.set(false);
          this.loadGroupDetail(this.groupId());
        },
        error: () => {
          this.savingStudent.set(false);
        },
      });
  }

  openDeleteStudentModal(s: GroupStudent): void {
    this.selectedGroupStudent.set(s);
    this.showDeleteStudentModal.set(true);
  }

  confirmDeleteStudent(): void {
    const s = this.selectedGroupStudent();
    if (!s) return;

    this.deletingStudent.set(true);
    this.lmsService.deleteUser(s.studentId).subscribe({
      next: () => {
        this.notify.showSuccess(`Student ${s.studentName} deleted.`);
        this.deletingStudent.set(false);
        this.showDeleteStudentModal.set(false);
        this.loadGroupDetail(this.groupId());
      },
      error: () => {
        this.deletingStudent.set(false);
      },
    });
  }

  openRemoveStudentModal(s: GroupStudent): void {
    this.selectedGroupStudent.set(s);
    this.showRemoveStudentModal.set(true);
  }

  confirmRemoveStudent(): void {
    const s = this.selectedGroupStudent();
    if (!s) return;

    this.removingStudent.set(true);
    this.lmsService.removeStudentFromGroup(this.groupId(), s.studentId).subscribe({
      next: () => {
        this.notify.showSuccess(`${s.studentName} has been removed from ${this.group()?.name}.`);
        this.removingStudent.set(false);
        this.showRemoveStudentModal.set(false);
        this.selectedGroupStudent.set(null);
        this.loadGroupDetail(this.groupId());
      },
      error: () => {
        this.removingStudent.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/groups']);
  }

  viewInstructor(instructorId: number): void {
    this.router.navigate(['/instructors', instructorId]);
  }

  openCourseSessionsModal(gc: GroupCourse): void {
    this.selectedCourseForSessions.set(gc);
    this.showCourseSessionsModal.set(true);
  }

  openEditSessionsModal(gc: GroupCourse): void {
    this.editingGroupCourseId.set(this.groupCourseIdMap().get(gc.courseId) || 0);
    this.editingCourseTitle.set(gc.title);
    this.editTotalSessionsValue.set(gc.totalSessions);
    this.showEditSessionsModal.set(true);
  }

  saveTotalSessions(): void {
    const groupId = this.groupId();
    const groupCourseId = this.editingGroupCourseId();
    const totalSessions = this.editTotalSessionsValue();
    if (!groupId || !groupCourseId || totalSessions < 1) return;

    this.savingSessions.set(true);
    this.lmsService.updateGroupCourseSessions(groupId, groupCourseId, totalSessions).subscribe({
      next: () => {
        this.notify.showSuccess('Total sessions updated successfully.');
        this.savingSessions.set(false);
        this.showEditSessionsModal.set(false);
        this.loadGroupDetail(groupId);
        this.loadGroupHistory(groupId);
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError('Failed to update sessions: ' + (err.error?.message || 'Error'));
        this.savingSessions.set(false);
      },
    });
  }

  openRemoveCourseModal(courseId: number): void {
    const grp = this.group();
    if (!grp) return;
    const course = grp.courses.find((c) => c.courseId === courseId);
    if (!course) return;

    this.removingCourseId.set(courseId);
    this.removingCourseTitle.set(course.title);
    this.removingCourseSessionCount.set(course.scheduledSessionCount);
    this.showRemoveCourseModal.set(true);
  }

  confirmRemoveCourse(forceDelete: boolean): void {
    const groupId = this.groupId();
    const courseId = this.removingCourseId();
    if (!groupId || !courseId) return;

    this.removingCourse.set(true);
    this.lmsService.removeCourseFromGroup(groupId, courseId, forceDelete).subscribe({
      next: () => {
        this.notify.showSuccess('Course removed from group.');
        this.removingCourse.set(false);
        this.showRemoveCourseModal.set(false);
        this.loadGroupDetail(groupId);
        this.loadGroupHistory(groupId);
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError('Failed to remove course: ' + (err.error?.message || 'Error'));
        this.removingCourse.set(false);
      },
    });
  }

  openCustomGenerateModal(gc: GroupCourse): void {
    const groupCourseId = this.groupCourseIdMap().get(gc.courseId) || 0;
    this.customGenerateGroupCourseId.set(groupCourseId);
    this.customGenerateCourseTitle.set(gc.title);
    this.customGenerateCount.set(gc.remainingSessions);
    this.customGenerateStartDate.set('');
    this.customGenerateIncludeToday.set(true);
    this.showCustomGenerateModal.set(true);
  }

  submitCustomGenerate(): void {
    const count = this.customGenerateCount();
    if (!count || count < 1) {
      this.notify.showError('Please enter a valid session count.');
      return;
    }

    this.generatingCustom.set(true);
    const payload: GenerateCustomSessionsPayload = {
      groupCourseId: this.customGenerateGroupCourseId(),
      count: count,
      startFromDate: this.customGenerateStartDate() || undefined,
      includeTodayIfMatching: this.customGenerateIncludeToday(),
    };

    this.lmsService.generateCustomSessions(payload).subscribe({
      next: () => {
        this.notify.showSuccess(`${count} sessions generated successfully.`);
        this.generatingCustom.set(false);
        this.showCustomGenerateModal.set(false);
        this.loadGroupDetail(this.groupId());
        this.loadGroupHistory(this.groupId());
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError('Failed to generate sessions: ' + (err.error?.message || 'Error'));
        this.generatingCustom.set(false);
      },
    });
  }

  openEditScheduleModal(): void {
    const grp = this.group();
    if (!grp) return;

    const slots = (grp.schedules || []).map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location || '',
    }));

    if (slots.length === 0) {
      slots.push({ dayOfWeek: 'Sunday', startTime: '10:00', endTime: '12:00', location: '' });
    }

    this.editScheduleSlots.set(JSON.parse(JSON.stringify(slots)));
    this.editScheduleUpdateUpcoming.set(false);
    this.showEditScheduleModal.set(true);
  }

  addScheduleSlot(): void {
    this.editScheduleSlots.update((slots) => [
      ...slots,
      { dayOfWeek: 'Sunday', startTime: '10:00', endTime: '12:00', location: '' },
    ]);
  }

  removeScheduleSlot(index: number): void {
    this.editScheduleSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  updateSlotDayOfWeek(index: number, value: string): void {
    this.editScheduleSlots.update((slots) => {
      const copy = [...slots];
      copy[index] = { ...copy[index], dayOfWeek: value };
      return copy;
    });
  }

  updateSlotStartTime(index: number, value: string): void {
    this.editScheduleSlots.update((slots) => {
      const copy = [...slots];
      copy[index] = { ...copy[index], startTime: value };
      return copy;
    });
  }

  updateSlotEndTime(index: number, value: string): void {
    this.editScheduleSlots.update((slots) => {
      const copy = [...slots];
      copy[index] = { ...copy[index], endTime: value };
      return copy;
    });
  }

  updateSlotLocation(index: number, value: string): void {
    this.editScheduleSlots.update((slots) => {
      const copy = [...slots];
      copy[index] = { ...copy[index], location: value };
      return copy;
    });
  }

  saveSchedule(): void {
    const groupId = this.groupId();
    if (!groupId) return;

    const slots = this.editScheduleSlots();
    if (slots.length === 0) {
      this.notify.showError('At least one schedule slot is required.');
      return;
    }

    this.savingSchedule.set(true);
    const payload: UpdateGroupSchedulePayload = {
      schedules: slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location || undefined,
      })),
      updateUpcomingSessions: this.editScheduleUpdateUpcoming(),
    };

    this.lmsService.updateGroupSchedule(groupId, payload).subscribe({
      next: () => {
        this.notify.showSuccess('Schedule updated successfully.');
        this.savingSchedule.set(false);
        this.showEditScheduleModal.set(false);
        this.loadGroupDetail(groupId);
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.notify.showError('Failed to update schedule: ' + (err.error?.message || 'Error'));
        this.savingSchedule.set(false);
      },
    });
  }

  // ─── Current Session Number Override (R3, R4, R5) ──────────────────────────

  showEditSessionNumberModal = signal<boolean>(false);
  editingSessionNumberGc = signal<GroupCourse | null>(null);
  newCurrentSessionNumberInput = signal<number>(0);
  sessionNumberConflictMessage = signal<string | null>(null);
  savingSessionNumber = signal<boolean>(false);

  openEditSessionNumberModal(gc: GroupCourse): void {
    this.editingSessionNumberGc.set(gc);
    this.newCurrentSessionNumberInput.set(gc.currentSessionNumber);
    this.sessionNumberConflictMessage.set(null);
    this.showEditSessionNumberModal.set(true);
  }

  saveCurrentSessionNumber(confirmDeleteUpcoming = false): void {
    const grp = this.group();
    const gc = this.editingSessionNumberGc();
    if (!grp || !gc) return;

    const newNumber = Number(this.newCurrentSessionNumberInput());
    if (isNaN(newNumber) || newNumber < 0) {
      this.notify.showError('Invalid session number.');
      return;
    }

    this.savingSessionNumber.set(true);
    this.lmsService
      .updateGroupCurrentSessionNumber(grp.id, gc.id, {
        newCurrentSessionNumber: newNumber,
        confirmDeleteUpcomingSessions: confirmDeleteUpcoming,
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess('Current session number updated successfully.');
          this.savingSessionNumber.set(false);
          this.showEditSessionNumberModal.set(false);
          this.sessionNumberConflictMessage.set(null);
          this.loadGroupDetail(grp.id);
          this.loadScheduleSessions();
        },
        error: (err) => {
          this.savingSessionNumber.set(false);
          if (err.status === 409) {
            this.sessionNumberConflictMessage.set(
              err.error?.message ||
                'Changing current session number requires deleting and regenerating upcoming scheduled sessions.'
            );
          } else {
            this.notify.showError(
              'Failed to update session number: ' + (err.error?.message || 'Error')
            );
          }
        },
      });
  }

  // Hold / Pause Group Methods
  openHoldModal(): void {
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    this.holdUntilDate.set(twoWeeksLater.toISOString().split('T')[0]);
    this.holdMode.set('count');
    this.holdCount.set(1);
    this.holdReason.set('Holiday / Vacation Break');
    this.showHoldModal.set(true);
  }

  closeHoldModal(): void {
    this.showHoldModal.set(false);
  }

  submitHoldGroup(): void {
    const groupData = this.group();
    if (!groupData) return;

    if (this.holdMode() === 'count' && (!this.holdCount() || this.holdCount() < 1)) {
      this.notify.showError('Please enter a valid session count (at least 1).');
      return;
    }

    if (this.holdMode() === 'untilDate' && !this.holdUntilDate()) {
      this.notify.showError('Please select a resume date.');
      return;
    }

    this.submittingHold.set(true);

    const payload: CancelUpcomingSessionsPayload = {
      reason: this.holdReason().trim() || 'Group Hold / Vacation',
    };

    if (this.holdMode() === 'count') {
      payload.count = Number(this.holdCount());
    } else {
      payload.holdUntilDate = this.holdUntilDate();
    }

    this.lmsService.cancelUpcomingGroupSessions(groupData.id, payload).subscribe({
      next: (res) => {
        this.submittingHold.set(false);
        this.showHoldModal.set(false);

        this.notify.showSuccess(
          `Group held successfully: ${res.cancelledCount} session(s) paused, ${res.substitutesCreated} substitute(s) scheduled, and ${res.shiftedCount} future session(s) shifted forward.`
        );

        this.loadGroupDetail(groupData.id);
        this.loadGroupHistory(groupData.id);
        this.loadScheduleSessions();
      },
      error: (err) => {
        this.submittingHold.set(false);
        this.notify.showError('Failed to hold group: ' + (err.error?.message || 'Error'));
      },
    });
  }
}
