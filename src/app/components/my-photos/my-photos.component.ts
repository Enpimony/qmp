import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ImagesService, ImageMetadata } from '../../services/images.service';
import { PhotoModalComponent } from '../photo-modal/photo-modal.component';

@Component({
  selector: 'app-my-photos',
  standalone: true,
  imports: [CommonModule, DatePipe, PhotoModalComponent],
  templateUrl: './my-photos.component.html',
})
export class MyPhotosComponent {
  private imagesService = inject(ImagesService);

  // Get all images from service
  readonly allImages = this.imagesService.getUserImagesSignal();

  // Modal state
  selectedImage = signal<ImageMetadata | null>(null);
  isModalOpen = signal(false);

  // Filter images to only show those up to today, ordered by date (oldest first for carousel)
  filteredImages = computed(() => {
    const images = this.allImages();
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    return images
      .filter((img) => {
        const imgDate = new Date(img.createdAt);
        return imgDate <= today;
      })
      .sort((a, b) => {
        // Sort by date ascending (oldest first) for chronological carousel
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  });

  openPhotoModal(image: ImageMetadata): void {
    this.selectedImage.set(image);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    // Keep selectedImage for smooth closing animation
    setTimeout(() => {
      this.selectedImage.set(null);
    }, 200);
  }

  onPhotoDeleted(deletedImage: ImageMetadata): void {
    // Image list will automatically update via the signal
    this.closeModal();
  }

  onPhotoUpdated(updatedImage: ImageMetadata): void {
    // Image list will automatically update via the signal
    // Update selected image to reflect changes
    this.selectedImage.set(updatedImage);
  }

  getCarouselSlideId(index: number): string {
    return `slide${index + 1}`;
  }

  getPrevSlideId(currentIndex: number, total: number): string {
    if (currentIndex === 0) {
      return this.getCarouselSlideId(total - 1);
    }
    return this.getCarouselSlideId(currentIndex - 1);
  }

  getNextSlideId(currentIndex: number, total: number): string {
    if (currentIndex === total - 1) {
      return this.getCarouselSlideId(0);
    }
    return this.getCarouselSlideId(currentIndex + 1);
  }
}

