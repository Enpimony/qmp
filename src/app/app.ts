import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, GoogleAuthProvider, signInWithPopup, user, User } from '@angular/fire/auth';
import { Storage, ref, uploadBytesResumable, percentage } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

  // Observable of the currently logged-in user
  user$ = user(this.auth);
  
  // Track upload progress
  uploadProgress$: Observable<number | undefined> | null = null;
  uploadState: string = '';
  
  // Photo preview
  selectedFile: File | null = null;
  previewUrl: string | null = null;

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
    this.uploadState = '';
    this.uploadProgress$ = null;
    
    // Reset file input so same file can be selected again
    event.target.value = '';
  }

  removePreview() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.selectedFile = null;
    this.uploadState = '';
    this.uploadProgress$ = null;
  }

  // 3. Upload Logic
  uploadFile(currentUser: User) {
    if (!this.selectedFile) return;

    // PATH SECURITY: We put the file inside 'private_uploads/{uid}/'
    // This matches the Security Rules we wrote earlier.
    const filePath = `private_uploads/${currentUser.uid}/${this.selectedFile.name}`;
    const storageRef = ref(this.storage, filePath);

    // Start the upload
    const task = uploadBytesResumable(storageRef, this.selectedFile);

    // Link progress to UI
    this.uploadProgress$ = percentage(task).pipe(
      map(data => data.progress)
    );
    
    // Monitor completion
    task.then(() => {
      this.uploadState = 'Upload Complete!';
      this.uploadProgress$ = null;
      // Clear preview after successful upload
      this.removePreview();
    }).catch(err => {
      this.uploadState = 'Error: ' + err.message;
    });
  }
}