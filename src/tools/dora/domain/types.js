/**
 * Tipos del dominio DORA. La unidad de configuración es el repositorio a medir.
 * Las métricas (fases siguientes) son siempre de EQUIPO/agregadas, nunca por
 * persona. Equipos y gremios son catálogos "vivos": se escriben libres al asignar
 * un repo y se derivan como opciones de los repos ya configurados.
 *
 * @typedef {Object} DoraRepo
 * @property {string} id
 * @property {string} [ownerLeaderUid]  Líder dueño del repo (lo añadió). Ausente en repos legacy del superadmin.
 * @property {string} fullName   Identificador GitHub "owner/repo".
 * @property {string|null} [team] Equipo al que pertenece el repo.
 * @property {string[]} guilds    Gremios (cross-team) del repo.
 * @property {string} baseBranch  Rama base para lead time y, si la señal es "branch", la frecuencia.
 * @property {'branch'|'release'} deploySignal  Qué cuenta como despliegue (default "branch").
 * @property {string} startDate   ISO date desde la que medir.
 * @property {string} [createdAt]
 */

/**
 * Evento de despliegue REAL de un repo (subcolección /dora/{repoId}/deployments).
 * Es la base de la Frecuencia de despliegue real (y, más adelante, del Lead Time
 * a producción, CFR y MTTR). El modelo es AGNÓSTICO a la fuente: hoy se registra
 * a mano desde la tool DORA; en el futuro lo poblará una ingesta automática
 * (GitHub Deployments API / hook de CI). Las métricas son de equipo, nunca por
 * persona; `createdBy` solo identifica quién registró el evento en la app.
 *
 * @typedef {Object} Deployment
 * @property {string} id
 * @property {string} at            Marca de tiempo del despliegue (ISO 8601).
 * @property {string|null} [sha]    Commit desplegado (opcional).
 * @property {'production'} environment  Entorno; por ahora siempre 'production'.
 * @property {'success'|'failed'} status  Resultado del despliegue.
 * @property {string} [note]        Nota libre opcional.
 * @property {{ uid: string, name: string }} [createdBy]  Quién lo registró en la app.
 * @property {string} [createdAt]   Cuándo se registró (ISO 8601).
 */

/**
 * Incidente en producción de un repo (subcolección /dora/{repoId}/incidents).
 * Es la base del MTTR (Mean Time to Recovery, DORA D4): mide cuánto tarda el
 * servicio en recuperarse. ESPEJO del registro de despliegues (D1): mismo modelo
 * agnóstico a la fuente (hoy manual desde la tool DORA; en el futuro, ingesta
 * automática desde alertas/CI). Un incidente ABIERTO tiene `restoredAt: null`;
 * uno RESUELTO tiene `restoredAt` con la marca de restauración. Las métricas son
 * de equipo, nunca por persona; `createdBy` solo identifica quién lo registró.
 *
 * @typedef {Object} Incident
 * @property {string} id
 * @property {string} startedAt        Inicio del incidente / caída (ISO 8601).
 * @property {string|null} restoredAt  Restauración del servicio (ISO 8601) o null si sigue abierto.
 * @property {string} [note]           Nota libre opcional.
 * @property {string|null} [deploymentId]  Despliegue fallido que lo causó (D1), opcional.
 * @property {{ uid: string, name: string }} [createdBy]  Quién lo registró en la app.
 * @property {string} [createdAt]      Cuándo se registró (ISO 8601).
 */

/** Formato "owner/repo" (caracteres válidos de GitHub). */
const FULL_NAME_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/** @param {unknown} fullName */
export function isValidFullName(fullName) {
  return typeof fullName === 'string' && FULL_NAME_RE.test(fullName.trim());
}

export {};
