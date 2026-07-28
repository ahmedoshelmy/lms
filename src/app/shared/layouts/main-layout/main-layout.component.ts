import { afterNextRender, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ToastModule } from 'primeng/toast';
import { CommandPaletteComponent } from '../../components/command-palette/command-palette.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ToastModule, CommandPaletteComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
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
