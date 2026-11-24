import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs';
import { Role, parseRole } from '../interfaces/Role';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { resolveApiUrl } from '../config/api-url';
import { LoginRequest, LoginResponse } from '../interfaces/Login';
import { User } from '../interfaces/User';
import { canAccessPath } from '../config/app-navigation.config';

/** Where the signed-in user is kept between visits. Other tabs watch it. */
export const AUTH_STORAGE_KEY = 'auth_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  /**
   * Plain HttpClient rather than LmsService: this service is needed before any
   * page loads (the route guards use it), and depending on the whole API
   * client for one request put all of it in the first download.
   */
  private readonly http = inject(HttpClient);
  private readonly USER_KEY = AUTH_STORAGE_KEY;

  private currentUserSignal = signal<User | null>(this.getStoredUser());
  readonly currentUser$ = this.currentUserSignal.asReadonly();
  readonly currentUser = this.currentUserSignal;
  readonly isLoggedIn = computed(() => this.currentUserSignal() !== null);
  readonly currentRole = computed<Role | null>(() => {
    const user = this.currentUserSignal();
    return user ? parseRole(user.role) : null;
  });

  getUserId(): number | null {
    return this.currentUserSignal()?.id ?? null;
  }

  getAccessToken(): string | null {
    return this.currentUserSignal()?.accessToken ?? null;
  }

  setAccessToken(token: string): void {
    const current = this.currentUserSignal();
    if (current) {
      const updated = { ...current, accessToken: token };
      this.setStoredUser(updated);
    }
  }

  hasRole(role: Role): boolean {
    const userRole = this.currentRole();
    return userRole !== null && parseRole(userRole) === parseRole(role);
  }

  hasAnyRole(roles: Role[]): boolean {
    const userRole = this.currentRole();
    if (userRole === null) return false;
    const normalizedUserRole = parseRole(userRole);
    return roles.some((r) => parseRole(r) === normalizedUserRole);
  }

  /** Whether the signed-in user may open a path; see canAccessPath. */
  canAccess(path: string): boolean {
    return canAccessPath(this.currentRole(), path);
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${resolveApiUrl()}/auth/login`, payload, { withCredentials: true })
      .pipe(tap((user) => this.setStoredUser(user)));
  }

  logout(): void {
    this.removeStoredUser();
    this.currentUserSignal.set(null);
  }

  private normalizeUser(user: User): User {
    if (user && user.role !== undefined) {
      return { ...user, role: parseRole(user.role) };
    }
    return user;
  }

  private getStoredUser(): User | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const userString = localStorage.getItem(this.USER_KEY);
      if (!userString) return null;
      const parsed = JSON.parse(userString) as User;
      return this.normalizeUser(parsed);
    } catch {
      return null;
    }
  }

  private setStoredUser(rawUser: User): void {
    const user = this.normalizeUser(rawUser);
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
