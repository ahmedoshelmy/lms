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
import { Group } from '../../../core/interfaces/Group';
import { User } from '../../../core/interfaces/User';
import {
  StudentDetails,
  StudentAttendanceRecord,
  StudentUpcomingSession,
} from '../../../core/interfaces/StudentDetails';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProgressSpinnerModule, ButtonModule, DialogModule],
  templateUrl: './student-detail.component.html',
  styleUrl: './student-detail.component.scss',
})
export class StudentDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  studentId = signal<number>(0);
  student = signal<StudentDetails | null>(null);
  loading = signal<boolean>(true);
  groups = signal<Group[]>([]);

  activeTab = signal<'attendance' | 'groups' | 'upcoming'>('attendance');

  // Edit modal
  showEditModal = signal<boolean>(false);
  saving = signal<boolean>(false);
  formName = signal<string>('');
  formEmail = signal<string>('');
  formPassword = signal<string>('');
  formGroupId = signal<number>(0);

  // Delete modal
  showDeleteModal = signal<boolean>(false);
  deleting = signal<boolean>(false);

  // Attendance stats
  attendanceStats = computed(() => {
    const records = this.student()?.attendanceHistory || [];
    const total = records.length;
    const present = records.filter((r) => r.attendanceStatus === 'Present').length;
    const late = records.filter((r) => r.attendanceStatus === 'Late').length;
    const absent = records.filter((r) => r.attendanceStatus === 'Absent').length;
    const excused = records.filter((r) => r.attendanceStatus === 'Excused').length;
    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, excused, attendanceRate };
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) {
          this.studentId.set(id);
          this.loadStudentDetails(id);
          this.loadGroups();
        }
      }
    });
  }

  loadStudentDetails(id: number): void {
    this.loading.set(true);
    this.lmsService.getStudentDetails(id).subscribe({
      next: (data) => {
        this.student.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notify.showError('Failed to load student details');
        this.loading.set(false);
      },
    });
  }

  loadGroups(): void {
    this.lmsService.getGroups().subscribe({
      next: (data) => this.groups.set(data || []),
      error: () => {},
    });
  }

  goBack(): void {
    this.router.navigate(['/students']);
  }

  openEditModal(): void {
    const s = this.student();
    if (!s) return;
    this.formName.set(s.name);
    this.formEmail.set(s.email);
    this.formPassword.set('');
    this.formGroupId.set(s.currentGroup?.groupId || 0);
    this.showEditModal.set(true);
  }

  saveStudent(): void {
    const s = this.student();
    if (!s) return;

    const name = this.formName().trim();
    const email = this.formEmail().trim();
    const password = this.formPassword().trim();
    const groupId = this.formGroupId() || undefined;

    if (!name) {
      this.notify.showWarn('Please enter student name.');
      return;
    }

    this.saving.set(true);
    this.lmsService
      .updateUser(s.id, {
        name,
        email: email || s.email,
        role: Role.Student,
        password: password || undefined,
        groupId,
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess('Student updated successfully.');
          this.saving.set(false);
          this.showEditModal.set(false);
          this.loadStudentDetails(s.id);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  openDeleteModal(): void {
    this.showDeleteModal.set(true);
  }

  confirmDelete(): void {
    const s = this.student();
    if (!s) return;

    this.deleting.set(true);
    this.lmsService.deleteUser(s.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Student ${s.name} deleted.`);
        this.deleting.set(false);
        this.showDeleteModal.set(false);
        this.router.navigate(['/students']);
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDateTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getAttendanceStatusCss(status: string): string {
    switch (status) {
      case 'Present':
        return 'bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]';
      case 'Late':
        return 'bg-amber-500/10 text-amber-600';
      case 'Absent':
        return 'bg-[color-mix(in_srgb,var(--color-error)_12%,transparent)] text-[var(--color-error)]';
      case 'Excused':
        return 'bg-blue-500/10 text-blue-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  }

  getAttendanceIcon(status: string): string {
    switch (status) {
      case 'Present':
        return 'pi-check-circle';
      case 'Late':
        return 'pi-clock';
      case 'Absent':
        return 'pi-times-circle';
      case 'Excused':
        return 'pi-info-circle';
      default:
        return 'pi-circle';
    }
  }

  getSessionStatusCss(status: string): string {
    switch (status) {
      case 'Completed':
        return 'bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]';
      case 'Scheduled':
        return 'bg-blue-500/10 text-blue-600';
      case 'Cancelled':
        return 'bg-[color-mix(in_srgb,var(--color-error)_12%,transparent)] text-[var(--color-error)]';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  }
}
