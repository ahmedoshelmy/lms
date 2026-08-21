import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LmsService } from '../../core/services/lms.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/interfaces/Role';
import { SessionCatalogueEntry } from '../../core/interfaces/SessionSyllabus';

/**
 * Every session of every course, with what it covers and what a family is told.
 *
 * Built for the Student role that is coming: the API withholds unpublished
 * parent copy from anyone who is not staff, so this same page is safe to show a
 * student without a second set of rules in the UI.
 */
@Component({
  selector: 'app-session-summaries',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule],
  templateUrl: './session-summaries.component.html',
  styleUrl: './session-summaries.component.scss',
})
export class SessionSummariesComponent implements OnInit {
  private readonly lms = inject(LmsService);
  private readonly auth = inject(AuthService);

  readonly isStaff = computed(
    () => this.auth.hasRole(Role.Admin) || this.auth.hasRole(Role.Instructor)
  );

  readonly entries = signal<SessionCatalogueEntry[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loadedOnce = signal<boolean>(false);

  readonly search = signal<string>('');
  readonly topicFilter = signal<string>('');
  /** Narrows to sessions that have parent copy, for spotting what still needs writing. */
  readonly onlyWithSummary = signal<boolean>(false);

  /** Session rows opened for detail. */
  readonly expanded = signal<ReadonlySet<number>>(new Set<number>());
  /** Course levels opened to reveal their sessions. All shut on arrival. */
  readonly openLevels = signal<ReadonlySet<string>>(new Set<string>());

  readonly topics = computed(() => [...new Set(this.entries().map((e) => e.topicName))].sort());

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const topic = this.topicFilter();
    const onlySummary = this.onlyWithSummary();

    return this.entries().filter((e) => {
      if (topic && e.topicName !== topic) return false;
      if (onlySummary && !e.parentSummary) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.courseTitle.toLowerCase().includes(q) ||
        (e.content ?? '').toLowerCase().includes(q) ||
        (e.parentSummary ?? '').toLowerCase().includes(q) ||
        e.keyConcepts.some((c) => c.toLowerCase().includes(q))
      );
    });
  });

  /**
   * Grouped topic → level → sessions, mirroring how the curriculum is actually
   * organised, so the topic name is stated once rather than on every row.
   */
  readonly grouped = computed(() => {
    const byLevel = new Map<string, SessionCatalogueEntry[]>();
    for (const e of this.filtered()) {
      const key = `${e.topicName}|${e.level}|${e.courseTitle}|${e.courseLevelId}`;
      const list = byLevel.get(key);
      if (list) {
        list.push(e);
      } else {
        byLevel.set(key, [e]);
      }
    }

    const levels = [...byLevel.entries()].map(([key, sessions]) => {
      const [topicName, level, courseTitle, courseLevelId] = key.split('|');
      const withSummary = sessions.filter((s) => !!s.parentSummary).length;
      return {
        key,
        topicName,
        level: Number(level),
        courseTitle,
        courseLevelId: Number(courseLevelId),
        sessions: sessions.sort((a, b) => a.sessionNumber - b.sessionNumber),
        withSummary,
        coverage: sessions.length ? Math.round((withSummary / sessions.length) * 100) : 0,
      };
    });

    const byTopic = new Map<string, typeof levels>();
    for (const lv of levels) {
      const list = byTopic.get(lv.topicName);
      if (list) {
        list.push(lv);
      } else {
        byTopic.set(lv.topicName, [lv]);
      }
    }

    return [...byTopic.entries()].map(([topicName, topicLevels]) => {
      const sessions = topicLevels.reduce((n, l) => n + l.sessions.length, 0);
      const covered = topicLevels.reduce((n, l) => n + l.withSummary, 0);
      return {
        topicName,
        levels: topicLevels.sort((a, b) => a.level - b.level),
        sessionCount: sessions,
        withSummary: covered,
        coverage: sessions ? Math.round((covered / sessions) * 100) : 0,
      };
    });
  });

  /** Headline numbers for the strip above the list. */
  readonly stats = computed(() => {
    const all = this.entries();
    const levels = new Set(all.map((e) => e.courseLevelId));
    const topics = new Set(all.map((e) => e.topicName));
    const covered = all.filter((e) => !!e.parentSummary).length;
    return {
      topics: topics.size,
      levels: levels.size,
      sessions: all.length,
      covered,
      coverage: all.length ? Math.round((covered / all.length) * 100) : 0,
    };
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.lms.getSessionCatalogue().subscribe({
      next: (entries) => {
        this.entries.set(entries || []);
        this.loading.set(false);
        this.loadedOnce.set(true);
      },
      error: () => {
        // errorInterceptor surfaces the failure; the empty state explains itself.
        this.loading.set(false);
        this.loadedOnce.set(true);
      },
    });
  }

  isExpanded(id: number): boolean {
    return this.expanded().has(id);
  }

  toggle(id: number): void {
    const next = new Set(this.expanded());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expanded.set(next);
  }

  /**
   * A level is open when the user opened it, or when a search is running and
   * this level has matches — otherwise searching would appear to return nothing
   * because every level is shut.
   */
  isLevelOpen(key: string): boolean {
    if (this.search().trim() || this.topicFilter()) return true;
    return this.openLevels().has(key);
  }

  toggleLevel(key: string): void {
    const next = new Set(this.openLevels());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.openLevels.set(next);
  }

  /** Opens every level currently listed, for reading straight through. */
  openAll(): void {
    this.openLevels.set(new Set(this.grouped().flatMap((t) => t.levels.map((l) => l.key))));
  }

  collapseAll(): void {
    this.openLevels.set(new Set<string>());
    this.expanded.set(new Set<number>());
  }

  clearFilters(): void {
    this.search.set('');
    this.topicFilter.set('');
    this.onlyWithSummary.set(false);
  }

  /** True when nothing is open and there is something to open. */
  readonly allCollapsed = computed(
    () => this.openLevels().size === 0 && !this.search().trim() && !this.topicFilter()
  );
}
