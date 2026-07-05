/**
 * Itinerario del rol Postgres (JG-15): del SQL sólido al guardián de los
 * datos. Convención completa de rutas de rol: cabecera de ./backend-php.js.
 */

/** Paradas del hito Peritus (13): SQL, modelado y transacciones con soltura. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/estructuras-datos',
  'bases/git',
  'bases/terminal',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'postgres/sql-fundamentos',
  'postgres/joins-agregaciones',
  'postgres/modelado-relacional',
  'postgres/tipos-datos',
  'postgres/transacciones',
  'postgres/indices',
  'postgres/sql-generado-ia',
]);

/** Paradas del hito Veteranus (25): concurrencia, EXPLAIN, administración y
 * verificación del SQL generado, con Docker y modelado de datos de arquitecto. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/estructuras-datos',
  'bases/git',
  'bases/terminal',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/code-review',
  'bases/seguridad-basica',
  'postgres/sql-fundamentos',
  'postgres/joins-agregaciones',
  'postgres/modelado-relacional',
  'postgres/tipos-datos',
  'postgres/transacciones',
  'postgres/mvcc-aislamiento',
  'postgres/bloqueos',
  'postgres/indices',
  'postgres/explain',
  'postgres/instalacion-configuracion',
  'postgres/backups-recuperacion',
  'postgres/seguridad-roles',
  'postgres/sql-generado-ia',
  'postgres/verificar-planes-ia',
  'postgres/migraciones-ia',
  'devops/docker',
  'software-architect/modelado-de-datos',
]);

/** Paradas del hito Magister (37): la isla completa (optimización, VACUUM,
 * replicación, JSONB, pgvector) más sistemas intensivos en datos, métricas
 * de operación y embeddings para cerrar el círculo con pgvector. */
const MAGISTER_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/estructuras-datos',
  'bases/git',
  'bases/terminal',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/code-review',
  'bases/seguridad-basica',
  'bases/profesional-ia',
  'postgres/sql-fundamentos',
  'postgres/joins-agregaciones',
  'postgres/modelado-relacional',
  'postgres/tipos-datos',
  'postgres/vistas-cte',
  'postgres/transacciones',
  'postgres/mvcc-aislamiento',
  'postgres/bloqueos',
  'postgres/indices',
  'postgres/explain',
  'postgres/optimizacion-consultas',
  'postgres/vacuum-mantenimiento',
  'postgres/instalacion-configuracion',
  'postgres/backups-recuperacion',
  'postgres/seguridad-roles',
  'postgres/replicacion-upgrades',
  'postgres/jsonb',
  'postgres/extensiones',
  'postgres/busqueda-vectores',
  'postgres/sql-generado-ia',
  'postgres/verificar-planes-ia',
  'postgres/migraciones-ia',
  'postgres/guardian-datos-ia',
  'devops/docker',
  'devops/metricas',
  'software-architect/modelado-de-datos',
  'software-architect/sistemas-intensivos-datos',
  'ai-engineer/embeddings',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'postgres',
  roleName: 'Postgres',
  tiers: {
    peritus: {
      name: 'Postgres · Grumete',
      description:
        'Ejecuta con autonomía: SQL sólido con joins y agregaciones, modelado ' +
        'relacional, transacciones e índices, y SQL generado con IA sin tragárselo.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Postgres · Corsario',
      description:
        'Decide y anticipa: MVCC, bloqueos y EXPLAIN para diagnosticar, backups, roles ' +
        'y seguridad para administrar, planes y migraciones verificados, Docker y ' +
        'modelado de datos con mirada de arquitecto.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Postgres · Capitán',
      description:
        'Transforma: optimización y mantenimiento a fondo, replicación y upgrades, ' +
        'JSONB, extensiones y pgvector con sus embeddings, sistemas intensivos en ' +
        'datos y métricas de operación — el guardián de los datos de la organización.',
      stops: MAGISTER_STOPS,
    },
  },
});
