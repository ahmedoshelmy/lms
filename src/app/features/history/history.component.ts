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
import { GroupHistory, GroupCourseHistoryItem } from '../../core/interfaces/History';
import { ScheduleSession } from '../../core/interfaces/ScheduleSession';
import { Course } from '../../core/interfaces/Course';
import { ClockFormatService } from '../../core/services/clock-format.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, DialogModule, ButtonModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  /** Times read as 16:30 or 4:30 pm, whichever the reader chose. */
  protected readonly clock = inject(ClockFormatService);

  private router = inject(Router);
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  activeTab = signal<'groups' | 'sessions'>('groups');
  loading = signal(true);
  searchQuery = signal('');
  statusFilter = signal('All');
  groupFilter = signal<number | 'All'>('All');

  groupsHistory = signal<GroupHistory[]>([]);
  sessionsHistory = signal<ScheduleSession[]>([]);
  courses = signal<Course[]>([]);

  // Promote Modal state
  showPromoteModal = false;
  selectedGroupHistory: GroupHistory | null = null;
  selectedTargetCourseId: number | null = null;
  promoting = false;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    this.lmsService.getCourses().subscribe({
      next: (courses) => this.courses.set(courses),
      error: () => {},
    });

    this.lmsService.getAllGroupsHistory().subscribe({
      next: (history) => {
        this.groupsHistory.set(history);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.showError('Failed to load group history');
        this.loading.set(false);
      },
    });

    this.loadSessionsHistory();
  }

  loadSessionsHistory(): void {
    const filterObj: any = {};
    if (this.groupFilter() !== 'All') {
      filterObj.groupId = Number(this.groupFilter());
    }
    if (this.statusFilter() !== 'All') {
      filterObj.status = this.statusFilter();
    }

    this.lmsService.getSessionHistory(filterObj).subscribe({
      next: (sessions) => this.sessionsHistory.set(sessions),
      error: () => {},
    });
  }

  setTab(tab: 'groups' | 'sessions'): void {
    this.activeTab.set(tab);
    if (tab === 'sessions' && this.sessionsHistory().length === 0) {
      this.loadSessionsHistory();
    }
  }

  onFilterChange(): void {
    if (this.activeTab() === 'sessions') {
      this.loadSessionsHistory();
    }
  }

  filteredGroupsHistory = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return this.groupsHistory().filter((gh) => {
      const matchesSearch =
        !query ||
        gh.groupName.toLowerCase().includes(query) ||
        gh.defaultInstructorName.toLowerCase().includes(query) ||
        gh.courseHistory.some((c) => c.courseTitle.toLowerCase().includes(query));
      return matchesSearch;
    });
  });

  filteredSessionsHistory = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return this.sessionsHistory().filter((s) => {
      const matchesSearch =
        !query ||
        s.groupName.toLowerCase().includes(query) ||
        s.courseTitle.toLowerCase().includes(query) ||
        s.topic.toLowerCase().includes(query) ||
        s.instructorName.toLowerCase().includes(query);
      return matchesSearch;
    });
  });

  openPromoteDialog(group: GroupHistory): void {
    this.selectedGroupHistory = group;
    // Pre-calculate recommended next course
    const lastCourse = group.courseHistory[group.courseHistory.length - 1];
    if (lastCourse) {
      const nextLevelStr = (parseInt(lastCourse.level, 10) + 1).toString();
      const recommended = this.courses().find(
        (c) => c.topic.toLowerCase() === lastCourse.topic.toLowerCase() && c.level === nextLevelStr
      );
      this.selectedTargetCourseId = recommended ? recommended.id : null;
    } else {
      this.selectedTargetCourseId = null;
    }
    this.showPromoteModal = true;
  }

  confirmPromote(): void {
    if (!this.selectedGroupHistory) return;
    this.promoting = true;

    this.lmsService
      .promoteGroupNextLevel(this.selectedGroupHistory.groupId, {
        targetCourseId: this.selectedTargetCourseId || undefined,
        autoGenerateSessions: true,
      })
      .subscribe({
        next: () => {
          this.notify.showSuccess(
            `Group ${this.selectedGroupHistory?.groupName} promoted to next level!`
          );
          this.showPromoteModal = false;
          this.promoting = false;
          this.loadData();
        },
        error: (err) => {
          this.notify.showError(
            'Failed to promote group: ' + (err.error?.message || 'Error occurred')
          );
          this.promoting = false;
        },
      });
  }

  viewGroup(groupId: number): void {
    this.router.navigate(['/groups', groupId]);
  }

  getStatusBadge(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'badge-success';
      case 'cancelled':
        return 'badge-danger';
      case 'scheduled':
        return 'badge-primary';
      default:
        return 'badge-secondary';
    }
  }
}
