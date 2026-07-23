/**
 * Configuración E2E (RMR-TSK-0299). Todo corre contra los emuladores de Firebase
 * — nunca producción — así que el arranque real es:
 *
 *   firebase emulators:exec --only auth,firestore,functions --project demo-grebla \
 *     "npx playwright test"
 *
 * `emulators:exec` deja en el entorno FIRESTORE_EMULATOR_HOST y
 * FIREBASE_AUTH_EMULATOR_HOST, que el Admin SDK del global-setup usa para sembrar
 * y firmar custom tokens. El webServer de abajo levanta la app (astro dev) con
 * PUBLIC_USE_EMULATORS=true, que hace que el SDK del navegador apunte también a
 * los emuladores y exponga la puerta de login de test.
 */
import { defineConfig, devices } from '@playwright/test';

/** Config demo: el emulador de Auth acepta cualquier apiKey; el projectId debe existir. */
const EMULATOR_ENV = {
  PUBLIC_USE_EMULATORS: 'true',
  PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
  PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-grebla.firebaseapp.com',
  PUBLIC_FIREBASE_PROJECT_ID: 'demo-grebla',
  PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-grebla.appspot.com',
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0',
  PUBLIC_FIREBASE_APP_ID: 'demo-app-id',
  PUBLIC_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  PUBLIC_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  // Los tests tocan Firestore/Functions compartidos del emulador: en serie para
  // que un test no pise los datos de otro.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx astro dev --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: EMULATOR_ENV,
  },
});
