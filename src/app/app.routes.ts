import { Routes } from '@angular/router';
import { InventoryPageComponent } from './pages/inventory/inventory.page.component';
import { PhotoBoothPageComponent } from './pages/photoboth/photoboth.page.component';

export const routes: Routes = [
  {
    path: 'photobooth',
    component: PhotoBoothPageComponent,
  },
  {
    path: 'inventory',
    component: InventoryPageComponent,
  },
];
