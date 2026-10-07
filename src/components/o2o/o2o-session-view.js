/**
 * <o2o-session-view> — un O2O hecho, para leerlo sin editarlo (RMR-TSK-0648):
 * lo que es solo del manager (notas y resumen privados), separado de lo que ve
 * la persona (el resumen compartido, y si de verdad lo ve). Lo usan «Registrar
 * O2O» y el «Resumen» del periodo.
 *
 * Props: session, personName.
 */
import { LitElement, html, css } from 'lit';

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/** Lo privado y lo compartido de una sesión, sin los campos vacíos. Puro. */
export function sessionParts(session) {
  const priv = [['Notas privadas', session?.privateNotes], ['Resumen privado', session?.summary]]
    .map(([label, text]) => ({ label, text: clean(text) }))
    .filter((p) => p.text);
  return { private: priv, shared: { text: clean(session?.sharedSummary), visible: session?.sharedWithPerson === true } };
}

export class O2OSessionView extends LitElement {
  static properties = {
    session: { attribute: false },
    personName: { attribute: false },
  };

  static styles = css`
    :host { display: block; }
    .part { border-radius: 9px; padding: 0.6rem 0.8rem; margin: 0.5rem 0; }
    .mine { background: var(--rm-surface-hover, #eef3f5); }
    .theirs { border: 1px solid var(--rm-border, #dde7ec); }
    h4 { margin: 0 0 0.35rem; font-size: 0.78rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rm-muted, #5b6b7d); }
    .label { font-weight: 700; font-size: 0.82rem; margin: 0.4rem 0 0.1rem; }
    .text { white-space: pre-wrap; margin: 0; font-size: 0.9rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; margin: 0; }
  `;

  render() {
    const { private: mine, shared } = sessionParts(this.session);
    const who = this.personName || 'la persona';
    let theirs = html`<p class="empty">No hay resumen para ${who}.</p>`;
    if (shared.text && shared.visible) theirs = html`<p class="text">${shared.text}</p>`;
    else if (shared.text) theirs = html`<p class="empty">Hay resumen, pero no está marcado como visible: ${who} no lo ve.</p><p class="text">${shared.text}</p>`;
    return html`
      <div class="part mine">
        <h4>Solo tú</h4>
        ${mine.length ? mine.map((p) => html`<p class="label">${p.label}</p><p class="text">${p.text}</p>`) : html`<p class="empty">Sin notas privadas.</p>`}
      </div>
      <div class="part theirs">
        <h4>Lo que ve ${who}</h4>
        ${theirs}
      </div>`;
  }
}

if (!customElements.get('o2o-session-view')) customElements.define('o2o-session-view', O2OSessionView);
