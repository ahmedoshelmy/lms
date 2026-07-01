import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.scss'],
})
export class UnauthorizedComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly homeRoute = '/dashboard';

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
