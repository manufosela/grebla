/**
 * Configuración E2E (RMR-TSK-0299). Todo corre contra los emuladores de Firebase
 * — nunca producción — así que el arranque real es:
 *
 *   firebase emulators:exec --only auth,firestore,functions,storage --project demo-grebla \
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
  // Astro 7 detecta que se le llama desde un agente de IA y arranca el servidor
  // COMO DEMONIO: el proceso que lanza Playwright termina de inmediato y la
  // suite entera muere con «Process from config.webServer exited early». Con
  // esta variable puesta, la autodetección se desactiva y el servidor se queda
  // en primer plano, que es lo que Playwright necesita para gobernar su vida.
  ASTRO_DEV_BACKGROUND: '1',
};

// El puerto se puede cambiar con E2E_PORT: en local, otro proyecto puede tener
// ocupado el 4321 y `reuseExistingServer` correría la suite contra ESA app.
function portFromEnv(raw) {
  if (raw === undefined || raw === '') return 4321;
  const n = Number(raw);
  // Un puerto inválido no se «arregla» por su cuenta: con 0 el servidor tomaría
  // uno al azar y la baseURL seguiría apuntando al 0, que es un fallo confuso.
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`E2E_PORT no es un puerto válido: ${raw}`);
  return n;
}

const PORT = portFromEnv(process.env.E2E_PORT);
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // `--host 127.0.0.1`: sin él, astro escucha en ::1 (IPv6) y Playwright, que
    // sondea 127.0.0.1 (IPv4), nunca lo da por listo en el runner y agota el
    // timeout. En local no cambia nada.
    command: `npx astro dev --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // En un runner de CI en frío, astro dev tarda más en levantar que en local.
    timeout: 150_000,
    // Ver la salida de astro dev en el log del job si algo falla al arrancar.
    stdout: 'pipe',
    stderr: 'pipe',
    env: EMULATOR_ENV,
  },
});
