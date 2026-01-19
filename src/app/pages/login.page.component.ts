import { Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-page',
  template: ` <button class="btn btn-primary w-full" (click)="login()">Login</button> `,
})
export class LoginPage {
  private authService = inject(AuthService);
  private router = inject(Router);

  login(): void {
    this.authService
      .login()
      .then(() => {
        this.router.navigate(['/']);
      })
      .catch((error) => {
        console.error('Login failed:', error);
      });
  }
}
