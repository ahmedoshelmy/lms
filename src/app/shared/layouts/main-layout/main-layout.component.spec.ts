import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterModule, RouterOutlet } from '@angular/router';
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
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { currentUser: signal({ id: 1, name: 'Mona Adel', role: Role.Instructor }) },
      },
      { provide: SessionService, useValue: { signOut: () => undefined } },
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

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.isSidebarOpen()).toBe(false);
    expect(content().hasAttribute('inert')).toBe(false);
    expect(backdrop()).toBeNull();
    // Focus goes back to the button that opened the drawer.
    expect(document.activeElement?.classList.contains('mobile-menu-btn')).toBe(true);
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

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(page.isSidebarOpen()).toBe(true);
  });
});
