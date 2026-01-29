import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';

export interface InventoryItem {
  id?: string;
  userId: string;
  category: string;
  imageUrl: string;
  embedding: number[];
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private firestore: Firestore = inject(Firestore);
  private authService = inject(AuthService);
  private injector = inject(Injector);

  private readonly COLLECTION_NAME = 'inventory';

  async addItem(input: Omit<InventoryItem, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const userId = this.authService.currentUserId;
    if (!userId) {
      throw new Error('Not authenticated');
    }

    return runInInjectionContext(this.injector, async () => {
      const colRef = collection(this.firestore, this.COLLECTION_NAME);
      const docRef = await addDoc(colRef, {
        ...input,
        userId,
        createdAt: new Date(),
      });
      return docRef.id;
    });
  }

  async getRecentItemsForCurrentUser(max = 50): Promise<InventoryItem[]> {
    const userId = this.authService.currentUserId;
    if (!userId) return [];

    return runInInjectionContext(this.injector, async () => {
      const colRef = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(colRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(max));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as InventoryItem[];
    });
  }
}


