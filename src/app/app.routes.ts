import { Routes } from '@angular/router';
import { PhotoBoothPageComponent } from './pages/photobooth/photobooth.page.component';
import { InventoryPageComponent } from './pages/inventory/inventory.page.component';

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
