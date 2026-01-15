import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, GoogleAuthProvider, signInWithPopup, user, User } from '@angular/fire/auth';
import { Storage, ref, uploadBytesResumable, percentage, getDownloadURL } from '@angular/fire/storage';
import { Firestore, collection, addDoc, query, where, orderBy, collectionData } from '@angular/fire/firestore';
import { Timestamp } from 'firebase/firestore';
import { map, switchMap, of } from 'rxjs';

export interface ImageMetadata {
  id?: string;
  name: string;
  imageUrl: string;
  userId: string;
  createdAt: Date;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  private auth: Auth = inject(Auth);
  private storage: Storage = inject(Storage);
  private firestore: Firestore = inject(Firestore);

  // Signal of the currently logged-in user
  user = toSignal(user(this.auth), { initialValue: null });
  
  // Track upload progress
  uploadProgress = signal<number | undefined>(undefined);
  uploadState = signal<string>('');
  
  // Photo preview
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  
  // User's images - automatically loads when user logs in
  private user$ = user(this.auth);
  images = toSignal(
    this.user$.pipe(
      switchMap((user) => {
        if (!user) {
          return of([]);
        }
        const imagesCollection = collection(this.firestore, 'images');
        const q = query(
          imagesCollection,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        return collectionData(q, { idField: 'id' }).pipe(
          map((images: any[]) => 
            images.map(img => ({
              ...img,
              createdAt: img.createdAt instanceof Timestamp 
                ? img.createdAt.toDate() 
                : img.createdAt instanceof Date 
                  ? img.createdAt 
                  : new Date(img.createdAt)
            }))
          )
        );
      })
    ),
    { initialValue: [] as ImageMetadata[] }
  );

  // 1. Login Logic
  login() {
    signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  logout() {
    this.auth.signOut();
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
  async uploadFile(currentUser: User) {
    if (!this.selectedFile) return;

    // PATH SECURITY: We put the file inside 'private_uploads/{uid}/'
    // This matches the Security Rules we wrote earlier.
    const filePath = `private_uploads/${currentUser.uid}/${this.selectedFile.name}`;
    const storageRef = ref(this.storage, filePath);

    // Start the upload
    const task = uploadBytesResumable(storageRef, this.selectedFile);

    // Link progress to UI using signal
    const progressSubscription = percentage(task).pipe(
      map(data => data.progress)
    ).subscribe(progress => {
      this.uploadProgress.set(progress);
    });
    
    // Monitor completion
    try {
      await task;
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Create document in Firestore
      const imagesCollection = collection(this.firestore, 'images');
      await addDoc(imagesCollection, {
        name: this.selectedFile.name,
        imageUrl: downloadURL,
        userId: currentUser.uid,
        createdAt: new Date()
      });
      
      this.uploadState.set('Upload Complete!');
      
      // Clear preview after successful upload
      // Images list will automatically refresh via the signal
      this.removePreview();
    } catch (err: any) {
      this.uploadState.set('Error: ' + err.message);
    } finally {
      // Always clean up subscription and reset progress
      progressSubscription.unsubscribe();
      this.uploadProgress.set(undefined);
    }
  }

}