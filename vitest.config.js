/**
 * Configuración de Vitest. La cobertura (lcov) alimenta el análisis de
 * SonarQube local (sonar-project.properties): `pnpm test:coverage` genera
 * coverage/lcov.info con el provider v8.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Shim de customElements para el smoke test de módulos (RMR-BUG-0015 guard).
    setupFiles: ['./test/smoke-setup.js'],
    // Config Firebase FALSA para que `src/lib/firebase.js` evalúe sin lanzar al
    // importar componentes (initializeApp es perezoso: no hace red al arrancar).
    // Sin esto, importar cualquier componente que toque Firebase truena por la
    // validación de PUBLIC_FIREBASE_* y el smoke test daría falsos positivos.
    env: {
      PUBLIC_FIREBASE_API_KEY: 'test',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'test',
      PUBLIC_FIREBASE_PROJECT_ID: 'test',
      PUBLIC_FIREBASE_STORAGE_BUCKET: 'test',
      PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'test',
      PUBLIC_FIREBASE_APP_ID: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['**/*.test.js', 'src/pages/**'],
    },
  },
});
