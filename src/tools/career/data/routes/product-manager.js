/**
 * Itinerario del rol Product Manager (JG-15): del discovery al PM de la era
 * IA. Convención de rutas: cabecera de ./backend-php.js.
 *
 * Las Bases entran por la parte no-código: pensar y verificar con IA,
 * búsqueda efectiva y los mínimos técnicos para hablar con ingeniería
 * (HTTP/APIs y JSON); comunicación asíncrona y estimación llegan en el
 * Veteranus.
 */

/** Paradas del hito Peritus (14): descubrir, priorizar y medir con
 * autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/busqueda-efectiva',
  'bases/http-apis',
  'bases/json-datos',
  'product-manager/rol-del-pm',
  'product-manager/pensamiento-de-producto',
  'product-manager/conocer-el-negocio',
  'product-manager/entrevistas-usuarios',
  'product-manager/hipotesis-experimentos',
  'product-manager/priorizar-impacto-esfuerzo',
  'product-manager/roadmaps',
  'product-manager/metricas-activacion-retencion',
  'product-manager/trabajar-con-ingenieria',
]);

/** Paradas del hito Veteranus (25): discovery continuo, stakeholders y
 * lanzamientos, con prototipado IA propio y de frontend. */
const VETERANUS_STOPS = Object.freeze([
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/busqueda-efectiva',
  'bases/http-apis',
  'bases/json-datos',
  'bases/comunicacion-async',
  'bases/estimacion',
  'product-manager/rol-del-pm',
  'product-manager/pensamiento-de-producto',
  'product-manager/conocer-el-negocio',
  'product-manager/entrevistas-usuarios',
  'product-manager/hipotesis-experimentos',
  'product-manager/continuous-discovery',
  'product-manager/prototipado',
  'product-manager/priorizar-impacto-esfuerzo',
  'product-manager/decir-que-no',
  'product-manager/roadmaps',
  'product-manager/metricas-activacion-retencion',
  'product-manager/stakeholders',
  'product-manager/trabajar-con-ingenieria',
  'product-manager/lanzamientos',
  'product-manager/prototipar-con-ia',
  'ai-engineer/como-funciona-llm',
  'ai-engineer/prompting',
  'frontend/prototipado-ia',
]);

/** Paradas del hito Magister (34): la isla completa (A/B, North Star,
 * feedback y datos con IA) más requisitos no funcionales, SLOs y métricas
 * sin Goodhart para hablar de tú a tú con ingeniería. */
const MAGISTER_STOPS = Object.freeze([
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/busqueda-efectiva',
  'bases/http-apis',
  'bases/json-datos',
  'bases/comunicacion-async',
  'bases/estimacion',
  'bases/profesional-ia',
  'product-manager/rol-del-pm',
  'product-manager/pensamiento-de-producto',
  'product-manager/conocer-el-negocio',
  'product-manager/entrevistas-usuarios',
  'product-manager/hipotesis-experimentos',
  'product-manager/continuous-discovery',
  'product-manager/prototipado',
  'product-manager/priorizar-impacto-esfuerzo',
  'product-manager/decir-que-no',
  'product-manager/roadmaps',
  'product-manager/metricas-activacion-retencion',
  'product-manager/ab-testing',
  'product-manager/north-star',
  'product-manager/stakeholders',
  'product-manager/trabajar-con-ingenieria',
  'product-manager/lanzamientos',
  'product-manager/prototipar-con-ia',
  'product-manager/sintetizar-feedback-ia',
  'product-manager/decidir-con-datos-ia',
  'product-manager/pm-era-ia',
  'ai-engineer/como-funciona-llm',
  'ai-engineer/prompting',
  'frontend/prototipado-ia',
  'software-architect/requisitos-no-funcionales',
  'devops/slos',
  'engineering-manager/metricas-sin-goodhart',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'product-manager',
  roleName: 'Product Manager',
  tiers: {
    peritus: {
      name: 'Product Manager · Grumete',
      description:
        'Ejecuta con autonomía: entrevistas con usuarios, hipótesis y experimentos, ' +
        'priorización por impacto, roadmaps honestos, métricas de activación y ' +
        'retención y trabajo fluido con ingeniería.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Product Manager · Corsario',
      description:
        'Decide y anticipa: discovery continuo, decir que no, stakeholders y ' +
        'lanzamientos completos, prototipando con IA (propio y con frontend) y ' +
        'entendiendo cómo funciona un LLM y su prompting.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Product Manager · Capitán',
      description:
        'Transforma: experimentación A/B, North Star y árbol de métricas, feedback y ' +
        'decisiones sintetizados con IA, y lenguaje común con ingeniería: atributos ' +
        'de calidad, SLOs y métricas sin efecto Goodhart.',
      stops: MAGISTER_STOPS,
    },
  },
});
