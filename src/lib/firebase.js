/**
 * Inicialización de Firebase (Web SDK).
 *
 * IMPORTANTE: este módulo SOLO debe importarse desde scripts de cliente
 * (componentes Lit o <script> de páginas Astro), nunca desde el frontmatter
 * Astro (servidor), porque depende de variables PUBLIC_* y del runtime de
 * navegador para auth.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export { app };
