/**
 * Plantilla del historial de una expectativa (RMR-TSK-0714): la usan el nivel
 * actual (<career-levels>) y los superiores (<career-expectations>), para que
 * todo se lea igual. Una entrada: fecha · autor · tipo, y su texto con enlaces.
 */
import { html, css } from 'lit';

const ENTRY_LABEL = { meets: 'Llega', misses: 'No llega', proof: 'Prueba' };
/** Solo se enlaza lo que es http(s): lo escribe una persona. */
const isWebUrl = (url) => typeof url === 'string' && /^https?:\/\/\S+$/i.test(url);
const DAY = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDay = (iso) => (typeof iso === 'string' && !Number.isNaN(Date.parse(iso)) ? DAY.format(new Date(iso)) : '');

const metaOf = (e) => [formatDay(e.at), e.by?.name ?? '', ENTRY_LABEL[e.kind]].filter(Boolean).join(' · ');

/** @param {Array<{ kind: string, text: string, links?: Array<{ kind: string, url: string }>, by?: { name?: string }|null, at?: string|null }>} items */
export function timelineTemplate(items) {
  if (!items?.length) return null;
  return html`<ol class="timeline">${items.map((e) => html`<li class=${e.kind}>
    <span class="meta">${metaOf(e)}</span>
    <p>${e.text}${(e.links ?? []).filter((l) => isWebUrl(l.url)).map((l) => html` · <a href=${l.url}
      target="_blank" rel="noopener noreferrer">${String(l.kind).toUpperCase()}</a>`)}</p>
  </li>`)}</ol>`;
}

export const timelineStyles = css`
  .timeline { list-style: none; margin: 0.55rem 0 0; padding: 0 0 0 0.75rem; display: grid; gap: 0.45rem;
    border-left: 2px solid var(--rm-border, #cbd5e1); }
  .timeline li { border: 0; border-radius: 0; padding: 0; background: none; }
  .timeline .meta { font-size: 0.78rem; font-weight: 600; color: var(--rm-muted, #4b5563); }
  .timeline li.meets .meta { color: #0b5d52; }
  .timeline li.misses .meta { color: #8a1c1c; }
  .timeline p { margin: 0.1rem 0 0; font-size: 0.86rem; color: var(--rm-text, #111827); }
  .timeline a { color: var(--rm-accent-strong, #1d6f65); }
`;
