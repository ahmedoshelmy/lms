import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs';
import { User } from '../models/User';
import { Role } from '../interfaces/Role';
import { LmsService, LoginRequest } from '../services/lms.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly lmsService = inject(LmsService);
  private readonly USER_KEY = 'auth_user';

  private currentUserSignal = signal<User | null>(this.getStoredUser());
  readonly currentUser$ = this.currentUserSignal.asReadonly();
  readonly currentUser = this.currentUserSignal;
  readonly isLoggedIn = computed(() => this.currentUserSignal() !== null);
  readonly currentRole = computed<Role | null>(() => this.currentUserSignal()?.role ?? null);

  getUserId(): string | null {
    return this.currentUserSignal()?.id ?? null;
  }

  hasRole(role: Role): boolean {
    return this.currentUserSignal()?.role === role;
  }

  hasAnyRole(roles: Role[]): boolean {
    const user = this.currentUserSignal();
    return !!user && roles.includes(user.role);
  }

  login(payload: LoginRequest): ReturnType<LmsService['login']> {
    return this.lmsService.login(payload).pipe(tap((user) => this.setStoredUser(user)));
  }

  logout(): void {
    this.removeStoredUser();
    this.currentUserSignal.set(null);
  }

  updateProfile(partialUser: Partial<User>): void {
    const current = this.currentUserSignal();
    if (current) {
      const updated = { ...current, ...partialUser };
      this.setStoredUser(updated);
    }
  }

  private getStoredUser(): User | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const userString = localStorage.getItem(this.USER_KEY);
      return userString ? (JSON.parse(userString) as User) : null;
    } catch {
      return null;
    }
  }

  private setStoredUser(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    this.currentUserSignal.set(user);
  }

  private removeStoredUser(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.USER_KEY);
    }
  }
}
