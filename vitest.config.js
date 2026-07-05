/**
 * Configuración de Vitest. La cobertura (lcov) alimenta el análisis de
 * SonarQube local (sonar-project.properties): `pnpm test:coverage` genera
 * coverage/lcov.info con el provider v8.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['**/*.test.js', 'src/pages/**'],
    },
  },
});
