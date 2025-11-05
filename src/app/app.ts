import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('qmp');
  http = inject(HttpClient);

  ngOnInit() {
    this.http.get('/.netlify/functions/consulta').subscribe((data) => {
      console.log(data);
    });
  }
}
