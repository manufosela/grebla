/**
 * Editor de la ficha PROPIA (self-ficha, RMR-TSK-0251): un manager/superadmin que
 * es dueño de su ficha edita sus datos básicos —nombre, nivel y disciplinas— desde
 * «Mi espacio». Se muestra SOLO cuando el usuario es dueño de la ficha (regla
 * isOwner en Firestore); para un ingeniero normal la ficha la gestiona su manager,
 * así que este editor no aparece. Persiste con updateMyPersonBasics y emite
 * `ficha-updated` con la persona ya actualizada para que el contenedor refresque.
 */
import { LitElement, html, css } from 'lit';
import { updateMyPersonBasics } from '../lib/engineer.js';

export class MyFichaEditor extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    _open: { state: true },
    _name: { state: true },
    _levelId: { state: true },
    _disciplines: { state: true },
    _saving: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .card {
      background: var(--rm-surface);
      border: 1px solid var(--rm-border);
      border-left: 4px solid var(--rm-accent);
      border-radius: var(--rm-radius, 14px);
      padding: 1rem 1.25rem;
      margin: 0 0 1.25rem;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .head h3 { margin: 0; font-size: 1.05rem; color: var(--rm-text); }
    .head p { margin: 0.15rem 0 0; color: var(--rm-muted); font-size: 0.85rem; }
    .toggle {
      border: 1px solid var(--rm-border); background: var(--rm-surface);
      color: var(--rm-accent); border-radius: 999px; padding: 0.35rem 0.9rem;
      font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .toggle:hover { border-color: var(--rm-accent); }
    form { display: grid; gap: 0.9rem; margin-top: 0.9rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--rm-text); margin-bottom: 0.3rem; }
    input[type='text'], select {
      width: 100%; padding: 0.5rem 0.6rem; font: inherit;
      border: 1px solid var(--rm-border); border-radius: 8px;
      background: var(--rm-surface); color: var(--rm-text);
    }
    input:focus-visible, select:focus-visible { outline: 2px solid var(--rm-accent); outline-offset: 1px; }
    .disciplines { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      display: inline-flex; align-items: center; gap: 0.35rem;
      border: 1px solid var(--rm-border); border-radius: 999px;
      padding: 0.3rem 0.7rem; font-size: 0.85rem; cursor: pointer; user-select: none;
      background: var(--rm-surface); color: var(--rm-muted);
    }
    .chip.on { background: var(--rm-accent); color: var(--rm-on-accent, #fff); border-color: var(--rm-accent); }
    .chip input { position: absolute; opacity: 0; pointer-events: none; }
    .actions { display: flex; gap: 0.6rem; align-items: center; }
    .save {
      border: 0; background: var(--rm-accent); color: var(--rm-on-accent, #fff);
      border-radius: 999px; padding: 0.5rem 1.1rem; font: inherit; font-weight: 700; cursor: pointer;
    }
    .save:disabled { opacity: 0.6; cursor: wait; }
    .cancel {
      border: 1px solid var(--rm-border); background: var(--rm-surface); color: var(--rm-muted);
      border-radius: 999px; padding: 0.5rem 1rem; font: inherit; font-weight: 600; cursor: pointer;
    }
    .error { color: var(--rm-danger); font-size: 0.85rem; margin: 0; }
  `;

  constructor() {
    super();
    this.person = null;
    this.framework = null;
    this._open = false;
    this._name = '';
    this._levelId = '';
    this._disciplines = [];
    this._saving = false;
    this._error = '';
  }

  _startEdit() {
    const p = this.person ?? {};
    this._name = p.name ?? '';
    this._levelId = p.levelId ?? '';
    this._disciplines = [...(p.disciplines ?? [])];
    this._error = '';
    this._open = true;
  }

  _toggleDiscipline(id) {
    this._disciplines = this._disciplines.includes(id)
      ? this._disciplines.filter((d) => d !== id)
      : [...this._disciplines, id];
  }

  async _save(event) {
    event.preventDefault();
    if (!this.person?.id) return;
    this._saving = true;
    this._error = '';
    try {
      const basics = { name: this._name, levelId: this._levelId || null, disciplines: this._disciplines };
      await updateMyPersonBasics(this.person.id, basics);
      const updated = { ...this.person, name: this._name.trim() || 'Mi ficha', levelId: basics.levelId, disciplines: this._disciplines };
      this.dispatchEvent(new CustomEvent('ficha-updated', { detail: updated, bubbles: true, composed: true }));
      this._open = false;
    } catch {
      this._error = 'No se pudo guardar tu ficha. Vuelve a intentarlo en unos minutos.';
    } finally {
      this._saving = false;
    }
  }

  _renderForm() {
    const levels = this.framework?.levels ?? [];
    const disciplines = this.framework?.disciplines ?? [];
    return html`
      <form @submit=${this._save}>
        <div>
          <label for="ficha-name">Nombre</label>
          <input id="ficha-name" type="text" .value=${this._name}
            @input=${(e) => { this._name = e.target.value; }} placeholder="Tu nombre" />
        </div>
        <div>
          <label for="ficha-level">Nivel</label>
          <select id="ficha-level" .value=${this._levelId}
            @change=${(e) => { this._levelId = e.target.value; }}>
            <option value="">Sin nivel</option>
            ${levels.map((l) => html`<option value=${l.id} ?selected=${l.id === this._levelId}>${l.code} — ${l.title}</option>`)}
          </select>
        </div>
        <div>
          <label>Disciplinas</label>
          <div class="disciplines">
            ${disciplines.map((d) => {
              const on = this._disciplines.includes(d.id);
              return html`<label class=${on ? 'chip on' : 'chip'}>
                <input type="checkbox" ?checked=${on} @change=${() => this._toggleDiscipline(d.id)} />${d.name}
              </label>`;
            })}
          </div>
        </div>
        ${this._error ? html`<p class="error">${this._error}</p>` : null}
        <div class="actions">
          <button class="save" type="submit" ?disabled=${this._saving}>${this._saving ? 'Guardando…' : 'Guardar ficha'}</button>
          <button class="cancel" type="button" @click=${() => { this._open = false; }}>Cancelar</button>
        </div>
      </form>
    `;
  }

  render() {
    if (!this.person) return null;
    return html`
      <div class="card">
        <div class="head">
          <div>
            <h3>Mi ficha</h3>
            <p>Es tu propia ficha: rellena tu nombre, nivel y disciplinas. Role Mirror y el mapa los editas en sus pestañas.</p>
          </div>
          ${this._open ? null : html`<button class="toggle" type="button" @click=${this._startEdit}>✏️ Editar mi ficha</button>`}
        </div>
        ${this._open ? this._renderForm() : null}
      </div>
    `;
  }
}

customElements.define('my-ficha-editor', MyFichaEditor);
