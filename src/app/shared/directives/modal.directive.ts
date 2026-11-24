import {
  Directive,
  DOCUMENT,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

/** What Tab can reach. Disabled, hidden or inert ones are filtered out after. */
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Makes a hand-built panel behave as a modal dialog, as PrimeNG's own do:
 *
 * - announced as a dialog (`role="dialog"`, `aria-modal`), named by its heading;
 * - the focus moves into it when it opens -- to the first control, or to the
 *   panel itself with `appModalFocus="panel"` when there is reading to do first;
 * - Tab and Shift+Tab go round inside it rather than out to the page behind;
 * - Escape emits `appModalEscape`, for a modal that can be dismissed (one that
 *   must not be, simply does not listen);
 * - the focus goes back to whatever had it before, when it closes.
 *
 * Put it on the panel, inside the `@if` that shows it: opening is the panel
 * being created, closing is it being destroyed.
 */
@Directive({
  selector: '[appModal]',
  standalone: true,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1',
    // The panel takes the focus only to hold it; a ring round all of it says nothing.
    '[style.outline]': "'none'",
    '(keydown)': 'onKeydown($event)',
  },
})
export class ModalDirective implements OnDestroy {
  /** Where the focus goes on opening. */
  readonly appModalFocus = input<'first' | 'panel'>('first');

  /** Escape was pressed inside the modal, and nothing in it claimed the key. */
  readonly appModalEscape = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);

  /** Had the focus before this opened, and gets it back after. */
  private readonly returnTo = this.document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => {
      // Something inside already took it (an autofocus field): leave it there.
      if (this.host.contains(this.document.activeElement)) return;
      const target = this.appModalFocus() === 'panel' ? null : this.tabbables()[0];
      (target ?? this.host).focus();
    });
  }

  ngOnDestroy(): void {
    const active = this.document.activeElement;
    // Only if the focus was still ours, or lost with the panel. Something that
    // has since taken it on purpose keeps it.
    const ours = !active || active === this.document.body || this.host.contains(active);
    if (ours && this.returnTo?.isConnected && this.returnTo !== this.document.body) {
      this.returnTo.focus({ preventScroll: true });
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.appModalEscape.emit();
      return;
    }

    if (event.key !== 'Tab') return;
    const items = this.tabbables();
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || active === this.host)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private tabbables(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>(TABBABLE)).filter(
      (el) =>
        !el.closest('[inert]') &&
        // Not drawn (display: none, or inside something that is). Where the
        // browser cannot tell, take it as drawn.
        (el.checkVisibility?.() ?? true)
    );
  }
}
