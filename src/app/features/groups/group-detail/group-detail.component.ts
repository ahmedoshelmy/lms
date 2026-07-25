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
import { Role } from '../../../core/interfaces/Role';
import { Group, GroupStudent, UpdateGroupPayload } from '../../../core/interfaces/Group';
import { GroupCourse } from '../../../core/interfaces/GroupCourse';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { User } from '../../../core/interfaces/User';
import { Course } from '../../../core/interfaces/Course';
import { GroupHistory } from '../../../core/interfaces/History';

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
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, ButtonModule, DialogModule, SelectModule],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.scss',
})
export class GroupDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);

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
  availableCourses = computed(() => {
    const grp = this.group();
    if (!grp) return [];
    const existingIds = new Set(grp.courses.map((c) => c.courseId));
    return this.courses().filter((c) => !existingIds.has(c.id));
  });

  // Computed recommendation for next level
  recommendedNextLevel = computed(() => {
    const gh = this.groupHistory();
    if (!gh || !gh.courseHistory || gh.courseHistory.length === 0) return null;
    const lastCourse = gh.courseHistory[gh.courseHistory.length - 1];
    if (lastCourse && lastCourse.isCompleted) {
      const nextLevelStr = (parseInt(lastCourse.level, 10) + 1).toString();
      const match = this.courses().find(
        (c) => c.topic.toLowerCase() === lastCourse.topic.toLowerCase() && c.level === nextLevelStr
      );
      return {
        completedCourseTitle: lastCourse.courseTitle,
        recommendedCourse: match,
      };
    }
    return null;
  });

  // Edit Modal Signals
  showEditModal = signal<boolean>(false);
  saving = signal<boolean>(false);
  formName = '';
  formStartDate = '';
  formEndDate = '';
  formInstructorId = 0;
  formStatus = 0;
  formLocation = '';

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
  selectedGroupStudent = signal<GroupStudent | null>(null);
  allGroups = signal<Group[]>([]);
  editFormName = signal<string>('');
  editFormEmail = signal<string>('');
  editFormGroupId = signal<number>(0);
  savingStudent = signal<boolean>(false);
  deletingStudent = signal<boolean>(false);

  filteredCandidateStudents = computed(() => {
    const q = this.addStudentSearchQuery().toLowerCase().trim();
    const currentStudentIds = new Set(
      (this.group()?.students || []).map((s) => s.studentId)
    );

    return this.allSystemStudents().filter((st) => {
      if (currentStudentIds.has(st.id)) return false;
      const matchesName = st.name.toLowerCase().includes(q);
      const matchesEmail = st.email.toLowerCase().includes(q);
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
      const comp = valA.toString().localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    });
  });

  groupSessions = computed(() => {
    const grp = this.group();
    if (!grp) return [];
    return this.sessions().filter((s) => s.groupId === grp.id || s.groupName === grp.name);
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
    this.lmsService.getCourses().subscribe({
      next: (data) => this.courses.set(data || []),
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
      next: (groupCourse: GroupCourse) => {
        this.lmsService.generateGroupCourseSessions(groupCourse.id).subscribe({
          next: () => {
            this.notify.showSuccess('Course added and sessions generated!');
            this.addingCourse.set(false);
            this.showAddCourseModal.set(false);
            this.selectedCourseIdToAdd.set(null);
            this.loadGroupDetail(id);
            this.loadScheduleSessions();
          },
          error: (err) => {
            this.notify.showWarn('Course added but session generation failed: ' + (err.error?.message || 'Error'));
            this.addingCourse.set(false);
            this.showAddCourseModal.set(false);
            this.loadGroupDetail(id);
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

    this.regeneratingCourseId.set(groupCourse.id);
    this.lmsService.generateGroupCourseSessions(groupCourse.id).subscribe({
      next: () => {
        this.notify.showSuccess('Sessions regenerated for ' + groupCourse.title);
        this.regeneratingCourseId.set(null);
        this.loadGroupDetail(id);
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
    this.formStatus = STATUS_MAP[grp.status] ?? 0;
    this.formLocation = grp.location || '';
    this.showEditModal.set(true);
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
      defaultInstructorId: this.formInstructorId,
      status: this.formStatus,
      location: this.formLocation || undefined,
    };

    this.lmsService.updateGroup(id, payload).subscribe({
      next: () => {
        this.notify.showSuccess('Group details updated.');
        this.saving.set(false);
        this.showEditModal.set(false);
        this.loadGroupDetail(id);
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

  getGroupProgress(group: Group | null): number {
    if (!group || !group.courses || group.courses.length === 0) return 0;
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

  openAddStudentModal(): void {
    this.addStudentSearchQuery.set('');
    this.selectedStudentToMove.set(null);
    this.lmsService.getStudents().subscribe({
      next: (users) => {
        const studentsOnly = (users || []).filter((u) => u.role === Role.Student);
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
    this.selectedGroupStudent.set(s);
    this.showStudentDetailsModal.set(true);
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

  goBack(): void {
    this.router.navigate(['/groups']);
  }
}
