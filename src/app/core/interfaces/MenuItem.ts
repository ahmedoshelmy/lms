import { Role } from './Role';

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  roles: Role[];
}
