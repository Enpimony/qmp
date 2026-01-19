import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterOutlet],
  templateUrl: './home.page.component.html',
  styleUrls: ['./home.page.component.css'],
})
export class HomePage {
  private authService = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }
}
