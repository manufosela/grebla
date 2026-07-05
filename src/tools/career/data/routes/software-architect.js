/**
 * Itinerario del rol Software Architect (JG-15): del pensamiento sistémico
 * al arquitecto de la era IA. Convención: cabecera de ./backend-php.js.
 */

/** Paradas del hito Peritus (14): pensar sistemas y decidir con trade-offs. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/leer-codigo',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'software-architect/rol-del-arquitecto',
  'software-architect/pensamiento-sistemico',
  'software-architect/trade-offs',
  'software-architect/requisitos-no-funcionales',
  'software-architect/monolito-modular',
  'software-architect/acoplamiento-cohesion',
  'software-architect/modelado-de-datos',
  'software-architect/apis-y-contratos',
]);

/** Paradas del hito Veteranus (24): estilos arquitectónicos, consistencia,
 * ADRs y el terreno operativo (datos relacionales, Docker, SLOs). */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/leer-codigo',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/code-review',
  'bases/seguridad-basica',
  'software-architect/rol-del-arquitecto',
  'software-architect/pensamiento-sistemico',
  'software-architect/trade-offs',
  'software-architect/requisitos-no-funcionales',
  'software-architect/monolito-modular',
  'software-architect/microservicios',
  'software-architect/event-driven',
  'software-architect/acoplamiento-cohesion',
  'software-architect/modelado-de-datos',
  'software-architect/consistencia-cap',
  'software-architect/sistemas-intensivos-datos',
  'software-architect/apis-y-contratos',
  'software-architect/adrs',
  'postgres/modelado-relacional',
  'devops/docker',
  'devops/slos',
]);

/** Paradas del hito Magister (39): la isla completa (fitness functions,
 * arquitectura evolutiva, plataforma, liderazgo, diseño con LLMs) más
 * índices de Postgres, fundamentos de LLM, gestión hacia arriba y North Star. */
const MAGISTER_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/leer-codigo',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/code-review',
  'bases/seguridad-basica',
  'bases/profesional-ia',
  'software-architect/rol-del-arquitecto',
  'software-architect/pensamiento-sistemico',
  'software-architect/trade-offs',
  'software-architect/requisitos-no-funcionales',
  'software-architect/monolito-modular',
  'software-architect/microservicios',
  'software-architect/event-driven',
  'software-architect/acoplamiento-cohesion',
  'software-architect/modelado-de-datos',
  'software-architect/consistencia-cap',
  'software-architect/sistemas-intensivos-datos',
  'software-architect/apis-y-contratos',
  'software-architect/adrs',
  'software-architect/fitness-functions',
  'software-architect/arquitectura-evolutiva',
  'software-architect/observabilidad',
  'software-architect/platform-engineering',
  'software-architect/devex',
  'software-architect/liderazgo-tecnico',
  'software-architect/disenar-con-llms',
  'software-architect/revisar-arquitecturas-ia',
  'software-architect/coste-y-riesgo-llm',
  'software-architect/arquitecto-era-ia',
  'postgres/modelado-relacional',
  'postgres/indices',
  'devops/docker',
  'devops/slos',
  'ai-engineer/como-funciona-llm',
  'engineering-manager/comunicar-hacia-arriba',
  'product-manager/north-star',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'software-architect',
  roleName: 'Software Architect',
  tiers: {
    peritus: {
      name: 'Software Architect · Peritus',
      description:
        'Ejecuta con autonomía: pensamiento sistémico, decisiones por trade-offs, ' +
        'atributos de calidad, monolito modular bien acoplado, modelado de datos y ' +
        'contratos de API.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Software Architect · Veteranus',
      description:
        'Decide y anticipa: microservicios y event-driven cuando tocan, consistencia ' +
        'y CAP, sistemas intensivos en datos, ADRs por escrito y el terreno operativo ' +
        'real: modelado relacional, Docker y SLOs.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Software Architect · Magister',
      description:
        'Transforma: arquitectura evolutiva con fitness functions, observabilidad, ' +
        'platform engineering y DevEx, liderazgo técnico y diseño de sistemas con ' +
        'LLMs, comunicando hacia arriba y alineado con la North Star del producto.',
      stops: MAGISTER_STOPS,
    },
  },
});
