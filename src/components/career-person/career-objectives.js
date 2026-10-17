/**
 * Plantilla de los objetivos medibles (RMR-TSK-0752): la usan el bloque de
 * objetivos sueltos y cada expectativa del nivel actual (<career-levels>), para
 * que todos se lean igual. Un objetivo: título, cómo se mide, para cuándo y su
 * estado; cerrado, lo que se midió. Quien lleva a la persona lo cierra.
 */
import { html, css } from 'lit';
import { OBJECTIVE_STATUS } from '../../tools/career/domain/objectives.js';

const DAY = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDay = (day) => (typeof day === 'string' && !Number.isNaN(Date.parse(day)) ? DAY.format(new Date(day)) : '');

/**
 * @param {Array<import('../../tools/career/domain/objectives.js').Objective & { id: string }>} list
 * @param {{ canAssess?: boolean, onClose?: (objective: object) => void }} [opts]
 */
export function objectivesTemplate(list, { canAssess = false, onClose } = {}) {
  if (!list?.length) return null;
  return html`<ul class="objectives">${list.map((o) => html`<li class="objective ${o.status}">
    <div class="ohead"><span class="otitle">🎯 ${o.title}</span>
      <span class="ostatus ${o.status}">${OBJECTIVE_STATUS[o.status] ?? o.status}</span></div>
    <p class="omeasure"><strong>Cómo se mide:</strong> ${o.measure}${o.dueDate ? html` · <strong>para</strong> ${formatDay(o.dueDate)}` : null}</p>
    ${o.status !== 'open' && o.closingNote ? html`<p class="omeasure"><strong>Resultado:</strong> ${o.closingNote}</p>` : null}
    ${canAssess && o.status === 'open' && onClose
      ? html`<button type="button" class="oclose" @click=${() => onClose(o)}>Cerrar objetivo</button>` : null}
  </li>`)}</ul>`;
}

export const objectivesStyles = css`
  .objectives { list-style: none; margin: 0.55rem 0 0; padding: 0; display: grid; gap: 0.45rem; }
  .objectives .objective { border: 1px solid #b45309; border-radius: 10px; padding: 0.5rem 0.7rem; background: #fffbeb; }
  .objectives .objective:not(.open) { border-color: var(--rm-border, #cbd5e1); background: var(--rm-surface, #fff); }
  .ohead { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; justify-content: space-between; }
  .otitle { font-weight: 700; font-size: 0.88rem; color: #3f2305; }
  .objective:not(.open) .otitle { color: var(--rm-text, #111827); }
  .ostatus { font-size: 0.75rem; font-weight: 700; border-radius: 999px; padding: 0.05rem 0.55rem; border: 1px solid; }
  .ostatus.open { color: #5c2d06; background: #fef3c7; border-color: #b45309; }
  .ostatus.achieved { color: #0b5d52; background: #dff3ef; border-color: #2a9d8f; }
  .ostatus.missed { color: #8a1c1c; background: #fde8e8; border-color: #d96a6a; }
  .ostatus.dropped { color: #374151; background: #f3f4f6; border-color: #9ca3af; }
  .omeasure { margin: 0.25rem 0 0; font-size: 0.85rem; color: #1f2937; }
  .objective:not(.open) .omeasure { color: var(--rm-text, #111827); }
  .oclose { margin-top: 0.4rem; font: inherit; font-size: 0.8rem; font-weight: 600; border-radius: 8px; padding: 0.25rem 0.65rem;
    cursor: pointer; border: 1px solid #b45309; background: #fff; color: #5c2d06; }
  .oclose:focus-visible { outline: 2px solid #b45309; outline-offset: 2px; }
`;
