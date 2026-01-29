import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Polyfill for libraries that assume Node's Buffer exists (some TFJS deps)
import { Buffer } from 'buffer';
(globalThis as any).Buffer ??= Buffer;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
