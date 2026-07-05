/**
 * Itinerario del rol AI Engineer (JG-15): de entender el LLM a producto con
 * IA en producción. Convención de rutas: cabecera de ./backend-php.js.
 *
 * Cruces: la ruta apoya la parte de servicio en Python (FastAPI, Pydantic) y
 * la de datos en Postgres (SQL y pgvector), el stack natural del rol.
 */

/** Paradas del hito Peritus (14): entender modelos y prompts con método. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'ai-engineer/como-funciona-llm',
  'ai-engineer/limites-modelos',
  'ai-engineer/apis-modelos',
  'ai-engineer/prompting',
  'ai-engineer/context-engineering',
  'ai-engineer/salida-estructurada',
  'ai-engineer/evals',
  'postgres/sql-fundamentos',
]);

/** Paradas del hito Veteranus (26): RAG, agentes, seguridad y coste, con el
 * stack de servicio (FastAPI, Pydantic, pgvector, Docker) para servirlo. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'ai-engineer/como-funciona-llm',
  'ai-engineer/limites-modelos',
  'ai-engineer/apis-modelos',
  'ai-engineer/prompting',
  'ai-engineer/context-engineering',
  'ai-engineer/salida-estructurada',
  'ai-engineer/embeddings',
  'ai-engineer/rag',
  'ai-engineer/tool-use',
  'ai-engineer/agentes',
  'ai-engineer/evals',
  'ai-engineer/seguridad-ia',
  'ai-engineer/coste-latencia',
  'backend-python/fastapi',
  'backend-python/pydantic',
  'postgres/sql-fundamentos',
  'postgres/busqueda-vectores',
  'devops/docker',
]);

/** Paradas del hito Magister (38): la isla completa (orquestación, MCP,
 * observabilidad, fine-tuning, UX de incertidumbre) más métricas de
 * operación, experimentación de producto y trade-offs de arquitectura. */
const MAGISTER_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'bases/profesional-ia',
  'ai-engineer/como-funciona-llm',
  'ai-engineer/limites-modelos',
  'ai-engineer/apis-modelos',
  'ai-engineer/modelos-abiertos',
  'ai-engineer/prompting',
  'ai-engineer/context-engineering',
  'ai-engineer/salida-estructurada',
  'ai-engineer/embeddings',
  'ai-engineer/rag',
  'ai-engineer/busqueda-hibrida',
  'ai-engineer/tool-use',
  'ai-engineer/agentes',
  'ai-engineer/mcp',
  'ai-engineer/orquestacion',
  'ai-engineer/evals',
  'ai-engineer/observabilidad-llm',
  'ai-engineer/seguridad-ia',
  'ai-engineer/coste-latencia',
  'ai-engineer/fine-tuning',
  'ai-engineer/ux-incertidumbre',
  'ai-engineer/producto-ia-produccion',
  'backend-python/fastapi',
  'backend-python/pydantic',
  'postgres/sql-fundamentos',
  'postgres/busqueda-vectores',
  'devops/docker',
  'devops/metricas',
  'product-manager/hipotesis-experimentos',
  'software-architect/trade-offs',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'ai-engineer',
  roleName: 'AI Engineer',
  tiers: {
    peritus: {
      name: 'AI Engineer · Grumete',
      description:
        'Ejecuta con autonomía: cómo funciona un LLM y sus límites, APIs de modelos, ' +
        'prompting y context engineering con método, salida estructurada y evals ' +
        'para medir en vez de intuir, con el SQL de base para tocar datos.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'AI Engineer · Corsario',
      description:
        'Decide y anticipa: embeddings y RAG, tool use y agentes, seguridad de IA y ' +
        'control de coste y latencia, servidos con FastAPI, Pydantic, pgvector y ' +
        'Docker como stack de producción.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'AI Engineer · Capitán',
      description:
        'Transforma: orquestación multiagente, MCP, observabilidad de LLMs, ' +
        'fine-tuning con criterio y UX de la incertidumbre hasta producto con IA en ' +
        'producción, más métricas, experimentación e ingeniería de trade-offs.',
      stops: MAGISTER_STOPS,
    },
  },
});
