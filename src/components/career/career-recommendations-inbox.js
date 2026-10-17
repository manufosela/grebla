/**
 * <career-recommendations-inbox> — lo que tu manager te recomienda para tu mapa
 * (RMR-TSK-0741), en Mi espacio › Carrera › Mapa. Tu plan es tuyo: cada
 * recomendación la añades a tu ruta o la descartas. Emite `route-changed` con la
 * ruta nueva al aceptar, para que el resumen del mapa se ponga al día.
 *
 * Props: person, journey.
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { listRecommendations, decideRecommendationFor } from '../../lib/careerRecommendations.js';
import { openRecommendations, applyToRoute } from '../../tools/career/domain/recommendations.js';

export class CareerRecommendationsInbox extends LitElement {
  static properties = {
    person: { attribute: false },
    journey: { attribute: false },
    _open: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .box { border: 1px solid var(--rm-accent, #2a9d8f); border-radius: 12px; padding: 0.8rem 1rem; margin: 0 0 1.2rem;
      background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 8%, var(--rm-surface, #fff)); }
    h4 { margin: 0 0 0.5rem; color: var(--rm-text, #111827); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
    li { font-size: 0.9rem; color: var(--rm-text, #111827); }
    .meta { color: var(--rm-muted, #4b5563); font-size: 0.8rem; }
    .row { display: flex; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap; }
    button { font: inherit; font-weight: 600; font-size: 0.85rem; border-radius: 8px; padding: 0.35rem 0.8rem; cursor: pointer;
      border: 1px solid var(--rm-border, #cbd5e1); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    button.primary { border-color: var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    Object.assign(this, { _open: [], _busy: false, _error: '' });
  }

  updated(changed) {
    if (changed.has('person') && this.person?.id) this._load();
  }

  async _load() {
    const personId = this.person.id;
    try {
      const all = await listRecommendations(personId);
      if (personId === this.person?.id) this._open = openRecommendations(all);
    } catch (err) {
      this._error = `No se pudieron cargar tus recomendaciones: ${err.message}`;
    }
  }

  render() {
    if (!this._open.length && !this._error) return null;
    return html`<section class="box" aria-label="Recomendado por tu manager">
      <h4>Recomendado por tu manager</h4>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      <ul>${this._open.map((r) => html`<li>
        <strong>${r.label}</strong> · ${r.kind === 'route' ? 'ruta de ' + r.cityIds.length + ' casas' : 'casa'}
        ${r.note ? html`<div>${r.note}</div>` : null}
        <div class="meta">Te lo recomienda ${r.by?.name} · ${r.at?.slice(0, 10)}</div>
        <div class="row">
          <button class="primary" type="button" ?disabled=${this._busy} @click=${() => this._decide(r, 'accepted')}>Añadir a mi ruta</button>
          <button type="button" ?disabled=${this._busy} @click=${() => this._decide(r, 'dismissed')}>Descartar</button>
        </div>
      </li>`)}</ul>
      ${this._busy ? html`<busy-overlay message="Guardando…"></busy-overlay>` : null}
    </section>`;
  }

  async _decide(rec, decision) {
    Object.assign(this, { _busy: true, _error: '' });
    try {
      // Guarda la decisión y, al aceptar, la ruta nueva en el journey: las dos en
      // la misma transacción (src/lib/careerRecommendations.js). Aquí solo se avisa
      // a la vista con la misma cuenta, para no releer el journey entero.
      await decideRecommendationFor(this.person.id, rec, decision);
      if (decision === 'accepted') {
        const plannedRoute = applyToRoute(this.journey?.plannedRoute, rec);
        this.dispatchEvent(new CustomEvent('route-changed', { detail: { plannedRoute }, bubbles: true, composed: true }));
      }
      await this._load();
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = false;
    }
  }
}

if (!customElements.get('career-recommendations-inbox')) customElements.define('career-recommendations-inbox', CareerRecommendationsInbox);
