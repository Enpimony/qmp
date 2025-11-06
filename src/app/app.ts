import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('qmp');
  http = inject(HttpClient);
  supabaseService = inject(SupabaseService);

  async ngOnInit() {
    const { data } = await this.supabaseService.getClient().auth.getSession();
    if (!data.session) {
      await this.supabaseService.signInWithGoogle();
      return;
    }

    this.http.get('/.netlify/functions/consulta').subscribe((data) => {
      console.log(data);
    });
  }

  async addClothAndFetch() {
    await this.supabaseService.addClothAndFetch()
      .then((result: any) => console.log('Done', result))
      .catch((error: any) => console.error('Error', error));
  }
}
