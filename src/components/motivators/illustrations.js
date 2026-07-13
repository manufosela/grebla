/**
 * Ilustraciones ORIGINALES (glifos SVG propios) para las cartas de motivadores.
 * NO se usan las oficiales de Management 3.0. Son iconos de línea simples, pensados
 * para iterar el arte más adelante; heredan `currentColor` (contraste por token).
 * Mapa cartaId → template SVG. `illustrationFor(id)` devuelve el glifo o uno genérico.
 */
import { svg } from 'lit';

const DEFAULT = svg`<circle cx="24" cy="24" r="9" />`;

/** @type {Record<string, import('lit').SVGTemplateResult>} */
const GLYPHS = {
  // ── Moving Motivators ──────────────────────────────────────────────
  curiosity: svg`<circle cx="20" cy="20" r="10" /><line x1="27" y1="27" x2="38" y2="38" /><path d="M17 18a3 3 0 1 1 4 3c-1 .7-1 1.3-1 2.2" /><circle cx="20" cy="27" r="0.6" />`,
  honor: svg`<path d="M24 6l14 5v9c0 9-6 15-14 18-8-3-14-9-14-18v-9z" /><path d="M18 23l4 4 8-9" />`,
  acceptance: svg`<path d="M24 40S8 30 8 18a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 12-16 22-16 22z" />`,
  mastery: svg`<path d="M8 40h32" /><path d="M14 40V22l10-12 10 12v18" /><path d="M24 10v-4" /><path d="M24 6l6 3-6 3z" />`,
  power: svg`<path d="M26 6L12 26h10l-4 16 18-22H24z" />`,
  freedom: svg`<path d="M6 30l36-16-14 30-6-12z" /><path d="M22 32l6-6" />`,
  relatedness: svg`<circle cx="16" cy="17" r="5" /><circle cx="32" cy="17" r="5" /><path d="M8 38c0-6 4-9 8-9s8 3 8 9" /><path d="M24 38c0-6 4-9 8-9s8 3 8 9" />`,
  order: svg`<rect x="8" y="10" width="7" height="7" /><rect x="8" y="21" width="7" height="7" /><rect x="8" y="32" width="7" height="7" /><line x1="20" y1="13" x2="40" y2="13" /><line x1="20" y1="24" x2="40" y2="24" /><line x1="20" y1="35" x2="40" y2="35" />`,
  goal: svg`<circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="9" /><circle cx="24" cy="24" r="2.2" />`,
  status: svg`<circle cx="24" cy="18" r="10" /><path d="M18 26l-3 16 9-5 9 5-3-16" /><path d="M24 13l2.2 4.2 4.6.5-3.4 3.1.9 4.6-4.3-2.3-4.3 2.3.9-4.6-3.4-3.1 4.6-.5z" />`,
  // ── Affective Motivators ───────────────────────────────────────────
  listening: svg`<path d="M16 24a8 8 0 1 1 16 0c0 5-4 6-4 10a4 4 0 0 1-8 0" /><path d="M20 22a4 4 0 0 1 8 0" />`,
  trust: svg`<circle cx="18" cy="24" r="8" /><circle cx="30" cy="24" r="8" />`,
  authenticity: svg`<circle cx="24" cy="24" r="16" /><circle cx="18" cy="21" r="1.4" /><circle cx="30" cy="21" r="1.4" /><path d="M17 29c2 3 12 3 14 0" />`,
  psychological_safety: svg`<path d="M8 24a16 12 0 0 1 32 0z" /><line x1="24" y1="24" x2="24" y2="38" /><path d="M24 38a4 4 0 0 0 6 0" />`,
  accompanied_vulnerability: svg`<path d="M24 30s-8-5-8-11a5 5 0 0 1 8-2 5 5 0 0 1 8 2c0 6-8 11-8 11z" /><path d="M8 34c3 4 8 6 16 6s13-2 16-6" />`,
  holistic_care: svg`<path d="M24 40S8 30 8 18a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 12-16 22-16 22z" /><path d="M14 22h6l2-4 3 8 2-4h7" />`,
  belonging: svg`<circle cx="24" cy="12" r="4" /><circle cx="12" cy="32" r="4" /><circle cx="36" cy="32" r="4" /><path d="M24 16l-9 13M24 16l9 13M15 33h18" />`,
  growth_support: svg`<path d="M24 40V20" /><path d="M24 24c-2-6-8-7-12-6 0 6 5 9 12 8z" /><path d="M24 20c2-5 7-6 11-5 0 5-5 8-11 7z" />`,
  mutual_commitment: svg`<path d="M12 20a12 12 0 0 1 24 0" /><path d="M36 16v6h-6" /><path d="M36 28a12 12 0 0 1-24 0" /><path d="M12 32v-6h6" />`,
  closeness: svg`<circle cx="19" cy="24" r="9" /><circle cx="29" cy="24" r="9" />`,
};

/** @param {string} id @returns {import('lit').SVGTemplateResult} */
export function illustrationFor(id) {
  return GLYPHS[id] ?? DEFAULT;
}
