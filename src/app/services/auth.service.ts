import { Injectable, inject, NgZone } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, user, User } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private ngZone: NgZone = inject(NgZone);
  private _user$ = user(this.auth);

  // Observable of the currently logged-in user (for use in pipes)
  readonly user$: Observable<User | null> = this._user$;

  // Signal of the currently logged-in user (for use in templates/components)
  readonly user = toSignal(this._user$, { initialValue: null });

  /**
   * Sign in with Google using popup
   */
  async login(): Promise<void> {
    try {
      const result = await this.ngZone.run(() =>
        signInWithPopup(this.auth, new GoogleAuthProvider()),
      );
      console.log('Login successful:', result.user.email);

      // Wait until the user observable emits the logged-in user
      await new Promise<void>((resolve) => {
        const subscription = this._user$.subscribe((user) => {
          if (user) {
            subscription.unsubscribe();
            resolve();
          }
        });
      });
    } catch (error: any) {
      // Ignore popup-closed-by-user error as it's expected behavior
      if (
        error?.code !== 'auth/popup-closed-by-user' &&
        error?.code !== 'auth/cancelled-popup-request'
      ) {
        console.error('Login error:', error);
        throw error;
      }
    }
  }

  /**
   * Sign out the current user
   */
  async logout(): Promise<void> {
    await this.ngZone.run(() => this.auth.signOut());

    // Wait until the user observable emits null (logged-out state)
    await new Promise<void>((resolve) => {
      const subscription = this._user$.subscribe((user) => {
        if (!user) {
          subscription.unsubscribe();
          resolve();
        }
      });
    });
  }

  /**
   * Get the current user ID
   */
  get currentUserId(): string | null {
    return this.user()?.uid ?? null;
  }

  /**
   * Check if the user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.user();
  }
}
