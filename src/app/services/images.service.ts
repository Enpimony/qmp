import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, addDoc, query, where, orderBy, collectionData } from '@angular/fire/firestore';
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
  providedIn: 'root'
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
      createdAt: this.convertTimestampToDate(doc.createdAt)
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
        createdAt: new Date()
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
        map((images: any[]) => images.map(img => this.transformImageData(img)))
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
}

