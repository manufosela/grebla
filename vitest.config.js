/**
 * Configuración de Vitest. La cobertura (lcov) alimenta el análisis de
 * SonarQube local (sonar-project.properties): `pnpm test:coverage` genera
 * coverage/lcov.info con el provider v8.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los E2E (e2e/**) los corre Playwright, no Vitest: usan @playwright/test y
    // los emuladores. Sin excluirlos, Vitest los recoge por el patrón *.spec y
    // truena al importar el runner de Playwright.
    // `.claude/**` excluye los worktrees de agentes (isolation: worktree), que si
    // no se limpian duplican y rompen la suite (y ralentizan el hook pre-push).
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/.claude/**'],
    // Shim de customElements para el smoke test de módulos (RMR-BUG-0015 guard).
    setupFiles: ['./test/smoke-setup.js'],
    // `functions/` tiene sus propios node_modules y en CI no se instalan: sin
    // este alias, importar el publicador del portal tumba la suite entera por
    // una dependencia que el test ni siquiera usa.
    alias: { 'firebase-functions/v2': new URL('./test/firebase-functions-logger-stub.js', import.meta.url).pathname },
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
      // Los umbrales GLOBALES van al valor REAL de hoy, un punto por debajo, no
      // al deseable: un suelo inalcanzable bloquea a todo el mundo el primer día
      // y acaba desactivado. Sirven de trinquete — solo pueden subir.
      // Los módulos que deciden QUIÉN VE QUÉ llevan suelo propio y alto: son los
      // que fallan sin que nada se vea (RMR-TSK-0444).
      thresholds: {
        lines: 27,
        branches: 28,
        functions: 26,
        statements: 28,
        'src/lib/access.js': { lines: 100, branches: 85, functions: 100, statements: 100 },
        'src/lib/accessRoles.js': { lines: 95, branches: 90, functions: 100, statements: 95 },
        'src/lib/toolPolicies.js': { lines: 100, branches: 90, functions: 100, statements: 92 },
      },
    },
  },
});
