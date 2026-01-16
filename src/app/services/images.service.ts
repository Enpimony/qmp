import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  collectionData,
  doc,
  deleteDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Timestamp } from 'firebase/firestore';
import { map, switchMap, of, Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';

export interface ImageMetadata {
  id?: string;
  name: string;
  imageUrl: string;
  userId: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ImagesService {
  private firestore: Firestore = inject(Firestore);
  private authService = inject(AuthService);
  private injector = inject(Injector);

  private readonly COLLECTION_NAME = 'images';

  /**
   * Convert Firestore Timestamp to JavaScript Date
   */
  private convertTimestampToDate(timestamp: any): Date {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date(timestamp);
  }

  /**
   * Transform Firestore document to ImageMetadata with proper date conversion
   */
  private transformImageData(doc: any): ImageMetadata {
    return {
      ...doc,
      createdAt: this.convertTimestampToDate(doc.createdAt),
    };
  }

  /**
   * Create a new image document in Firestore
   * @param metadata The image metadata to save
   * @returns Promise with the document ID
   */
  async createImage(metadata: Omit<ImageMetadata, 'id' | 'createdAt'>): Promise<string> {
    return runInInjectionContext(this.injector, async () => {
      const imagesCollection = collection(this.firestore, this.COLLECTION_NAME);
      const docRef = await addDoc(imagesCollection, {
        ...metadata,
        createdAt: new Date(),
      });
      return docRef.id;
    });
  }

  /**
   * Get all images for a specific user
   * @param userId The user's ID
   * @returns Observable of image metadata array
   */
  getUserImages(userId: string): Observable<ImageMetadata[]> {
    // Run Firebase APIs within injection context
    return runInInjectionContext(this.injector, () => {
      const imagesCollection = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(
        imagesCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      return collectionData(q, { idField: 'id' }).pipe(
        map((images: any[]) => images.map((img) => this.transformImageData(img)))
      );
    });
  }

  /**
   * Get all images for the currently logged-in user as a signal
   * Automatically updates when user changes
   * @returns Signal of image metadata array
   */
  getUserImagesSignal() {
    return toSignal(
      this.authService.user$.pipe(
        switchMap((user) => {
          if (!user) {
            return of([]);
          }
          return this.getUserImages(user.uid);
        })
      ),
      { initialValue: [] as ImageMetadata[] }
    );
  }

  /**
   * Delete an image document from Firestore
   * @param imageId The document ID of the image to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteImage(imageId: string): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const imageDoc = doc(this.firestore, this.COLLECTION_NAME, imageId);
      await deleteDoc(imageDoc);
    });
  }

  /**
   * Update an image document in Firestore
   * @param imageId The document ID of the image to update
   * @param updates Partial update object (only fields to update)
   * @returns Promise that resolves when update is complete
   */
  async updateImage(
    imageId: string,
    updates: Partial<Omit<ImageMetadata, 'id' | 'createdAt'>>
  ): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const imageDoc = doc(this.firestore, this.COLLECTION_NAME, imageId);
      await updateDoc(imageDoc, updates);
    });
  }

  private async scaleImageFile(file: Blob | File, maxWidth = 512): Promise<Blob> {
    try {
      const imgBitmap = await createImageBitmap(file);
      if (imgBitmap.width <= maxWidth) {
        imgBitmap.close?.();
        return file; // no scaling needed
      }

      const scale = maxWidth / imgBitmap.width;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(imgBitmap.width * scale);
      canvas.height = Math.round(imgBitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        imgBitmap.close?.();
        return file;
      }
      ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);
      imgBitmap.close?.();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, (file as File).type || 'image/png')
      );
      return blob ?? file;
    } catch (e) {
      // If any error occurs, fallback to original file
      return file;
    }
  }
}
