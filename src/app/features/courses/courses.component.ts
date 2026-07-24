import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Course } from '../../core/interfaces/Course';

interface TopicGroup {
  topic: string;
  courses: Course[];
  expanded: boolean;
}

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);

  courses = signal<Course[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  groupByTopic = signal(false);
  collapsedTopics = signal<Set<string>>(new Set());

  filteredCourses = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.courses();
    return this.courses().filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.topic.toLowerCase().includes(query) ||
        c.level.toLowerCase().includes(query) ||
        c.groupCount.toString().includes(query) ||
        c.studentCount.toString().includes(query) ||
        c.sessionCount.toString().includes(query) ||
        c.description.toLowerCase().includes(query)
    );
  });

  topicGroups = computed<TopicGroup[]>(() => {
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
    this.loadCourses();
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
