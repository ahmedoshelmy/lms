import { afterNextRender, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ToastModule } from 'primeng/toast';
import { SessionService } from '../../../core/services/session.service';
import { ConfirmHostComponent } from '../../components/confirm-host/confirm-host.component';
import { CommandPaletteComponent } from '../../components/command-palette/command-palette.component';
import { OutstandingWorkComponent } from '../../components/outstanding-work/outstanding-work.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    ToastModule,
    ConfirmHostComponent,
    CommandPaletteComponent,
    OutstandingWorkComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  /** Started with the signed-in shell: clears up after a session ends, and hears other tabs. */
  private readonly session = inject(SessionService);

  isSidebarOpen = signal(true);

  constructor() {
    afterNextRender(() => {
      if (window.matchMedia('(max-width: 768px)').matches) {
        this.isSidebarOpen.set(false);
      }
    });
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  onMenuItemClicked(): void {
    if (window.matchMedia('(max-width: 768px)').matches) {
      this.closeSidebar();
    }
  }
}
