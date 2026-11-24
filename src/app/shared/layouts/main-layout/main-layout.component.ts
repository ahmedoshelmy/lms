import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ToastModule } from 'primeng/toast';
import { SessionService } from '../../../core/services/session.service';
import { ConfirmHostComponent } from '../../components/confirm-host/confirm-host.component';
import { CommandPaletteComponent } from '../../components/command-palette/command-palette.component';
import { OutstandingWorkComponent } from '../../components/outstanding-work/outstanding-work.component';

/** Below this width the sidebar is a drawer over the page rather than a column beside it. */
export const PHONE_QUERY = '(max-width: 768px)';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    ToastModule,
    ConfirmHostComponent,
    CommandPaletteComponent,
    OutstandingWorkComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  // On window, which a key event reaches after document: a panel inside the
  // drawer (the notifications) closes first and claims the key.
  host: { '(window:keydown.escape)': 'onEscape($event)' },
})
export class MainLayoutComponent {
  /** Started with the signed-in shell: clears up after a session ends, and hears other tabs. */
  private readonly session = inject(SessionService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  private readonly phoneQuery = isPlatformBrowser(inject(PLATFORM_ID))
    ? window.matchMedia(PHONE_QUERY)
    : null;

  /** Whether the sidebar is a drawer (phones) rather than a column. */
  readonly isPhone = signal(this.phoneQuery?.matches ?? false);

  /**
   * Known before the first render. It used to start open and close after it,
   * so every page load on a phone flashed the menu across the screen.
   */
  readonly isSidebarOpen = signal(!this.isPhone());

  /** The drawer is over the page: the page behind it is out of reach until it closes. */
  readonly drawerOpen = computed(() => this.isPhone() && this.isSidebarOpen());

  /** A closed drawer is off screen, and its links must not be reachable by Tab either. */
  readonly drawerHidden = computed(() => this.isPhone() && !this.isSidebarOpen());

  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');
  private readonly sidebar = viewChild(SidebarComponent, { read: ElementRef });

  constructor() {
    const query = this.phoneQuery;
    if (query) {
      // Turning a tablet or resizing the window crosses the line: a column on
      // the wide side, a closed drawer on the narrow one.
      const onChange = (event: MediaQueryListEvent) => {
        const focusWasInMenu = this.focusIsInSidebar();
        this.isPhone.set(event.matches);
        this.isSidebarOpen.set(!event.matches);
        // The menu just went inert under the focus: hand it to the menu button.
        if (event.matches && focusWasInMenu) this.focusAfterRender(() => this.menuButton());
      };
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => {
        query.removeEventListener('change', onChange);
        // Signing out from the open drawer must not leave the next page unscrollable.
        this.document.documentElement.classList.remove('drawer-open');
      });

      // While the drawer is open the page behind it does not scroll either.
      effect(() =>
        this.document.documentElement.classList.toggle('drawer-open', this.drawerOpen())
      );
    }

    // Anything that navigates from the drawer -- a notification, the profile
    // link -- closes it, and the new page gets the focus.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        if (this.drawerOpen()) this.closeDrawerToPage();
      });
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
    if (this.isPhone()) {
      // Into the drawer, once it is no longer inert.
      this.focusAfterRender(() => {
        const sidebar = this.sidebar()?.nativeElement as HTMLElement | undefined;
        const first = sidebar?.querySelector<HTMLElement>('button, a[href]');
        return first ? { nativeElement: first } : undefined;
      });
    }
  }

  closeSidebar(): void {
    const wasDrawer = this.drawerOpen();
    this.isSidebarOpen.set(false);
    if (wasDrawer) {
      // Back to the button that opened it, once the page is reachable again.
      this.focusAfterRender(() => this.menuButton());
    }
  }

  onEscape(event: Event): void {
    if (!this.drawerOpen() || event.defaultPrevented) return;
    // A dialog or the command palette over the drawer has the focus, and the
    // key is theirs.
    const active = this.document.activeElement;
    if (active && active !== this.document.body && !this.focusIsInSidebar()) return;
    this.closeSidebar();
  }

  onMenuItemClicked(): void {
    if (this.drawerOpen()) {
      // The focus belongs to the page being opened, not the menu button. Also
      // when the item is the page already open, and nothing navigates.
      this.closeDrawerToPage();
    }
  }

  /** Closes the drawer and puts the focus at the top of the page. */
  private closeDrawerToPage(): void {
    this.isSidebarOpen.set(false);
    // The link that had it is now inert; left alone, the focus drops to <body>.
    this.focusAfterRender(() => this.mainContent());
  }

  private focusIsInSidebar(): boolean {
    const sidebar = this.sidebar()?.nativeElement as HTMLElement | undefined;
    return !!sidebar && sidebar.contains(this.document.activeElement);
  }

  private focusAfterRender(target: () => { nativeElement: HTMLElement } | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }
}
