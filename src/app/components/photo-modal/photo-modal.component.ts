import { Component, inject, input, output, signal, computed, effect, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImagesService, ImageMetadata } from '../../services/images.service';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-photo-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-modal.component.html',
})
export class PhotoModalComponent implements AfterViewInit {
  private imagesService = inject(ImagesService);
  private storageService = inject(StorageService);
  private authService = inject(AuthService);

  @ViewChild('modalDialog') modalDialog!: ElementRef<HTMLDialogElement>;

  // Inputs
  image = input<ImageMetadata | null>(null);
  isOpen = input<boolean>(false);

  // Outputs
  closed = output<void>();
  deleted = output<ImageMetadata>();
  updated = output<ImageMetadata>();

  // Internal state
  isEditing = signal(false);
  editedName = signal('');
  isDeleting = signal(false);
  isUpdating = signal(false);
  errorMessage = signal<string | null>(null);

  // Computed
  readonly user = this.authService.user;

  // Format date for display
  formattedDate = computed(() => {
    const img = this.image();
    if (!img) return '';
    return new Date(img.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  constructor() {
    // Reset state when image changes
    effect(() => {
      const img = this.image();
      if (img) {
        this.editedName.set(img.name);
        this.isEditing.set(false);
      } else if (!this.isOpen()) {
        this.resetState();
      }
    });

    // Control dialog based on isOpen signal
    effect(() => {
      const open = this.isOpen();
      const img = this.image();
      
      // Use setTimeout to ensure ViewChild is initialized
      setTimeout(() => {
        if (this.modalDialog?.nativeElement) {
          if (open && img) {
            this.modalDialog.nativeElement.showModal();
          } else {
            if (this.modalDialog.nativeElement.open) {
              this.modalDialog.nativeElement.close();
            }
          }
        }
      }, 0);
    });
  }

  ngAfterViewInit(): void {
    // Initialize modal state if already open
    if (this.isOpen() && this.image()) {
      setTimeout(() => {
        if (this.modalDialog?.nativeElement) {
          this.modalDialog.nativeElement.showModal();
        }
      }, 0);
    }
  }

  private resetState(): void {
    this.isEditing.set(false);
    this.editedName.set('');
    this.isDeleting.set(false);
    this.isUpdating.set(false);
    this.errorMessage.set(null);
  }

  closeModal(): void {
    if (this.isDeleting() || this.isUpdating()) return;
    this.closed.emit();
  }

  startEditing(): void {
    const img = this.image();
    if (!img) return;
    this.editedName.set(img.name);
    this.isEditing.set(true);
    this.errorMessage.set(null);
  }

  cancelEditing(): void {
    const img = this.image();
    if (img) {
      this.editedName.set(img.name);
    }
    this.isEditing.set(false);
    this.errorMessage.set(null);
  }

  async saveName(): Promise<void> {
    const img = this.image();
    if (!img || !img.id) {
      this.errorMessage.set('Image ID not found');
      return;
    }

    const newName = this.editedName().trim();
    if (!newName) {
      this.errorMessage.set('Name cannot be empty');
      return;
    }

    if (newName === img.name) {
      this.cancelEditing();
      return;
    }

    const currentUser = this.user();
    if (!currentUser || img.userId !== currentUser.uid) {
      this.errorMessage.set('Unauthorized to edit this image');
      return;
    }

    this.isUpdating.set(true);
    this.errorMessage.set(null);

    try {
      await this.imagesService.updateImage(img.id, { name: newName });
      this.updated.emit({ ...img, name: newName });
      this.isEditing.set(false);
    } catch (err: any) {
      this.errorMessage.set('Error updating name: ' + err.message);
    } finally {
      this.isUpdating.set(false);
    }
  }

  async deletePhoto(): Promise<void> {
    const img = this.image();
    if (!img || !img.id) {
      this.errorMessage.set('Image ID not found');
      return;
    }

    const currentUser = this.user();
    if (!currentUser || img.userId !== currentUser.uid) {
      this.errorMessage.set('Unauthorized to delete this image');
      return;
    }

    // Confirm deletion
    if (!confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
      return;
    }

    this.isDeleting.set(true);
    this.errorMessage.set(null);

    try {
      // Delete file from Storage
      await this.storageService.deleteFileByUrl(img.imageUrl);
      // Delete document from Firestore
      await this.imagesService.deleteImage(img.id);
      this.deleted.emit(img);
      this.closed.emit();
    } catch (err: any) {
      this.errorMessage.set('Error deleting photo: ' + err.message);
    } finally {
      this.isDeleting.set(false);
    }
  }

  onNameInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.editedName.set(target.value);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.saveName();
    } else if (event.key === 'Escape') {
      this.cancelEditing();
    }
  }
}

