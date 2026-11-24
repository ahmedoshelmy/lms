import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { ConfirmService } from '../services/confirm.service';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

function leave(page: HasUnsavedChanges, ask: () => Promise<boolean>, signedIn = true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ConfirmService, useValue: { ask: vi.fn(ask) } },
      { provide: AuthService, useValue: { isLoggedIn: () => signedIn } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    unsavedChangesGuard(
      page,
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
      {} as RouterStateSnapshot
    )
  );
}

describe('unsavedChangesGuard', () => {
  it('lets a page with nothing unsaved go without asking', () => {
    const ask = vi.fn(() => Promise.resolve(false));

    expect(leave({ hasUnsavedChanges: () => false }, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('does not ask once the person has signed out, since nothing can be saved', () => {
    const ask = vi.fn(() => Promise.resolve(false));

    expect(leave({ hasUnsavedChanges: () => true }, ask, false)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('stays when the person chooses to stay', async () => {
    const result = leave({ hasUnsavedChanges: () => true }, () => Promise.resolve(false));

    await expect(result).resolves.toBe(false);
  });

  it('leaves when the person chooses to leave', async () => {
    const result = leave({ hasUnsavedChanges: () => true }, () => Promise.resolve(true));

    await expect(result).resolves.toBe(true);
  });
});
