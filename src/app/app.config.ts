import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() =>
      initializeApp({
        projectId: 'kempo-13607',
        appId: '1:1053017002557:web:d8ac6da65e5e2914b9d054',
        storageBucket: 'kempo-13607.firebasestorage.app',
        apiKey: 'AIzaSyDYcZ58U21UqWPgO8yphgOx0yrPuVwxiwY',
        authDomain: 'kempo-13607.firebaseapp.com',
        messagingSenderId: '1053017002557',
        measurementId: 'G-WBBKGXPN1G',
      })
    ),
    provideAuth(() => getAuth()),
    provideStorage(() => getStorage()),
    provideFirestore(() => getFirestore()),
    provideHttpClient(),
  ],
};
