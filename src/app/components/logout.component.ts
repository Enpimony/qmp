import { Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-logout',
  standalone: true,
  template: ` <button class="btn btn-outline btn-error w-full" (click)="logout()">Logout</button> `,
})
export class LogoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
