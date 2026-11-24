import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';
import { ConfirmService } from './confirm.service';
import { LmsService } from './lms.service';
import { NotificationCenterService } from './notification-center.service';
import { OperationsService } from './operations.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  const loggedIn = signal(true);
  let auth: { isLoggedIn: typeof loggedIn; getUserId: () => number; logout: () => void };
  let lms: { logout: ReturnType<typeof vi.fn> };
  let bell: { clear: ReturnType<typeof vi.fn> };
  let operations: { clear: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loggedIn.set(true);
    auth = { isLoggedIn: loggedIn, getUserId: () => 7, logout: vi.fn(() => loggedIn.set(false)) };
    lms = { logout: vi.fn(() => of(undefined)) };
    bell = { clear: vi.fn() };
    operations = { clear: vi.fn() };
    ask = vi.fn(async () => false);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: LmsService, useValue: lms },
        { provide: NotificationCenterService, useValue: bell },
        { provide: OperationsService, useValue: operations },
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => localStorage.clear());

  function start(): SessionService {
    const session = TestBed.inject(SessionService);
    TestBed.tick();
    bell.clear.mockClear();
    operations.clear.mockClear();
    return session;
  }

  it('signs out with the server and sends them to sign in', () => {
    start().signOut();

    expect(lms.logout).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('asks before a sign-out from the menu would lose unsaved work', async () => {
    const session = start();
    let dirty = true;
    const page = { hasUnsavedChanges: () => dirty };
    session.pageOpened(page);

    // "Stay signed in"
    await session.askToSignOut();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(lms.logout).not.toHaveBeenCalled();

    // "Sign out without saving"
    ask.mockResolvedValueOnce(true);
    await session.askToSignOut();
    expect(lms.logout).toHaveBeenCalledTimes(1);

    // Nothing unsaved: no question.
    dirty = false;
    ask.mockClear();
    await session.askToSignOut();
    expect(ask).not.toHaveBeenCalled();
    expect(lms.logout).toHaveBeenCalledTimes(2);
  });

  it('does not ask about a page that has closed', async () => {
    const session = start();
    const page = { hasUnsavedChanges: () => true };
    session.pageOpened(page);
    session.pageClosed(page);

    await session.askToSignOut();

    expect(ask).not.toHaveBeenCalled();
    expect(lms.logout).toHaveBeenCalled();
  });

  it('clears the bell and outstanding work however the session ends', () => {
    start();

    // The way the interceptor ends an expired session: no call to signOut().
    loggedIn.set(false);
    TestBed.tick();

    expect(bell.clear).toHaveBeenCalled();
    expect(operations.clear).toHaveBeenCalled();
  });

  it('signs this tab out when another tab signs out', () => {
    start();

    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_STORAGE_KEY, newValue: null }));

    expect(auth.logout).toHaveBeenCalled();
    expect(lms.logout).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('starts again when another tab signs in as somebody else', () => {
    const session = start();
    const reload = vi
      .spyOn(session as unknown as { reload: () => void }, 'reload')
      .mockImplementation(() => undefined);

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 99 }));
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_STORAGE_KEY }));

    expect(reload).toHaveBeenCalled();
  });

  it('ignores other storage changes', () => {
    start();

    window.dispatchEvent(new StorageEvent('storage', { key: 'lms_theme', newValue: 'dark' }));

    expect(auth.logout).not.toHaveBeenCalled();
  });
});
