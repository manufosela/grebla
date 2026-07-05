/**
 * Itinerario del rol DevOps (JG-15): de Linux y Docker a la plataforma
 * fiable en producción. Convención de rutas: cabecera de ./backend-php.js.
 *
 * La seguridad básica entra ya en el Peritus (a diferencia de otros roles):
 * quien opera infraestructura toca secretos y superficies expuestas desde
 * el primer día.
 */

/** Paradas del hito Peritus (13): operar sistemas y contenedores con
 * autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/terminal',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/seguridad-basica',
  'devops/linux',
  'devops/shell-scripting',
  'devops/redes',
  'devops/docker',
  'devops/ci',
  'devops/cloud',
]);

/** Paradas del hito Veteranus (22): Kubernetes, IaC, secretos y la primera
 * capa de observabilidad, con backups de datos como cruce imprescindible. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/terminal',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/seguridad-basica',
  'bases/code-review',
  'devops/linux',
  'devops/shell-scripting',
  'devops/redes',
  'devops/docker',
  'devops/kubernetes',
  'devops/ci',
  'devops/cd-estrategias',
  'devops/cloud',
  'devops/terraform',
  'devops/secretos',
  'devops/logs',
  'devops/metricas',
  'devops/alertas',
  'postgres/backups-recuperacion',
]);

/** Paradas del hito Magister (36): la isla casi completa (GitOps, Helm,
 * SLOs, incidentes, FinOps, IA en infra y operaciones) más platform
 * engineering, observabilidad de arquitecto y un servicio en producción
 * visto desde el lado del backend. */
const MAGISTER_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/terminal',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/seguridad-basica',
  'bases/code-review',
  'bases/profesional-ia',
  'devops/linux',
  'devops/shell-scripting',
  'devops/redes',
  'devops/docker',
  'devops/registro-artefactos',
  'devops/kubernetes',
  'devops/helm',
  'devops/ci',
  'devops/cd-estrategias',
  'devops/gitops',
  'devops/cloud',
  'devops/terraform',
  'devops/secretos',
  'devops/logs',
  'devops/metricas',
  'devops/trazas',
  'devops/alertas',
  'devops/slos',
  'devops/incidentes',
  'devops/finops',
  'devops/plataforma-fiable',
  'devops/ia-infra',
  'devops/ia-operaciones',
  'postgres/backups-recuperacion',
  'backend-python/servicio-produccion',
  'software-architect/platform-engineering',
  'software-architect/observabilidad',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'devops',
  roleName: 'DevOps',
  tiers: {
    peritus: {
      name: 'DevOps · Grumete',
      description:
        'Ejecuta con autonomía: Linux, shell y redes, contenedores con Docker, un ' +
        'pipeline de CI y un proveedor cloud, con la seguridad básica desde el inicio.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'DevOps · Corsario',
      description:
        'Decide y anticipa: Kubernetes, estrategias de despliegue, Terraform y ' +
        'secretos, logs, métricas y alertas accionables, y backups de datos que ' +
        'sabes restaurar.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'DevOps · Capitán',
      description:
        'Transforma: GitOps y Helm, SLOs, incidentes y FinOps hasta una plataforma ' +
        'fiable, IA aplicada a infra y operaciones, y visión de platform engineering ' +
        'y observabilidad compartida con arquitectura y backend.',
      stops: MAGISTER_STOPS,
    },
  },
});
