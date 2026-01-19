import { Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-page',
  template: `
    <div class="flex items-center justify-center h-screen">
      <div class="card w-96 bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="logo-container">
            <img src="logo.webp" alt="Kempo Logo" class="logo" />
          </div>
          <p class="text-center mb-2">Please sign in to continue</p>
          <div class="card-actions justify-center">
            <button class="btn btn-primary" (click)="login()">Sign in with Google</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .h-screen {
        height: 100vh;
      }

      .logo-container {
        display: flex;
        justify-content: center;
        margin-bottom: 20px;
      }

      .logo {
        max-width: 200px;
        height: auto;
      }
    `,
  ],
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
