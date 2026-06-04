/**
 * Fases / tamaños de organización.
 *
 * Cada fase define multiplicadores de peso por rol que ajustan el scoring:
 * el mismo ítem pesa distinto según el contexto de empresa (p. ej. un HoE en
 * una startup seed hace más hands-on que en una enterprise). El admin elige la
 * fase activa en /config/org y el cuestionario la aplica.
 *
 * @typedef {import('./roles.js').RoleKey} RoleKey
 *
 * @typedef {Object} OrgPhase
 * @property {string} key
 * @property {string} label
 * @property {string} description
 * @property {Partial<Record<RoleKey, number>>} roleMultipliers
 */

/** @type {ReadonlyArray<OrgPhase>} */
export const ORG_PHASES = [
  {
    key: 'seed',
    label: 'Startup (Seed)',
    description: 'Equipo pequeño, roles poco diferenciados, mucho hands-on.',
    roleMultipliers: { engineer: 1, techLead: 1.1, staff: 1, em: 0.9, hoe: 0.9, vp: 0.8, cto: 1.1 },
  },
  {
    key: 'seriesAB',
    label: 'Series A/B',
    description: 'Empieza la especialización de roles y los primeros managers.',
    roleMultipliers: { engineer: 1, techLead: 1, staff: 1, em: 1, hoe: 1, vp: 0.95, cto: 1 },
  },
  {
    key: 'scaleup',
    label: 'Scale-up',
    description: 'Crecimiento rápido: managers, staff y procesos cobran peso.',
    roleMultipliers: { engineer: 1, techLead: 1, staff: 1.05, em: 1.1, hoe: 1.1, vp: 1.05, cto: 1 },
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    description: 'Organización madura: liderazgo y estructura muy diferenciados.',
    roleMultipliers: { engineer: 0.95, techLead: 1, staff: 1.05, em: 1, hoe: 1.15, vp: 1.2, cto: 1.1 },
  },
];

/** @type {Readonly<Record<string, OrgPhase>>} */
export const ORG_PHASE_BY_KEY = Object.freeze(
  Object.fromEntries(ORG_PHASES.map((phase) => [phase.key, phase])),
);

/** Fase por defecto cuando /config/org aún no está configurado. */
export const DEFAULT_ORG_PHASE = 'seriesAB';
