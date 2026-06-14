import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div>
      <h1>Auth Layout</h1>
      <router-outlet></router-outlet>
    </div>
  `,
  styles: '',
})
export class AuthLayoutComponent {}
