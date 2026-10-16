/**
 * <career-recommend> — el manager recomienda desde la ficha › Carrera › Mapa
 * (RMR-TSK-0739): una ruta prehecha o una casa de su isla, con una nota. Ve las
 * que ha hecho y en qué quedaron; las suyas abiertas las puede retirar. Decide
 * la persona, en Mi espacio: aquí no se toca su ruta.
 *
 * Props: person, island (para las casas), viewer ({ uid, name }).
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { listCareerRoutes } from '../../lib/careerMap.js';
import { listRecommendations, recommend, withdrawRecommendation } from '../../lib/careerRecommendations.js';

const STATUS = { open: 'Pendiente de que decida', accepted: 'La añadió a su ruta', dismissed: 'La descartó' };

export class CareerRecommend extends LitElement {
  static properties = {
    person: { attribute: false },
    island: { attribute: false },
    viewer: { attribute: false },
    _routes: { state: true },
    _recos: { state: true },
    _kind: { state: true },
    _target: { state: true },
    _note: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; margin-top: 1.4rem; }
    h4 { margin: 0 0 0.5rem; color: var(--rm-text, #111827); }
    form { display: grid; gap: 0.55rem; max-width: 38rem; }
    label { display: grid; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #111827); }
    select, textarea { font: inherit; font-weight: 400; border: 1px solid var(--rm-border, #cbd5e1); border-radius: 8px;
      padding: 0.4rem 0.55rem; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .kinds { display: flex; gap: 1rem; font-size: 0.88rem; }
    button { justify-self: start; font: inherit; font-weight: 600; font-size: 0.85rem; border-radius: 8px; padding: 0.4rem 0.9rem;
      cursor: pointer; border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button.ghost { background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-color: var(--rm-border, #cbd5e1); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    ul { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
    li { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.55rem 0.8rem; font-size: 0.88rem; }
    .meta { color: var(--rm-muted, #4b5563); font-size: 0.8rem; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    Object.assign(this, { _routes: [], _recos: [], _kind: 'route', _target: '', _note: '', _busy: false, _error: '' });
  }

  updated(changed) {
    if (changed.has('person') && this.person?.id) this._load();
  }

  async _load() {
    const personId = this.person.id;
    try {
      const [routes, recos] = await Promise.all([listCareerRoutes(), listRecommendations(personId)]);
      if (personId !== this.person?.id) return;
      Object.assign(this, { _routes: routes, _recos: recos.toSorted((a, b) => b.at.localeCompare(a.at)), _error: '' });
    } catch (err) {
      this._error = `No se pudieron cargar las recomendaciones: ${err.message}`;
    }
  }

  render() {
    const name = this.person?.name ?? 'la persona';
    return html`
      <h4>Recomendar a ${name}</h4>
      <form @submit=${this._submit}>
        <div class="kinds" role="radiogroup" aria-label="Qué recomiendas">
          ${[['route', 'Una ruta prehecha'], ['city', 'Una casa']].map(([k, label]) => html`<label class="kind">
            <input type="radio" name="kind" .checked=${this._kind === k} @change=${() => { this._kind = k; this._target = ''; }} /> ${label}</label>`)}
        </div>
        <label>${this._kind === 'route' ? 'Ruta' : 'Casa'}
          <select @change=${(e) => { this._target = e.target.value; }}>
            <option value="" ?selected=${!this._target}>— Elige —</option>
            ${this._options().map((o) => html`<option value=${o.id} ?selected=${o.id === this._target}>${o.label}</option>`)}
          </select>
        </label>
        <label>Nota (por qué se la recomiendas)
          <textarea rows="2" maxlength="500" .value=${this._note} @input=${(e) => { this._note = e.target.value; }}></textarea>
        </label>
        <button type="submit" ?disabled=${this._busy || !this._target}>Recomendar</button>
        ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      </form>
      ${this._recos.length ? html`<ul>${this._recos.map((r) => this._item(r))}</ul>` : null}
      ${this._busy ? html`<busy-overlay message="Guardando…"></busy-overlay>` : null}`;
  }

  _options() {
    if (this._kind === 'route') return this._routes.map((r) => ({ id: r.routeId, label: r.name, cityIds: r.stops }));
    return (this.island?.cities ?? []).map((c) => ({ id: c.id, label: c.name, cityIds: [c.id] }));
  }

  _item(r) {
    const mine = r.by?.uid === this.viewer?.uid && r.status === 'open';
    return html`<li><strong>${r.label}</strong> · ${STATUS[r.status] ?? r.status}
      ${r.note ? html`<div>${r.note}</div>` : null}
      <div class="meta">${r.by?.name} · ${r.at?.slice(0, 10)}</div>
      ${mine ? html`<button class="ghost" type="button" @click=${() => this._run(() => withdrawRecommendation(this.person.id, r.id))}>Retirar</button>` : null}
    </li>`;
  }

  _submit(e) {
    e.preventDefault();
    const option = this._options().find((o) => o.id === this._target);
    if (!option) return;
    const input = { kind: this._kind, routeId: this._kind === 'route' ? option.id : null, cityIds: option.cityIds,
      label: option.label, note: this._note, by: this.viewer };
    this._run(async () => {
      await recommend(this.person.id, input);
      Object.assign(this, { _target: '', _note: '' });
    });
  }

  async _run(write) {
    Object.assign(this, { _busy: true, _error: '' });
    try {
      await write();
      await this._load();
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = false;
    }
  }
}

if (!customElements.get('career-recommend')) customElements.define('career-recommend', CareerRecommend);
