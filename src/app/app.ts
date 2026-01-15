import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { StorageService } from './services/storage.service';
import { ImagesService, ImageMetadata } from './services/images.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  // Inject services
  private authService = inject(AuthService);
  private storageService = inject(StorageService);
  private imagesService = inject(ImagesService);

  // Expose user signal for template
  readonly user = this.authService.user;
  
  // Track upload progress
  uploadProgress = signal<number | undefined>(undefined);
  uploadState = signal<string>('');
  
  // Photo preview
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  
  // User's images - automatically loads when user logs in
  readonly images = this.imagesService.getUserImagesSignal();
  
  // Track which images are being deleted
  deletingImages = signal<Set<string>>(new Set());

  // 1. Login Logic
  async login(): Promise<void> {
    await this.authService.login();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  // 2. Photo Selection & Preview
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Remove previous preview if exists
    this.removePreview();

    // Store file and create preview
    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
    
    // Reset upload state
    this.uploadState.set('');
    this.uploadProgress.set(undefined);
    
    // Reset file input so same file can be selected again
    event.target.value = '';
  }

  removePreview() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.selectedFile = null;
    this.uploadState.set('');
    this.uploadProgress.set(undefined);
  }

  // 3. Upload Logic
  async uploadFile(): Promise<void> {
    if (!this.selectedFile) return;

    const currentUser = this.user();
    if (!currentUser) {
      this.uploadState.set('Error: User not authenticated');
      return;
    }

    try {
      // Generate secure file path
      const filePath = this.storageService.getUserUploadPath(
        currentUser.uid,
        this.selectedFile.name
      );

      // Upload file with progress tracking
      const downloadURL = await this.storageService.uploadFile(
        this.selectedFile,
        filePath,
        (progress) => {
          this.uploadProgress.set(progress);
        }
      );

      // Create image metadata in Firestore
      await this.imagesService.createImage({
        name: this.selectedFile.name,
        imageUrl: downloadURL,
        userId: currentUser.uid
      });

      this.uploadState.set('Upload Complete!');
      
      // Clear preview after successful upload
      // Images list will automatically refresh via the signal
      this.removePreview();
    } catch (err: any) {
      this.uploadState.set('Error: ' + err.message);
      this.uploadProgress.set(undefined);
    }
  }

  // 4. Delete Logic
  async deleteImage(image: ImageMetadata): Promise<void> {
    if (!image.id) {
      this.uploadState.set('Error: Image ID not found');
      return;
    }

    const currentUser = this.user();
    if (!currentUser) {
      this.uploadState.set('Error: User not authenticated');
      return;
    }

    // Verify the image belongs to the current user
    if (image.userId !== currentUser.uid) {
      this.uploadState.set('Error: Unauthorized to delete this image');
      return;
    }

    // Add to deleting set
    this.deletingImages.update(set => new Set(set).add(image.id!));

    try {
      // Delete file from Storage
      const filePath = this.storageService.getUserUploadPath(
        currentUser.uid,
        image.name
      );
      await this.storageService.deleteFile(filePath);

      // Delete document from Firestore
      await this.imagesService.deleteImage(image.id);

      // Images list will automatically refresh via the signal
      this.uploadState.set('Image deleted successfully');
      
      // Clear message after a short delay
      setTimeout(() => {
        this.uploadState.set('');
      }, 2000);
    } catch (err: any) {
      this.uploadState.set('Error deleting image: ' + err.message);
    } finally {
      // Remove from deleting set
      this.deletingImages.update(set => {
        const newSet = new Set(set);
        newSet.delete(image.id!);
        return newSet;
      });
    }
  }

  // Helper to check if an image is being deleted
  isDeleting(imageId: string | undefined): boolean {
    if (!imageId) return false;
    return this.deletingImages().has(imageId);
  }
}