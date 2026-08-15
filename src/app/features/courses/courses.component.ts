import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Topic } from '../../core/interfaces/Topic';
import { CourseLevel } from '../../core/interfaces/CourseLevel';
import { Role } from '../../core/interfaces/Role';

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

  topics = signal<Topic[]>([]);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  searchQuery = signal<string>('');
  collapsedTopics = signal<Set<number>>(new Set());

  // Modals
  showTopicModal = signal(false);
  showLevelModal = signal(false);
  showDeleteModal = signal(false);

  editingTopic = signal<Topic | null>(null);
  selectedTopic = signal<Topic | null>(null);
  editingLevel = signal<CourseLevel | null>(null);
  deletingTarget = signal<{ type: 'topic' | 'level'; id: number; topicId?: number; name: string } | null>(null);

  // Topic Form
  topicCode = signal('');
  topicName = signal('');
  topicDescription = signal('');

  // Level Form
  levelNumber = signal<number>(1);
  levelTitle = signal('');
  levelDescription = signal('');
  levelSessionCount = signal<number>(12);

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  readonly filteredTopics = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.topics();
    if (!q) return list;

    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.levels?.some(
          (l) =>
            l.title.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q) ||
            `level ${l.level}`.includes(q)
        )
    );
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadTopics();
    }
  }

  loadTopics(): void {
    this.loading.set(true);
    this.lmsService.getTopics().subscribe({
      next: (data) => {
        this.topics.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.showError(`Failed to load topics: ${err.message || 'Server error'}`);
        this.loading.set(false);
      },
    });
  }

  openCreateTopicModal(): void {
    this.editingTopic.set(null);
    this.topicCode.set('');
    this.topicName.set('');
    this.topicDescription.set('');
    this.showTopicModal.set(true);
  }

  openEditTopicModal(topic: Topic): void {
    this.editingTopic.set(topic);
    this.topicCode.set(topic.code);
    this.topicName.set(topic.name);
    this.topicDescription.set(topic.description || '');
    this.showTopicModal.set(true);
  }

  openCreateLevelModal(topic: Topic): void {
    this.selectedTopic.set(topic);
    this.editingLevel.set(null);
    const nextLvl = topic.levels && topic.levels.length > 0 ? Math.max(...topic.levels.map(l => l.level)) + 1 : 1;
    this.levelNumber.set(nextLvl);
    this.levelTitle.set(`${topic.name} Level ${nextLvl}`);
    this.levelDescription.set(`${topic.name} course level ${nextLvl}`);
    this.levelSessionCount.set(12);
    this.showLevelModal.set(true);
  }

  openEditLevelModal(topic: Topic, level: CourseLevel): void {
    this.selectedTopic.set(topic);
    this.editingLevel.set(level);
    this.levelNumber.set(level.level);
    this.levelTitle.set(level.title);
    this.levelDescription.set(level.description);
    this.levelSessionCount.set(level.sessionCount);
    this.showLevelModal.set(true);
  }

  openDeleteModal(target: { type: 'topic' | 'level'; id: number; topicId?: number; name: string }): void {
    this.deletingTarget.set(target);
    this.showDeleteModal.set(true);
  }

  saveTopic(): void {
    const code = this.topicCode().trim();
    const name = this.topicName().trim();
    const description = this.topicDescription().trim();

    if (!code || !name) {
      this.notify.showWarn('Topic code and name are required.');
      return;
    }

    this.saving.set(true);
    const payload = { code, name, description };

    if (this.editingTopic()) {
      this.lmsService.updateTopic(this.editingTopic()!.id, payload).subscribe({
        next: () => {
          this.notify.showSuccess('Topic updated successfully.');
          this.saving.set(false);
          this.showTopicModal.set(false);
          this.loadTopics();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.lmsService.createTopic(payload).subscribe({
        next: () => {
          this.notify.showSuccess('Topic created successfully.');
          this.saving.set(false);
          this.showTopicModal.set(false);
          this.loadTopics();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  saveLevel(): void {
    const topic = this.selectedTopic();
    if (!topic) return;

    const level = Number(this.levelNumber());
    const sessionCount = Number(this.levelSessionCount());
    const title = this.levelTitle().trim();
    const description = this.levelDescription().trim();

    if (!title || !level || !sessionCount) {
      this.notify.showWarn('Please fill in all required level fields.');
      return;
    }

    this.saving.set(true);
    const payload = { level, sessionCount, title, description };

    if (this.editingLevel()) {
      this.lmsService.updateCourseLevel(topic.id, this.editingLevel()!.id, payload).subscribe({
        next: () => {
          this.notify.showSuccess('Level updated successfully.');
          this.saving.set(false);
          this.showLevelModal.set(false);
          this.loadTopics();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.lmsService.createCourseLevel(topic.id, payload).subscribe({
        next: () => {
          this.notify.showSuccess('Course level created successfully.');
          this.saving.set(false);
          this.showLevelModal.set(false);
          this.loadTopics();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  confirmDelete(): void {
    const target = this.deletingTarget();
    if (!target) return;

    this.saving.set(true);

    if (target.type === 'topic') {
      this.lmsService.deleteTopic(target.id).subscribe({
        next: () => {
          this.notify.showSuccess(`Topic "${target.name}" deleted.`);
          this.saving.set(false);
          this.showDeleteModal.set(false);
          this.deletingTarget.set(null);
          this.loadTopics();
        },
        error: () => this.saving.set(false),
      });
    } else if (target.type === 'level' && target.topicId) {
      this.lmsService.deleteCourseLevel(target.topicId, target.id).subscribe({
        next: () => {
          this.notify.showSuccess(`Course level deleted.`);
          this.saving.set(false);
          this.showDeleteModal.set(false);
          this.deletingTarget.set(null);
          this.loadTopics();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  toggleTopicCollapse(topicId: number): void {
    this.collapsedTopics.update((set) => {
      const next = new Set(set);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }

  expandAll(): void {
    this.collapsedTopics.set(new Set());
  }

  collapseAll(): void {
    const allIds = this.topics().map((t) => t.id);
    this.collapsedTopics.set(new Set(allIds));
  }

  isCollapsed(topicId: number): boolean {
    return this.collapsedTopics().has(topicId);
  }

  getTopicBadgeClass(code: string): string {
    const c = (code || '').toUpperCase();
    if (c === 'PY') return 'topic-py-badge';
    if (c === 'AR') return 'topic-ma-badge';
    if (c === 'WEB') return 'topic-wd-badge';
    if (c === 'AI') return 'topic-ai-badge';
    return 'topic-default-badge';
  }
}
