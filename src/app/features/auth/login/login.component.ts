import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/interfaces/Role';
import { User } from '../../../core/models/User';

interface RoleOption {
  role: Role;
  name: string;
  description: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loadingRole: Role | null = null;

  readonly roles: RoleOption[] = [
    {
      role: Role.Admin,
      name: 'Admin',
      description: 'Full access to all features',
    },
    {
      role: Role.Operation,
      name: 'Operations',
      description: 'Manage users and system operations',
    },
    {
      role: Role.Instructor,
      name: 'Instructor',
      description: 'Teach courses and manage attendance',
    },
    {
      role: Role.Student,
      name: 'Student',
      description: 'Learn and track progress',
    },
  ];

  loginAs(role: Role): void {
    if (this.loadingRole) {
      return;
    }

    this.loadingRole = role;

    const user: User = {
      id: 1,
      name: this.generateName(role),
      email: this.generateEmail(role),
      role,
    };

    this.auth.login(user);

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }

  getRoleIcon(role: Role): string {
    switch (role) {
      case Role.Admin:
        return 'pi-shield';
      case Role.Operation:
        return 'pi-cog';
      case Role.Instructor:
        return 'pi-book';
      case Role.Student:
        return 'pi-user';
    }
  }

  private generateName(role: Role): string {
    switch (role) {
      case Role.Admin:
        return 'Admin User';
      case Role.Operation:
        return 'Operations Manager';
      case Role.Instructor:
        return 'John Instructor';
      case Role.Student:
        return 'Muhammad Osama';
    }
  }

  private generateEmail(role: Role): string {
    return `${role.toLowerCase()}@example.com`;
  }
}
