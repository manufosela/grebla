/**
 * Badge reutilizable de nivel DORA (Elite/Alto/Medio/Bajo) y sus estilos, para
 * <dora-repos> y <dora-metrics>. La clasificación vive en el dominio (levels.js).
 */
import { html, css } from 'lit';
import { levelLabel } from '../../tools/dora/domain/levels.js';

/** Devuelve el badge de un nivel, o null si no hay nivel (métrica sin dato). */
export function levelBadge(level) {
  return level ? html`<span class="lvl lvl-${level}" title="Nivel DORA">${levelLabel(level)}</span>` : null;
}

/** Estilos del badge; añadir al array `static styles` del componente. */
export const levelStyles = css`
  .lvl { display: inline-block; margin-left: 0.4rem; padding: 0.03rem 0.45rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700; vertical-align: middle; white-space: nowrap; }
  .lvl-elite { background: var(--rm-success, #16a34a); color: #fff; }
  .lvl-high { background: var(--rm-accent, #2a9d8f); color: #fff; }
  .lvl-medium { background: var(--rm-warning, #f2887a); color: #fff; }
  .lvl-low { background: var(--rm-danger, #dc2626); color: #fff; }
`;
