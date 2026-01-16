import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, user, User } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private _user$ = user(this.auth);

  // Observable of the currently logged-in user (for use in pipes)
  readonly user$: Observable<User | null> = this._user$;

  // Signal of the currently logged-in user (for use in templates/components)
  readonly user = toSignal(this._user$, { initialValue: null });

  /**
   * Sign in with Google using popup
   */
  async login(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  /**
   * Sign out the current user
   */
  async logout(): Promise<void> {
    await this.auth.signOut();
  }

  /**
   * Get the current user ID
   */
  get currentUserId(): string | null {
    return this.user()?.uid ?? null;
  }
}

