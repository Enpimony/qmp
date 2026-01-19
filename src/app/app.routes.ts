import { Routes } from '@angular/router';
import { DailyPhotoComponent } from './pages/daily-photo.page.component';
import { AuthGuard } from './guards/auth.guard';
import { LoginPage } from './pages/login.page.component';

export const routes: Routes = [
  {
    path: '',
    component: DailyPhotoComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'login',
    component: LoginPage,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
