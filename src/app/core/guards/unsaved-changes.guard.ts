import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../services/confirm.service';

/** A page that can say whether leaving it now would lose work. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before leaving a page with work on it that has not been saved.
 *
 * Put on a route whose component implements HasUnsavedChanges. Closing or
 * reloading the tab is the browser's business, so such a component also warns
 * on `beforeunload`.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges()) {
    return true;
  }

  return inject(ConfirmService).ask({
    header: 'Leave without saving?',
    message: 'Changes on this page have not been saved. If you leave now, they are lost.',
    acceptLabel: 'Leave without saving',
    rejectLabel: 'Stay on this page',
    danger: true,
  });
};
