import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ModalDirective } from './modal.directive';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDirective],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Open</button>
    @if (open()) {
      <div appModal [appModalFocus]="focus()" (appModalEscape)="escapes.set(escapes() + 1)">
        <h2>Title</h2>
        <button type="button" id="first">First</button>
        <button type="button" disabled>Disabled</button>
        <input id="last" />
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly focus = signal<'first' | 'panel'>('first');
  readonly escapes = signal(0);
}

function press(key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

async function render(focus: 'first' | 'panel' = 'first') {
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.componentInstance.focus.set(focus);
  await fixture.whenStable();

  const el = fixture.nativeElement as HTMLElement;
  const opener = el.querySelector<HTMLButtonElement>('#opener')!;
  opener.focus();
  fixture.componentInstance.open.set(true);
  await fixture.whenStable();

  return {
    fixture,
    host: fixture.componentInstance,
    opener,
    panel: () => el.querySelector<HTMLElement>('[appModal]'),
    byId: (id: string) => el.querySelector<HTMLElement>('#' + id)!,
  };
}

describe('ModalDirective', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('is announced as a modal dialog', async () => {
    const { panel } = await render();

    expect(panel()!.getAttribute('role')).toBe('dialog');
    expect(panel()!.getAttribute('aria-modal')).toBe('true');
  });

  it('takes the focus to its first control, or to itself when asked', async () => {
    const first = await render();
    expect(document.activeElement).toBe(first.byId('first'));

    document.body.innerHTML = '';
    const panel = await render('panel');
    expect(document.activeElement).toBe(panel.panel());
  });

  it('keeps Tab inside, both ways round, past a disabled button', async () => {
    const { byId } = await render();

    byId('last').focus();
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('first'));

    expect(press('Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('last'));

    // In the middle, Tab is the browser's to move.
    byId('first').focus();
    expect(press('Tab').defaultPrevented).toBe(false);
  });

  it('reports Escape, unless something inside claimed it', async () => {
    const { host, byId } = await render();

    press('Escape');
    expect(host.escapes()).toBe(1);

    const claim = (e: Event) => e.preventDefault();
    byId('last').addEventListener('keydown', claim);
    byId('last').focus();
    press('Escape');
    expect(host.escapes()).toBe(1);
  });

  it('gives the focus back to what had it, on closing', async () => {
    const { host, fixture, opener } = await render();

    host.open.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(opener);
  });
});
