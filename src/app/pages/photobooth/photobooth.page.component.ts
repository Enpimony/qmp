import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoboothSectionComponent } from 'src/app/components/photobooth-section/photobooth-section';
import { PhotoboothSectionItemComponent } from 'src/app/components/photobooth-section-item/photobooth-section-item';
import { PhotoManagerComponent } from 'src/app/components/photo-manager/photo-manager';

export interface Item {
  id: string;
  name: string;
}
export interface Section {
  id: string;
  title: string;
  items?: Item[];
}

@Component({
  selector: 'app-photobooth',
  standalone: true,
  imports: [
    CommonModule,
    PhotoboothSectionComponent,
    PhotoboothSectionItemComponent,
    PhotoManagerComponent,
  ],
  templateUrl: './photobooth.page.component.html',
  styleUrls: ['./photobooth.page.component.scss'],
})
export class PhotoBoothPageComponent {
  sections = signal<Section[]>([
    {
      id: 'top',
      title: 'Top',
      items: [
        { id: '1', name: 'T-Shirt' },
        { id: '2', name: 'Hoodie' },
        { id: '3', name: 'Jacket' },
      ],
    },
    {
      id: 'bottom',
      title: 'Bottom',
      items: [
        { id: '4', name: 'Jeans' },
        { id: '5', name: 'Shorts' },
        { id: '6', name: 'Skirt' },
      ],
    },
  ]);

  currentSection = signal<Section>(this.sections()[0]);

  selectSection(section: Section) {
    console.log('Selected section:', section);
    this.currentSection.set(section);
  }
}
