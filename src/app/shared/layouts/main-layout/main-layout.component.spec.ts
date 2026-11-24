import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterModule, RouterOutlet } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../../../core/interfaces/Role';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { MainLayoutComponent } from './main-layout.component';

// The shell's other parts (toasts, dialogs, the palette, the outstanding-work
// window) have nothing to do with the drawer.
// eslint-disable-next-line @angular-eslint/component-selector -- stands in for PrimeNG's
@Component({ selector: 'p-toast', template: '' })
class ToastStub {}
@Component({ selector: 'app-confirm-host', template: '' })
class ConfirmHostStub {}
@Component({ selector: 'app-command-palette', template: '' })
class PaletteStub {}
@Component({ selector: 'app-outstanding-work', template: '' })
class OutstandingWorkStub {}
@Component({ selector: 'app-notification-bell', template: '' })
class BellStub {
  readonly compact = input(false);
}
@Component({ template: '<a href="/elsewhere">Open</a>' })
class PageStub {}

/** As a real key press: from the focused element up through document to window. */
function pressEscape(claim = false) {
  const claimer = (e: Event) => e.preventDefault();
  if (claim) document.addEventListener('keydown', claimer);
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  );
  document.removeEventListener('keydown', claimer);
}

const sessionStub = {
  signOut: vi.fn(),
  pageOpened: vi.fn(),
  pageClosed: vi.fn(),
};

function render(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'groups', title: 'Groups', component: PageStub },
        { path: 'groups/:id', title: 'Group', component: PageStub },
      ]),
      {
        provide: AuthService,
        useValue: { currentUser: signal({ id: 1, name: 'Mona Adel', role: Role.Instructor }) },
      },
      { provide: SessionService, useValue: sessionStub },
    ],
  });
  TestBed.overrideComponent(MainLayoutComponent, {
    set: {
      imports: [
        RouterOutlet,
        SidebarComponent,
        ToastStub,
        ConfirmHostStub,
        PaletteStub,
        OutstandingWorkStub,
      ],
    },
  });
  TestBed.overrideComponent(SidebarComponent, { set: { imports: [RouterModule, BellStub] } });

  const fixture = TestBed.createComponent(MainLayoutComponent);
  const el = fixture.nativeElement as HTMLElement;
  // In the document, so focus can move.
  document.body.appendChild(el);
  fixture.detectChanges();
  return {
    fixture,
    page: fixture.componentInstance,
    sidebar: () => el.querySelector('app-sidebar')!,
    content: () => el.querySelector('.content-wrapper')!,
    backdrop: () => el.querySelector('.sidebar-backdrop'),
    main: () => el.querySelector('main')!,
    announced: () => el.querySelector('[aria-live]')!.textContent!.trim(),
  };
}

describe('MainLayoutComponent on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts with the drawer closed, rather than opening and then closing it', () => {
    const { page, sidebar } = render(true);

    // Decided before the first render: no flash of the menu across the page.
    expect(page.isSidebarOpen()).toBe(false);
    // Off screen, and out of the Tab order too.
    expect(sidebar().hasAttribute('inert')).toBe(true);
  });

  it('puts the page behind an open drawer out of reach, and Escape closes it', async () => {
    const { fixture, page, sidebar, content, backdrop } = render(true);

    page.openSidebar();
    fixture.detectChanges();
    expect(sidebar().hasAttribute('inert')).toBe(false);
    expect(content().hasAttribute('inert')).toBe(true);
    expect(backdrop()).not.toBeNull();

    pressEscape();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.isSidebarOpen()).toBe(false);
    expect(content().hasAttribute('inert')).toBe(false);
    expect(backdrop()).toBeNull();
    // Focus goes back to the button that opened the drawer.
    expect(document.activeElement?.classList.contains('mobile-menu-btn')).toBe(true);
  });

  it('leaves Escape alone when a panel inside the drawer claimed it', () => {
    const { fixture, page } = render(true);
    page.openSidebar();
    fixture.detectChanges();

    // The notifications panel closes itself and calls preventDefault().
    pressEscape(true);
    fixture.detectChanges();

    expect(page.isSidebarOpen()).toBe(true);
  });

  it('closes on choosing a page, and gives the page the focus', async () => {
    const { fixture, page } = render(true);
    page.openSidebar();
    fixture.detectChanges();

    page.onMenuItemClicked();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.isSidebarOpen()).toBe(false);
    // Not dropped to <body> with the link that went inert.
    expect(document.activeElement?.tagName).toBe('MAIN');
  });

  it('stops the page scrolling behind the open drawer, and never leaves it stopped', () => {
    const { fixture, page } = render(true);
    const html = document.documentElement;

    page.openSidebar();
    fixture.detectChanges();
    expect(html.classList.contains('drawer-open')).toBe(true);

    // Signing out from the open drawer destroys the layout.
    fixture.destroy();
    expect(html.classList.contains('drawer-open')).toBe(false);
  });
});

describe('MainLayoutComponent on a wide screen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the sidebar as a column, with nothing made inert', () => {
    const { page, sidebar, content, backdrop } = render(false);

    expect(page.isSidebarOpen()).toBe(true);
    expect(sidebar().hasAttribute('inert')).toBe(false);
    expect(content().hasAttribute('inert')).toBe(false);
    expect(backdrop()).toBeNull();
  });

  it('ignores Escape', () => {
    const { fixture, page } = render(false);

    pressEscape();
    fixture.detectChanges();

    expect(page.isSidebarOpen()).toBe(true);
  });
});

describe('MainLayoutComponent between pages', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function go(fixture: { whenStable(): Promise<unknown> }, url: string) {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  }

  it('says which page opened, but not for the first page or a change of filter', async () => {
    const { fixture, announced } = render(false);

    await go(fixture, '/groups');
    // The first page is read out by the browser itself.
    expect(announced()).toBe('');

    await go(fixture, '/groups/7');
    expect(announced()).toBe('Group');

    await go(fixture, '/groups');
    expect(announced()).toBe('Groups');

    // The same page with a filter in the query string.
    await go(fixture, '/groups?status=active');
    expect(announced()).toBe('Groups');
  });

  it('gives the new page the focus when the link that had it went with the old one', async () => {
    const { fixture, main } = render(false);
    await go(fixture, '/groups');

    // A link inside the page, removed with it.
    main().querySelector<HTMLAnchorElement>('a')!.focus();
    await go(fixture, '/groups/7');

    expect(document.activeElement).toBe(main());
  });

  it('leaves the focus on a sidebar link that is still there', async () => {
    const { fixture, sidebar } = render(false);
    await go(fixture, '/groups');

    const link = sidebar().querySelector<HTMLAnchorElement>('a.menu-item')!;
    link.focus();
    await go(fixture, '/groups/7');

    expect(document.activeElement).toBe(link);
  });

  it('tells the session which page is open, so a sign-out can ask about its work', async () => {
    const { fixture } = render(false);
    sessionStub.pageOpened.mockClear();
    sessionStub.pageClosed.mockClear();

    await go(fixture, '/groups');
    const first = sessionStub.pageOpened.mock.calls[0][0];
    expect(first).toBeInstanceOf(PageStub);

    await go(fixture, '/groups/7');
    expect(sessionStub.pageClosed).toHaveBeenCalledWith(first);
  });

  it('skips past the navigation to the page', () => {
    const { fixture, main } = render(false);
    const skip = fixture.nativeElement.querySelector('.skip-link') as HTMLAnchorElement;

    // The first thing Tab reaches.
    expect(fixture.nativeElement.querySelector('a, button')).toBe(skip);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    skip.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main());
  });
});
