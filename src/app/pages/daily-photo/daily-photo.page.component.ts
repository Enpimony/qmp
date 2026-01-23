import { Component, inject, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { ImagesService, ImageMetadata } from '../../services/images.service';
import { MyPhotosComponent } from '../../components/my-photos/my-photos.component';
import { DailyPhotoUiService } from './daily-photo-ui.service';

@Component({
  selector: 'app-daily-photo',
  standalone: true,
  imports: [CommonModule, MyPhotosComponent],
  templateUrl: './daily-photo.page.component.html',
})
export class DailyPhotoComponent {
  // Inject services

  private imagesService = inject(ImagesService);
  private ui = inject(DailyPhotoUiService);

  readonly userImages = this.imagesService.getUserImagesSignal();
  readonly weatherData = this.ui.weatherData;
  readonly previewUrl = this.ui.previewUrl;

  // Track upload progress
  uploadProgress = signal<number | undefined>(undefined);
  uploadState = signal<string>('');

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    // Remove previous preview if exists
    this.removePreviousPreview();

    // Store file in the service
    this.ui.selectedFile = file;
    this.ui.previewUrl.set(URL.createObjectURL(file));

    // Reset upload state
    this.uploadState.set('');
    this.uploadProgress.set(undefined);

    // Reset file input so same file can be selected again
    event.target.value = '';
  }

  removePreviousPreview() {
    this.ui.selectedFile = null;
    this.ui.previewUrl.set(null);
    this.uploadState.set('');
    this.uploadProgress.set(undefined);
  }

  async processFile(): Promise<void> {
    if (!this.ui.selectedFile) return;
    await this.ui.uploadFile();
    await this.ui.detectBackground(this.ui.selectedFile);
    await this.ui.uploadFile();
  }
}
