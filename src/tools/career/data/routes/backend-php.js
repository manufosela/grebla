/**
 * Itinerario del rol Backend PHP (JG-14) — la primera ruta de ROL y NIVEL.
 *
 * ── CONVENCIÓN DE RUTAS DE ROL (léela antes de escribir el resto de roles) ──
 * Un módulo por rol en src/tools/career/data/routes/{disciplina}.js que
 * exporta ROUTE_TIERS y se registra en ./index.js (CAREER_ROUTES). Reglas:
 *
 *  1. `discipline` = la disciplina del rol (misma que su isla en el índice del
 *     archipiélago); `roleName` es el rótulo humano del grupo del selector.
 *  2. TRES HITOS por rol, alineados con los grupos de la escala GREBLA
 *     (src/tools/team/domain/levels.js): `peritus` (ejecuta con autonomía),
 *     `veteranus` (decide y anticipa) y `magister` (transforma). Los niveles
 *     intermedios juegan el hito superior más cercano (1-3 → peritus,
 *     4-5 → veteranus, 6-7 → magister).
 *  3. `stops` son ids de ciudad EXISTENTES en ISLAND_CONTENT, multi-isla y en
 *     ORDEN de visita: toda ruta entra por la isla de Bases (≥ 4 paradas
 *     `bases/` al principio — ojo: la isla tiene doc id 'island' pero sus
 *     ciudades llevan prefijo 'bases/') y toma de otras islas lo que el rol
 *     necesita. El orden respeta los prerequisitos INTRA-isla (si A es prereq
 *     de B y ambas son paradas, A va antes) y agrupa por isla.
 *  4. Tamaños orientativos: peritus 8-16, veteranus 16-26, magister 26-40.
 *  5. Rutas CRECIENTES: las paradas del peritus ⊂ veteranus ⊂ magister como
 *     CONJUNTOS (una excepción se documenta en el módulo del rol).
 *  6. routes.test.js valida 1-5 automáticamente para cada rol registrado.
 *
 * El seed (scripts/seed-career-routes.mjs) publica cada hito como doc
 * /careerRoutes/{disciplina}--{hito}; a partir de ahí la fuente de verdad es
 * Firestore (el superadmin edita las rutas desde la web, ADR JG-14).
 */

/** Paradas del hito Peritus (13): lo mínimo para ejecutar con autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/terminal',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'backend-php/php-8',
  'backend-php/composer',
  'backend-php/poo-php',
  'backend-php/api-rest',
  'backend-php/testing-php',
  'postgres/sql-fundamentos',
]);

/** Paradas del hito Veteranus (24): decide y anticipa en un backend real. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/terminal',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'backend-php/php-8',
  'backend-php/composer',
  'backend-php/poo-php',
  'backend-php/errores-excepciones',
  'backend-php/laravel',
  'backend-php/inyeccion-dependencias',
  'backend-php/api-rest',
  'backend-php/orm-eloquent',
  'backend-php/validacion-entrada',
  'backend-php/autenticacion',
  'backend-php/testing-php',
  'backend-php/api-produccion',
  'postgres/sql-fundamentos',
  'postgres/modelado-relacional',
  'devops/docker',
]);

/** Paradas del hito Magister (36): el Veteranus completo más operación,
 * rendimiento, datos a fondo y visión de arquitectura. */
const MAGISTER_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/terminal',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'backend-php/php-8',
  'backend-php/composer',
  'backend-php/poo-php',
  'backend-php/errores-excepciones',
  'backend-php/laravel',
  'backend-php/inyeccion-dependencias',
  'backend-php/api-rest',
  'backend-php/orm-eloquent',
  'backend-php/validacion-entrada',
  'backend-php/autenticacion',
  'backend-php/testing-php',
  'backend-php/api-produccion',
  'backend-php/colas-trabajos',
  'backend-php/cache-rendimiento',
  'backend-php/logs-monitorizacion',
  'backend-php/depuracion-perfilado',
  'backend-php/analisis-estatico',
  'backend-php/modernizar-legacy-ia',
  'postgres/sql-fundamentos',
  'postgres/modelado-relacional',
  'postgres/indices',
  'postgres/explain',
  'devops/docker',
  'devops/ci',
  'devops/metricas',
  'software-architect/trade-offs',
  'software-architect/apis-y-contratos',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'backend-php',
  roleName: 'Backend PHP',
  tiers: {
    peritus: {
      name: 'Backend PHP · Peritus',
      description:
        'Ejecuta con autonomía: fundamentos de software, PHP moderno con Composer y POO, ' +
        'una API REST con tests y el SQL imprescindible para tocar datos sin miedo.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Backend PHP · Veteranus',
      description:
        'Decide y anticipa: Laravel a fondo (DI, ORM, validación, autenticación), APIs ' +
        'listas para producción, code review y seguridad, modelado relacional y Docker.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Backend PHP · Magister',
      description:
        'Transforma: todo el Veteranus más colas, caché, observabilidad, perfilado, ' +
        'análisis estático y legacy con IA, Postgres afinado (índices, EXPLAIN), CI y ' +
        'métricas, y criterio de arquitectura (trade-offs, APIs y contratos).',
      stops: MAGISTER_STOPS,
    },
  },
});
