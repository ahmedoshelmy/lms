import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Course } from '../../core/interfaces/Course';
import { Role } from '../../core/interfaces/Role';

interface TopicGroup {
  topic: string;
  courses: Course[];
  expanded: boolean;
}

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, DialogModule, ButtonModule],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  courses = signal<Course[]>([]);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  searchQuery = signal<string>('');
  groupByTopic = signal(false);
  collapsedTopics = signal<Set<string>>(new Set());

  showCourseModal = signal(false);
  showDeleteModal = signal(false);
  editingCourse = signal<Course | null>(null);
  deletingCourse = signal<Course | null>(null);

  formTitle = signal('');
  formDescription = signal('');
  formTopic = signal('');
  formLevel = signal('');
  formSessionCount = signal('');

  readonly isAdmin = computed(() => this.auth.currentRole() === Role.Admin);

  readonly filteredCourses = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.courses();
    return this.courses().filter(
      (c) =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.topic || '').toLowerCase().includes(q) ||
        (c.level || '').toLowerCase().includes(q)
    );
  });

  readonly topicGroups = computed<TopicGroup[]>(() => {
    const courses = this.filteredCourses();
    const collapsed = this.collapsedTopics();
    const map = new Map<string, Course[]>();

    for (const course of courses) {
      const topic = course.topic || 'Other';
      if (!map.has(topic)) map.set(topic, []);
      map.get(topic)!.push(course);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([topic, topicCourses]) => ({
        topic,
        courses: topicCourses,
        expanded: !collapsed.has(topic),
      }));
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadCourses();
    }
  }

  loadCourses(): void {
    this.loading.set(true);
    this.lmsService.getCourses().subscribe({
      next: (data) => {
        this.courses.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.showError(`Failed to load courses: ${err.message || 'Server error'}`);
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingCourse.set(null);
    this.formTitle.set('');
    this.formDescription.set('');
    this.formTopic.set('');
    this.formLevel.set('');
    this.formSessionCount.set('');
    this.showCourseModal.set(true);
  }

  openEditModal(course: Course): void {
    this.editingCourse.set(course);
    this.formTitle.set(course.title);
    this.formDescription.set(course.description);
    this.formTopic.set(course.topic);
    this.formLevel.set(course.level);
    this.formSessionCount.set(course.sessionCount);
    this.showCourseModal.set(true);
  }

  openDeleteModal(course: Course): void {
    this.deletingCourse.set(course);
    this.showDeleteModal.set(true);
  }

  saveCourse(): void {
    const title = this.formTitle().trim();
    const description = this.formDescription().trim();
    const topic = this.formTopic().trim();
    const level = this.formLevel().trim();
    const sessionCount = this.formSessionCount().trim();

    if (!title || !description || !topic || !level || !sessionCount) {
      this.notify.showWarn('Please fill in all required fields.');
      return;
    }

    this.saving.set(true);
    const payload = { title, description, topic, level, sessionCount };

    if (this.editingCourse()) {
      this.lmsService.updateCourse(this.editingCourse()!.id, payload).subscribe({
        next: () => {
          this.notify.showSuccess('Course updated successfully.');
          this.saving.set(false);
          this.showCourseModal.set(false);
          this.loadCourses();
        },
        error: () => {
          this.saving.set(false);
        },
      });
    } else {
      this.lmsService.createCourse(payload).subscribe({
        next: () => {
          this.notify.showSuccess('Course created successfully.');
          this.saving.set(false);
          this.showCourseModal.set(false);
          this.loadCourses();
        },
        error: () => {
          this.saving.set(false);
        },
      });
    }
  }

  confirmDelete(): void {
    const course = this.deletingCourse();
    if (!course) return;

    this.saving.set(true);
    this.lmsService.deleteCourse(course.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Course "${course.title}" deleted.`);
        this.saving.set(false);
        this.showDeleteModal.set(false);
        this.deletingCourse.set(null);
        this.loadCourses();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  toggleGroupByTopic(): void {
    this.groupByTopic.update((v) => !v);
  }

  toggleTopicCollapse(topic: string): void {
    this.collapsedTopics.update((set) => {
      const next = new Set(set);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  }

  collapseAllTopics(): void {
    const topics = this.topicGroups().map((g) => g.topic);
    this.collapsedTopics.set(new Set(topics));
  }

  expandAllTopics(): void {
    this.collapsedTopics.set(new Set());
  }

  getTopicBadgeClass(topic: string): string {
    const t = (topic || '').toLowerCase();
    if (t.includes('python') || t === 'py') return 'topic-py-badge';
    if (t.includes('math') || t.includes('statistics') || t.includes('algebra'))
      return 'topic-ma-badge';
    if (t.includes('web') || t.includes('html') || t.includes('css') || t.includes('frontend'))
      return 'topic-wd-badge';
    if (
      t.includes('ai') ||
      t.includes('machine learning') ||
      t.includes('deep learning') ||
      t.includes('neural')
    )
      return 'topic-ai-badge';
    return 'topic-default-badge';
  }
}
