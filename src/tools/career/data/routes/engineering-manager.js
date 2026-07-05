/**
 * Itinerario del rol Engineering Manager (JG-15): del primer 1:1 al manager
 * multiplicador. Convención de rutas: cabecera de ./backend-php.js.
 *
 * Las Bases pesan menos en técnica que en los roles de código: entra por
 * delegar, code review, comunicación asíncrona y estimación, que son las
 * herramientas diarias del EM.
 */

/** Paradas del hito Peritus (14): liderar personas con autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/pensar-con-ia',
  'bases/delegar-o-hacer',
  'bases/verificar-salida-ia',
  'bases/git',
  'bases/code-review',
  'bases/comunicacion-async',
  'bases/estimacion',
  'engineering-manager/rol-del-em',
  'engineering-manager/soltar-el-codigo',
  'engineering-manager/gestion-del-tiempo',
  'engineering-manager/one-on-ones',
  'engineering-manager/feedback',
  'engineering-manager/delegacion',
  'engineering-manager/prioridades-y-foco',
]);

/** Paradas del hito Veteranus (25): equipo sano, delivery medible y gestión
 * hacia arriba, con priorización y stakeholders de producto. */
const VETERANUS_STOPS = Object.freeze([
  'bases/pensar-con-ia',
  'bases/delegar-o-hacer',
  'bases/verificar-salida-ia',
  'bases/git',
  'bases/code-review',
  'bases/documentacion',
  'bases/comunicacion-async',
  'bases/estimacion',
  'engineering-manager/rol-del-em',
  'engineering-manager/soltar-el-codigo',
  'engineering-manager/gestion-del-tiempo',
  'engineering-manager/one-on-ones',
  'engineering-manager/feedback',
  'engineering-manager/marcos-de-carrera',
  'engineering-manager/delegacion',
  'engineering-manager/conversaciones-dificiles',
  'engineering-manager/seguridad-psicologica',
  'engineering-manager/dinamicas-de-equipo',
  'engineering-manager/motivacion-y-burnout',
  'engineering-manager/prioridades-y-foco',
  'engineering-manager/metricas-sin-goodhart',
  'engineering-manager/gestion-de-proyectos',
  'engineering-manager/comunicar-hacia-arriba',
  'product-manager/priorizar-impacto-esfuerzo',
  'product-manager/stakeholders',
]);

/** Paradas del hito Magister (37): la isla completa (contratación, equipos
 * aumentados por IA, liderar en el cambio) más trade-offs de arquitectura,
 * gestión de incidentes y entendimiento real de los límites de los modelos. */
const MAGISTER_STOPS = Object.freeze([
  'bases/pensar-con-ia',
  'bases/delegar-o-hacer',
  'bases/verificar-salida-ia',
  'bases/git',
  'bases/code-review',
  'bases/documentacion',
  'bases/comunicacion-async',
  'bases/estimacion',
  'bases/profesional-ia',
  'engineering-manager/rol-del-em',
  'engineering-manager/soltar-el-codigo',
  'engineering-manager/gestion-del-tiempo',
  'engineering-manager/one-on-ones',
  'engineering-manager/feedback',
  'engineering-manager/marcos-de-carrera',
  'engineering-manager/delegacion',
  'engineering-manager/conversaciones-dificiles',
  'engineering-manager/seguridad-psicologica',
  'engineering-manager/dinamicas-de-equipo',
  'engineering-manager/motivacion-y-burnout',
  'engineering-manager/prioridades-y-foco',
  'engineering-manager/metricas-sin-goodhart',
  'engineering-manager/gestion-de-proyectos',
  'engineering-manager/comunicar-hacia-arriba',
  'engineering-manager/entrevistas',
  'engineering-manager/onboarding',
  'engineering-manager/construir-el-equipo',
  'engineering-manager/equipos-aumentados-ia',
  'engineering-manager/medir-productividad-ia',
  'engineering-manager/liderar-en-cambio',
  'engineering-manager/manager-multiplicador',
  'product-manager/priorizar-impacto-esfuerzo',
  'product-manager/stakeholders',
  'software-architect/trade-offs',
  'devops/incidentes',
  'ai-engineer/como-funciona-llm',
  'ai-engineer/limites-modelos',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'engineering-manager',
  roleName: 'Engineering Manager',
  tiers: {
    peritus: {
      name: 'Engineering Manager · Grumete',
      description:
        'Ejecuta con autonomía: suelta el teclado, gestiona tu tiempo, sostiene 1:1s ' +
        'y feedback que funcionan, delega de verdad y mantiene el foco del equipo.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Engineering Manager · Corsario',
      description:
        'Decide y anticipa: seguridad psicológica, dinámicas y burnout, marcos de ' +
        'carrera y conversaciones difíciles, delivery medido sin Goodhart y gestión ' +
        'hacia arriba, priorizando con criterio de producto.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Engineering Manager · Capitán',
      description:
        'Transforma: contrata, hace onboarding y diseña el equipo, lidera equipos ' +
        'aumentados por IA midiendo su impacto real, y cruza a arquitectura, ' +
        'incidentes y límites de los modelos para decidir con fundamento.',
      stops: MAGISTER_STOPS,
    },
  },
});
