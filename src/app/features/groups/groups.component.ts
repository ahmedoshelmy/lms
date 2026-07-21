import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LmsService, Group } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';

const STATUS_CONFIG: Record<string, { label: string; css: string; icon: string }> = {
  Running: { label: 'Running', css: 'status-running', icon: 'pi-play-circle' },
  Stopped: { label: 'Stopped', css: 'status-stopped', icon: 'pi-pause-circle' },
  Completed: { label: 'Completed', css: 'status-completed', icon: 'pi-check-circle' },
  Archived: { label: 'Archived', css: 'status-archived', icon: 'pi-archive' },
};

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss',
})
export class GroupsComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);

  groups = signal<Group[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  statusFilter = signal('All');

  statusFilters = ['All', 'Running', 'Stopped', 'Completed', 'Archived'];

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
