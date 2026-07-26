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
import { InstructorDetails, InstructorStats } from '../../../core/interfaces/InstructorDetails';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';

@Component({
  selector: 'app-instructor-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProgressSpinnerModule, ButtonModule, DialogModule],
  templateUrl: './instructor-detail.component.html',
  styleUrl: './instructor-detail.component.scss',
})
export class InstructorDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  instructorId = signal<number>(0);
  instructor = signal<InstructorDetails | null>(null);
  stats = signal<InstructorStats | null>(null);
  loading = signal<boolean>(true);

  activeTab = signal<'sessions' | 'groups' | 'upcoming'>('sessions');

  // Session filters
  sessionFilter = signal<'all' | 'completed' | 'scheduled' | 'cancelled'>('all');

  filteredSessions = computed(() => {
    const sessions = this.instructor()?.sessions || [];
    const filter = this.sessionFilter();
    if (filter === 'all') return sessions;
    return sessions.filter((s) => s.status.toLowerCase() === filter);
  });

  upcomingSessions = computed(() => {
    const now = new Date();
    return (this.instructor()?.sessions || []).filter(
      (s) => new Date(s.startsAt) > now && s.status !== 'Cancelled'
    );
  });

  sessionStats = computed(() => {
    const sessions = this.instructor()?.sessions || [];
    const now = new Date();
    const completed = sessions.filter((s) => s.status === 'Completed').length;
    const scheduled = sessions.filter(
      (s) => s.status === 'Scheduled' && new Date(s.startsAt) > now
    ).length;
    const cancelled = sessions.filter((s) => s.status === 'Cancelled').length;
    return { completed, scheduled, cancelled, total: sessions.length };
  });

  // Delete modal
  showDeleteModal = signal<boolean>(false);
  deleting = signal<boolean>(false);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) {
          this.instructorId.set(id);
          this.loadInstructorDetails(id);
          this.loadStats(id);
        }
      }
    });
  }

  loadInstructorDetails(id: number): void {
    this.loading.set(true);
    this.lmsService.getInstructorDetails(id).subscribe({
      next: (data) => {
        this.instructor.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notify.showError('Failed to load instructor details');
        this.loading.set(false);
      },
    });
  }

  loadStats(id: number): void {
    this.lmsService.getInstructorStats(id).subscribe({
      next: (data) => this.stats.set(data),
      error: () => {},
    });
  }

  goBack(): void {
    this.router.navigate(['/instructors']);
  }

  openDeleteModal(): void {
    this.showDeleteModal.set(true);
  }

  confirmDelete(): void {
    const inst = this.instructor();
    if (!inst) return;

    this.deleting.set(true);
    this.lmsService.deleteUser(inst.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Instructor ${inst.name} deleted.`);
        this.deleting.set(false);
        this.showDeleteModal.set(false);
        this.router.navigate(['/instructors']);
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

  formatHours(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

  getSessionStatusIcon(status: string): string {
    switch (status) {
      case 'Completed':
        return 'pi-check-circle';
      case 'Scheduled':
        return 'pi-calendar';
      case 'Cancelled':
        return 'pi-times-circle';
      default:
        return 'pi-circle';
    }
  }

  getGroupStatusCss(status: string): string {
    switch (status) {
      case 'Running':
        return 'bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]';
      case 'Stopped':
        return 'bg-amber-500/10 text-amber-600';
      case 'Completed':
        return 'bg-blue-500/10 text-blue-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  }
}
