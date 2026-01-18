import { Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: ` <button class="btn btn-primary w-full" (click)="login()">Login</button> `,
})
export class LoginComponent {
  private authService = inject(AuthService);

  async login(): Promise<void> {
    await this.authService.login();
  }
}
