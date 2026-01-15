import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Storage, ref, uploadBytesResumable, percentage, getDownloadURL } from '@angular/fire/storage';
import { map } from 'rxjs';

export interface UploadProgress {
  progress: number;
  downloadURL?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storage: Storage = inject(Storage);
  private injector = inject(Injector);

  /**
   * Upload a file to Firebase Storage
   * @param file The file to upload
   * @param path The storage path (e.g., 'private_uploads/{userId}/{fileName}')
   * @param onProgress Optional callback for upload progress (0-100)
   * @returns Promise with the download URL
   */
  async uploadFile(
    file: File,
    path: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Run initial Firebase APIs within injection context
    const { storageRef, task, progressSubscription } = runInInjectionContext(this.injector, () => {
      const storageRef = ref(this.storage, path);
      const task = uploadBytesResumable(storageRef, file);

      // Subscribe to progress if callback provided
      let progressSubscription: any;
      if (onProgress) {
        progressSubscription = percentage(task).pipe(
          map(data => data.progress)
        ).subscribe(progress => {
          onProgress(progress);
        });
      }

      return { storageRef, task, progressSubscription };
    });

    try {
      // Wait for upload to complete
      await task;
      
      // Get the download URL within injection context
      const downloadURL = await runInInjectionContext(this.injector, () => {
        return getDownloadURL(storageRef);
      });
      
      // Clean up subscription
      if (progressSubscription) {
        progressSubscription.unsubscribe();
      }
      
      return downloadURL;
    } catch (error) {
      // Clean up subscription on error
      if (progressSubscription) {
        progressSubscription.unsubscribe();
      }
      throw error;
    }
  }

  /**
   * Generate a secure file path for user uploads
   * @param userId The user's ID
   * @param fileName The original file name
   * @returns The storage path
   */
  getUserUploadPath(userId: string, fileName: string): string {
    return `private_uploads/${userId}/${fileName}`;
  }
}

