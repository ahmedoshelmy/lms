import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
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
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class MainLayoutComponent {
  /** Started with the signed-in shell: clears up after a session ends, and hears other tabs. */
  private readonly session = inject(SessionService);
  private readonly injector = inject(Injector);

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
  private readonly sidebar = viewChild(SidebarComponent, { read: ElementRef });

  constructor() {
    const query = this.phoneQuery;
    if (query) {
      // Turning a tablet or resizing the window crosses the line: a column on
      // the wide side, a closed drawer on the narrow one.
      const onChange = (event: MediaQueryListEvent) => {
        this.isPhone.set(event.matches);
        this.isSidebarOpen.set(!event.matches);
      };
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
    if (this.isPhone()) {
      // Into the drawer, once it is no longer inert.
      afterNextRender(
        () =>
          (this.sidebar()?.nativeElement as HTMLElement | undefined)
            ?.querySelector<HTMLElement>('button, a[href]')
            ?.focus(),
        { injector: this.injector }
      );
    }
  }

  closeSidebar(): void {
    const wasDrawer = this.drawerOpen();
    this.isSidebarOpen.set(false);
    if (wasDrawer) {
      // Back to the button that opened it, once the page is reachable again.
      afterNextRender(() => this.menuButton()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }

  onEscape(): void {
    if (this.drawerOpen()) {
      this.closeSidebar();
    }
  }

  onMenuItemClicked(): void {
    if (this.isPhone()) {
      // Not closeSidebar(): the focus belongs to the page being opened, not the menu button.
      this.isSidebarOpen.set(false);
    }
  }
}
