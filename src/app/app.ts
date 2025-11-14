import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLinkWithHref, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLinkWithHref, RouterLink, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('qmp');
  protected userAvatar = signal<string | null>(null);
  http = inject(HttpClient);
  supabaseService = inject(SupabaseService);

  async ngOnInit() {
    const { data } = await this.supabaseService.getClient().auth.getSession();
    if (!data.session) {
      await this.supabaseService.signInWithGoogle();
      return;
    }

    // Obtenir la foto del perfil
    const { user } = data.session;
    if (user?.user_metadata?.['avatar_url']) {
      this.userAvatar.set(user.user_metadata['avatar_url']);
    }
  }
}
