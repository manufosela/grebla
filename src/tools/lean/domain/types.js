/**
 * Tipos del dominio LEAN / Flow: métricas de cómo FLUYE el trabajo de un equipo,
 * a partir de las issues de Linear. JSDoc puro, sin Firebase. Complementa a DORA
 * (entrega) y es SIEMPRE de equipo, nunca por persona.
 *
 * @typedef {Object} LeanTeam   Equipo de Linear monitorizado (config, análogo al repo de DORA).
 * @property {string} id
 * @property {string} linearTeamKey   Key del equipo en Linear (p. ej. «ENG»).
 * @property {string} name            Nombre visible del equipo.
 * @property {string} [ownerLeaderUid]   Líder dueño (permisología multi-leader).
 * @property {string} createdAt       ISO de alta.
 * @property {FlowMetrics} [metrics]   Última métrica calculada por la Cloud Function.
 *
 * @typedef {Object} FlowIssue   Issue de Linear normalizada (lo mínimo para las métricas de flujo).
 * @property {string} id
 * @property {'backlog'|'unstarted'|'started'|'completed'|'canceled'} stateType   `state.type` de Linear.
 * @property {string} createdAt
 * @property {string|null} [startedAt]     Cuándo pasó a «en curso».
 * @property {string|null} [completedAt]   Cuándo se completó.
 * @property {string|null} [canceledAt]
 *
 * @typedef {Object} FlowMetrics   Métricas de flujo de un equipo en una ventana.
 * @property {number} completed              Issues completadas en la ventana.
 * @property {number} throughputPerWeek      Completadas por semana.
 * @property {number|null} cycleTimeP50Hours Cycle time (started→completed) percentil 50, en horas.
 * @property {number|null} cycleTimeP85Hours Cycle time percentil 85, en horas.
 * @property {number} wip                    Issues en curso ahora (`started`).
 * @property {number|null} agingDaysMax      Antigüedad máxima de un WIP, en días.
 * @property {number} agingDaysAvg           Antigüedad media de los WIP, en días.
 * @property {number|null} [flowEfficiencyPct]  Flow efficiency (% activo/total) — Fase 2.
 * @property {string} [periodFrom]           ISO inicio de la ventana.
 * @property {string} [periodTo]             ISO fin de la ventana.
 * @property {string} [computedAt]           ISO del cálculo.
 * @property {string} [error]                Mensaje si el refresh falló para este equipo.
 */
