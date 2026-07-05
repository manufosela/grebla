/**
 * Itinerario del rol Backend Python (JG-15), espejo del rol Backend PHP.
 * Convención completa de rutas de rol: cabecera de ./backend-php.js.
 */

/** Paradas del hito Peritus (14): lo mínimo para ejecutar con autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/terminal',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'backend-python/python-moderno',
  'backend-python/entornos-uv',
  'backend-python/tipado',
  'backend-python/fastapi',
  'backend-python/api-rest',
  'backend-python/pytest',
  'postgres/sql-fundamentos',
]);

/** Paradas del hito Veteranus (24): decide y anticipa en un servicio real. */
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
  'backend-python/python-moderno',
  'backend-python/entornos-uv',
  'backend-python/tipado',
  'backend-python/estructuras-idiomaticas',
  'backend-python/errores-logging',
  'backend-python/fastapi',
  'backend-python/pydantic',
  'backend-python/api-rest',
  'backend-python/orm-sqlalchemy',
  'backend-python/autenticacion',
  'backend-python/pytest',
  'backend-python/servicio-produccion',
  'postgres/sql-fundamentos',
  'postgres/modelado-relacional',
  'devops/docker',
]);

/** Paradas del hito Magister (39): el Veteranus completo más async, contratos,
 * rendimiento, higiene de dependencias IA, Postgres afinado, CI/metricas y
 * criterio de arquitectura. */
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
  'bases/profesional-ia',
  'backend-python/python-moderno',
  'backend-python/entornos-uv',
  'backend-python/tipado',
  'backend-python/estructuras-idiomaticas',
  'backend-python/errores-logging',
  'backend-python/asyncio',
  'backend-python/fastapi',
  'backend-python/pydantic',
  'backend-python/api-rest',
  'backend-python/orm-sqlalchemy',
  'backend-python/autenticacion',
  'backend-python/tareas-background',
  'backend-python/openapi-contratos',
  'backend-python/rendimiento-perfilado',
  'backend-python/pytest',
  'backend-python/ruff-linting',
  'backend-python/depuracion-python',
  'backend-python/servicio-produccion',
  'backend-python/dependencias-verificadas',
  'postgres/sql-fundamentos',
  'postgres/modelado-relacional',
  'postgres/indices',
  'postgres/explain',
  'devops/docker',
  'devops/ci',
  'devops/metricas',
  'software-architect/trade-offs',
  'software-architect/apis-y-contratos',
  'ai-engineer/apis-modelos',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'backend-python',
  roleName: 'Backend Python',
  tiers: {
    peritus: {
      name: 'Backend Python · Grumete',
      description:
        'Ejecuta con autonomía: fundamentos de software, Python moderno tipado con uv, ' +
        'una API REST con FastAPI y pytest, y el SQL imprescindible para tocar datos.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Backend Python · Corsario',
      description:
        'Decide y anticipa: Pydantic y SQLAlchemy a fondo, autenticación, un servicio ' +
        'en producción con code review y seguridad, modelado relacional y Docker.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Backend Python · Capitán',
      description:
        'Transforma: async, tareas en segundo plano, contratos OpenAPI, perfilado y ' +
        'dependencias verificadas frente a la IA, Postgres afinado (índices, EXPLAIN), ' +
        'CI y métricas, y criterio de arquitectura (trade-offs, APIs y contratos).',
      stops: MAGISTER_STOPS,
    },
  },
});
