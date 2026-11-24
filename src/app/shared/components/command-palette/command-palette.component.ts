import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LmsService } from '../../../core/services/lms.service';
import { AuthService } from '../../../core/services/auth.service';
import { getMenuItemsForRole } from '../../../core/config/app-navigation.config';
import { ModalDirective } from '../../directives/modal.directive';

export interface CommandItem {
  id: string | number;
  label: string;
  category: 'Navigation' | 'Student' | 'Instructor' | 'Group' | 'Course';
  detail?: string;
  icon: string;
  route: string[];
}

@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, ModalDirective],
  template: `
    @if (isOpen()) {
      <!-- A click on the backdrop closes; from the keyboard, Escape does (appModal). -->
      <!-- eslint-disable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        (click)="$event.target === $event.currentTarget && close()"
      >
        <!-- eslint-enable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div
          appModal
          aria-label="Search"
          (appModalEscape)="close()"
          class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden relative"
        >
          <!-- Search Input Bar -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]">
            <i
              class="pi pi-search text-lg text-[var(--color-secondary)] font-bold"
              aria-hidden="true"
            ></i>
            <input
              type="text"
              aria-label="Search pages, students, groups and courses"
              [ngModel]="searchQuery()"
              (ngModelChange)="onSearchChange($event)"
              (keydown)="onKeyDown($event)"
              placeholder="Type to search students, groups, courses, or jump to page... (Esc to close)"
              class="w-full bg-transparent text-sm sm:text-base font-semibold text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none"
            />
            <span
              class="hidden sm:inline-block px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
            >
              Esc
            </span>
          </div>

          <!-- Results List -->
          <div class="max-h-[380px] overflow-y-auto p-2 space-y-1 no-scrollbar">
            @for (item of filteredItems(); track item.id + '-' + item.category; let idx = $index) {
              <button
                type="button"
                (click)="selectItem(item)"
                (mouseenter)="selectedIndex.set(idx)"
                class="w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left"
                [class.bg-[var(--color-surface-secondary)]]="selectedIndex() === idx"
                [class.text-[var(--color-secondary)]]="selectedIndex() === idx"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    [ngClass]="{
                      'bg-[var(--color-primary)]/10 text-[var(--color-primary)]':
                        item.category === 'Navigation',
                      'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]':
                        item.category === 'Student',
                      'bg-[var(--color-warning)]/10 text-[var(--color-warning-foreground)]':
                        item.category === 'Instructor',
                      'bg-[var(--color-success)]/10 text-[var(--color-success-foreground)]':
                        item.category === 'Group',
                      'bg-session-group/10 text-session-group': item.category === 'Course',
                    }"
                  >
                    <i [class]="'pi ' + item.icon + ' text-sm'"></i>
                  </div>
                  <div class="min-w-0">
                    <p
                      class="font-extrabold text-xs sm:text-sm text-[var(--color-text-primary)] truncate"
                    >
                      {{ item.label }}
                    </p>
                    @if (item.detail) {
                      <p class="text-[11px] text-[var(--color-text-muted)] truncate">
                        {{ item.detail }}
                      </p>
                    }
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border border-[var(--color-border)]"
                    [ngClass]="{
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]':
                        item.category === 'Navigation',
                      'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]':
                        item.category === 'Student',
                      'bg-[var(--color-warning-background)] text-[var(--color-warning-foreground)]':
                        item.category === 'Instructor',
                      'bg-[var(--color-success-background)] text-[var(--color-success-foreground)]':
                        item.category === 'Group',
                      'bg-session-group/10 text-session-group': item.category === 'Course',
                    }"
                  >
                    {{ item.category }}
                  </span>
                  <i class="pi pi-arrow-right text-xs opacity-50"></i>
                </div>
              </button>
            } @empty {
              <div class="text-center py-10 text-[var(--color-text-muted)]">
                <i class="pi pi-search text-2xl mb-2 block opacity-40"></i>
                <p class="text-xs font-semibold">No matching pages, students, or courses found.</p>
              </div>
            }
          </div>

          <!-- Footer Tips -->
          <div
            class="px-5 py-2.5 bg-[var(--color-surface-secondary)] border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-semibold text-[var(--color-text-muted)]"
          >
            <div class="flex items-center gap-3">
              <span><strong class="text-[var(--color-text-primary)]">↑↓</strong> Navigate</span>
              <span><strong class="text-[var(--color-text-primary)]">↵</strong> Select</span>
            </div>
            <span>Antigravity LMS Search</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `,
})
export class CommandPaletteComponent implements OnInit {
  private router = inject(Router);
  private lms = inject(LmsService);
  private auth = inject(AuthService);

  /**
   * Who may read the group list. The palette runs for everybody, so anything it
   * loads has to be something the viewer is allowed to have — a refused request
   * still reaches them as an error, whatever this component does with it.
   */
  private get canSeeGroups(): boolean {
    return this.auth.canAccess('groups');
  }

  /** The student list is loaded only for those who may open student pages. */
  private get canSeeStudents(): boolean {
    return this.auth.canAccess('students');
  }

  isOpen = signal<boolean>(false);
  searchQuery = signal<string>('');
  selectedIndex = signal<number>(0);

  allItems = signal<CommandItem[]>([]);

  /**
   * The pages this person can open, from the same table as the sidebar and the
   * routes. The palette used to keep its own list, which offered Sales and
   * students pages they would be refused and named them differently.
   */
  private navItems(): CommandItem[] {
    const items = getMenuItemsForRole(this.auth.currentRole()).map((item) => ({
      id: item.route,
      label: item.label,
      category: 'Navigation' as const,
      icon: item.icon.replace(/^pi\s+/, ''),
      route: [item.route],
    }));

    return [
      ...items,
      {
        id: '/profile',
        label: 'Profile',
        category: 'Navigation',
        icon: 'pi-id-card',
        route: ['/profile'],
      },
    ];
  }

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.allItems();
    if (!q) return list.slice(0, 10);
    return list
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.detail && item.detail.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 15);
  });

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.toggle();
    }
  }

  /**
   * The pages are known at once; students, groups and courses are fetched the
   * first time the palette opens. They used to be fetched for everybody the
   * moment they signed in -- three requests, one of them every student --
   * whether or not anyone ever pressed Ctrl+K.
   */
  private catalogRequested = false;

  ngOnInit(): void {
    this.allItems.set(this.navItems());
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (!this.catalogRequested) {
      this.catalogRequested = true;
      this.loadCatalogData();
    }
    this.searchQuery.set('');
    this.selectedIndex.set(0);
    // The search box gets the focus from appModal, as the panel opens.
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.selectedIndex.set(0);
  }

  onKeyDown(event: KeyboardEvent): void {
    const list = this.filteredItems();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.set((this.selectedIndex() + 1) % Math.max(1, list.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.set((this.selectedIndex() - 1 + list.length) % Math.max(1, list.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = list[this.selectedIndex()];
      if (selected) {
        this.selectItem(selected);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  selectItem(item: CommandItem): void {
    this.close();
    this.router.navigate(item.route);
  }

  private loadCatalogData(): void {
    const catalog: CommandItem[] = this.navItems();

    // Load Students — admin only (instructors get 403)
    if (this.canSeeStudents) {
      this.lms.getStudents().subscribe({
        next: (students) => {
          (students || []).forEach((s) => {
            catalog.push({
              id: `student-${s.id}`,
              label: s.name,
              detail: s.email,
              category: 'Student',
              icon: 'pi-user',
              route: ['/students', String(s.id)],
            });
          });
          this.allItems.set([...catalog]);
        },
      });
    } else {
      this.allItems.set([...catalog]);
    }

    // Load Groups — operations only. A group carries every student in it, so
    // sales and students are refused, and asking anyway put an error in front
    // of them on a page they had only just opened.
    if (this.canSeeGroups) {
      this.lms.getGroups().subscribe({
        next: (groups) => {
          (groups || []).forEach((g) => {
            catalog.push({
              id: `group-${g.id}`,
              label: g.name,
              detail: g.status ? `Status: ${g.status}` : 'Cohort Group',
              category: 'Group',
              icon: 'pi-users',
              route: ['/groups', g.id.toString()],
            });
          });
          this.allItems.set([...catalog]);
        },
      });
    }

    // Load Courses
    this.lms.getCourses().subscribe({
      next: (courses) => {
        (courses || []).forEach((c) => {
          catalog.push({
            id: `course-${c.id}`,
            label: c.title,
            detail: c.topic ? `${c.level} • ${c.topic}` : 'Course Catalog',
            category: 'Course',
            icon: 'pi-book',
            route: ['/courses'],
          });
        });
        this.allItems.set([...catalog]);
      },
    });
  }
}
