import { Component, input, output, model } from '@angular/core';
import { RouterModule } from '@angular/router';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidebar.component.html',
  // You can now safely delete sidebar.component.scss
})
export class SidebarComponent {
  isOpen = model(true);
  menuItemClicked = output<void>();

  menuItems: MenuItem[] = [
    { label: 'Overview', icon: 'pi pi-th-large', route: '/dashboard' },
    { label: 'Progress', icon: 'pi pi-chart-line', route: '/progress' },
    { label: 'Attendance', icon: 'pi pi-calendar', route: '/attendance' },
    { label: 'Resources', icon: 'pi pi-folder', route: '/resources' },
  ];

  student = {
    initials: 'MO',
    name: 'Muhammad Osama',
    group: 'Group A1',
    streak: 14,
  };

  onMenuItemClick() {
    this.menuItemClicked.emit();
  }

  toggleSidebar() {
    this.isOpen.update(v => !v);
  }
}