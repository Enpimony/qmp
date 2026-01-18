import { Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  template: ` <button class="btn btn-outline btn-error w-full" (click)="logout()">Logout</button> `,
})
export class LogoutComponent {
  private authService = inject(AuthService);

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
