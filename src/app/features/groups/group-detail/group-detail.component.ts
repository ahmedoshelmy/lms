import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/interfaces/Role';
import { Group, GroupStudent, UpdateGroupPayload } from '../../../core/interfaces/Group';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { User } from '../../../core/interfaces/User';

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
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, ButtonModule, DialogModule],
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

  filteredStudents = computed(() => {
    const q = this.studentSearchQuery().toLowerCase().trim();
    const grp = this.group();
    if (!grp || !grp.students) return [];
    if (!q) return grp.students;
    return grp.students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.studentEmail.toLowerCase().includes(q) ||
        s.studentId.toString().includes(q)
    );
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
          this.loadScheduleSessions();
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

  goBack(): void {
    this.router.navigate(['/groups']);
  }
}
