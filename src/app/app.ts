import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { StorageService } from './services/storage.service';
import { ImagesService, ImageMetadata } from './services/images.service';
import { RemoveBgPage } from './remove-bg.page';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RemoveBgPage],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
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

  // Track which images are being edited (imageId -> edited name)
  editingImages = signal<Map<string, string>>(new Map());

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
        userId: currentUser.uid,
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
    this.deletingImages.update((set) => new Set(set).add(image.id!));

    try {
      // Delete file from Storage using the URL (which contains the original path)
      // This works even if the name was edited in Firestore
      await this.storageService.deleteFileByUrl(image.imageUrl);

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
      this.deletingImages.update((set) => {
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

  // 5. Edit Logic
  startEditing(image: ImageMetadata): void {
    if (!image.id) return;
    this.editingImages.update((map) => {
      const newMap = new Map(map);
      newMap.set(image.id!, image.name);
      return newMap;
    });
  }

  cancelEditing(imageId: string | undefined): void {
    if (!imageId) return;
    this.editingImages.update((map) => {
      const newMap = new Map(map);
      newMap.delete(imageId);
      return newMap;
    });
  }

  updateEditingName(imageId: string, newName: string): void {
    this.editingImages.update((map) => {
      const newMap = new Map(map);
      newMap.set(imageId, newName);
      return newMap;
    });
  }

  getEditingName(imageId: string | undefined): string {
    if (!imageId) return '';
    return this.editingImages().get(imageId) || '';
  }

  isEditing(imageId: string | undefined): boolean {
    if (!imageId) return false;
    return this.editingImages().has(imageId);
  }

  async saveImageName(image: ImageMetadata): Promise<void> {
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
      this.uploadState.set('Error: Unauthorized to edit this image');
      return;
    }

    const editedName = this.getEditingName(image.id);
    if (!editedName || editedName.trim() === '') {
      this.uploadState.set('Error: Name cannot be empty');
      this.cancelEditing(image.id);
      return;
    }

    // If name hasn't changed, just cancel editing
    if (editedName === image.name) {
      this.cancelEditing(image.id);
      return;
    }

    try {
      await this.imagesService.updateImage(image.id, {
        name: editedName.trim(),
      });

      // Images list will automatically refresh via the signal
      this.uploadState.set('Name updated successfully');

      // Clear message after a short delay
      setTimeout(() => {
        this.uploadState.set('');
      }, 2000);

      // Cancel editing
      this.cancelEditing(image.id);
    } catch (err: any) {
      this.uploadState.set('Error updating name: ' + err.message);
    }
  }
}
