/**
 * Inicialización de Firebase (Web SDK).
 *
 * IMPORTANTE: este módulo SOLO debe importarse desde scripts de cliente
 * (componentes Lit o <script> de páginas Astro), nunca desde el frontmatter
 * Astro (servidor), porque depende de variables PUBLIC_* y del runtime de
 * navegador para auth.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

/** ¿Se apunta a los emuladores? Solo en E2E; en producción NUNCA (env apagada). */
const useEmulators = import.meta.env.PUBLIC_USE_EMULATORS === 'true';

/** @returns {import('firebase/app').FirebaseOptions} */
function readConfig() {
  const config = {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  };

  // Sin fallbacks silenciosos: si falta configuración, fallar de forma explícita.
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Falta configuración de Firebase: ${missing.join(', ')}. ` +
        'Copia .env.example a .env y rellena las variables PUBLIC_FIREBASE_*.',
    );
  }
  return config;
}

// Reutiliza la app si ya estaba inicializada (HMR / múltiples imports).
const app = getApps().length > 0 ? getApp() : initializeApp(readConfig());

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// E2E (RMR-TSK-0299): apuntar a los emuladores y exponer un login por custom
// token para que Playwright entre como cualquier rol sin pasar por el OAuth de
// Google (que no se puede automatizar). Todo esto queda MUERTO en producción:
// PUBLIC_USE_EMULATORS solo se pone en el arranque de los tests.
if (useEmulators && typeof window !== 'undefined') {
  const authHost = import.meta.env.PUBLIC_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9099';
  const fsHost = import.meta.env.PUBLIC_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1';
  connectAuthEmulator(auth, authHost, { disableWarnings: true });
  connectFirestoreEmulator(db, fsHost, 8181);
  // Puerta de entrada SOLO-test: el arnés inyecta el token de un rol y esto lo
  // canjea por una sesión real del SDK. No existe en el bundle de producción.
  // __e2eUid deja que el test espere una señal REAL de sesión (el uid ya fijado)
  // en vez de adivinar por timing.
  /** @type {any} */ (window).__e2eSignIn = (token) => signInWithCustomToken(auth, token);
  /** @type {any} */ (window).__e2eUid = () => auth.currentUser?.uid ?? null;
}

export { app };
