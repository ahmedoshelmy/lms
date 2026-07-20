import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from '../auth/login/login.component';
import { ScheduleComponent } from '../schedule/schedule.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LoginComponent, ScheduleComponent],
  templateUrl: './home.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }
  `,
})
export class HomeComponent implements OnInit {
  protected auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/schedule']);
    }
  }
}
