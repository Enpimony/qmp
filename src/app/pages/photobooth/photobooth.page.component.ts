import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoboothSectionComponent } from 'src/app/components/photobooth-section/photobooth-section';

export interface Section {
  id: string;
  title: string;
  items?: any[];
}

@Component({
  selector: 'app-photobooth',
  standalone: true,
  imports: [CommonModule, PhotoboothSectionComponent],
  templateUrl: './photobooth.page.component.html',
  styleUrls: ['./photobooth.page.component.scss'],
})
export class PhotoBoothPageComponent {
  sections = signal<Section[]>([
    { id: 'top', title: 'Top', items: ['T-Shirt', 'Hoodie', 'Jacket'] },
    { id: 'bottom', title: 'Bottom', items: ['Jeans', 'Shorts', 'Skirt'] },
  ]);

  currentSection = signal<Section>(this.sections()[0]);

  selectSection(section: Section) {
    console.log('Selected section:', section);
    this.currentSection.set(section);
  }
}
