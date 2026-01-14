import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, GoogleAuthProvider, signInWithPopup, user, User } from '@angular/fire/auth';
import { Storage, ref, uploadBytesResumable, percentage } from '@angular/fire/storage';
import { Observable } from 'rxjs';

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
  uploadProgress$: any = null;
  uploadState: string = '';

  // 1. Login Logic
  login() {
    signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  logout() {
    this.auth.signOut();
  }

  // 2. Upload Logic
  uploadFile(event: any, currentUser: User) {
    const file = event.target.files[0];
    if (!file) return;

    // PATH SECURITY: We put the file inside 'private_uploads/{uid}/'
    // This matches the Security Rules we wrote earlier.
    const filePath = `private_uploads/${currentUser.uid}/${file.name}`;
    const storageRef = ref(this.storage, filePath);

    // Start the upload
    const task = uploadBytesResumable(storageRef, file);

    // Link progress to UI
    this.uploadProgress$ = percentage(task);
    
    // Monitor completion
    task.then(() => {
      this.uploadState = 'Upload Complete!';
      this.uploadProgress$ = null;
    }).catch(err => {
      this.uploadState = 'Error: ' + err.message;
    });
  }
}