import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Course } from '../../core/interfaces/Course';

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
