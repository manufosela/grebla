/**
 * <team-people>
 * Sección de personas: lista de personas activas, alta (nombre, rol funcional,
 * fecha de inicio) y baja (active=false, sin borrar histórico). Usa los casos de
 * uso de la capa de aplicación; nunca toca persistencia ni dominio directamente.
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 */
import { LitElement, html, css } from 'lit';
import { addPerson, listActivePeople, deactivatePerson } from '../../tools/team/application/usecases/index.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** @param {string} iso */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export class TeamPeople extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { state: true },
    loading: { state: true },
    error: { state: true },
    _name: { state: true },
    _teamRole: { state: true },
    _startDate: { state: true },
    _confirmOff: { state: true },
  };

  static styles = css`
    :host { display: block; }
    section {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.05rem; margin: 0 0 1rem; }
    form { display: grid; grid-template-columns: 2fr 2fr 1.3fr auto; gap: 0.75rem; align-items: end; }
    @media (max-width: 640px) { form { grid-template-columns: 1fr; } }
    label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    input {
      padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem;
    }
    button {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827); border-radius: 8px; padding: 0.5rem 0.9rem;
      font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    td.actions { text-align: right; }
    .off-btn {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-danger, #dc2626); border-radius: 6px; padding: 0.25rem 0.6rem;
      font-size: 0.78rem; font-weight: 600; cursor: pointer;
    }
    .confirm { font-size: 0.78rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }
    .confirm button { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.78rem; padding: 0 0.25rem; }
    .confirm .yes { color: var(--rm-danger, #dc2626); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; margin: 0.5rem 0 0; }
  `;

  constructor() {
    super();
    /** @type {import('../../tools/team/domain/ports.js').PersistencePort|null} */
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person[]} */
    this.people = [];
    this.loading = true;
    this.error = '';
    this._name = '';
    this._teamRole = '';
    this._startDate = '';
    /** @type {string|null} */
    this._confirmOff = null;
    this._loaded = false;
  }

  updated() {
    if (this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      this.people = await listActivePeople(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar las personas.';
    } finally {
      this.loading = false;
    }
  }

  async _add(event) {
    event.preventDefault();
    const name = this._name.trim();
    if (!name) {
      this.error = 'El nombre es obligatorio.';
      return;
    }
    this.error = '';
    try {
      await addPerson(this.persistence, {
        name,
        teamRole: this._teamRole.trim(),
        startDate: this._startDate || new Date().toISOString().slice(0, 10),
      });
      this._name = '';
      this._teamRole = '';
      this._startDate = '';
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo crear la persona.';
    }
  }

  async _deactivate(id) {
    this._confirmOff = null;
    this.error = '';
    try {
      await deactivatePerson(this.persistence, id);
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo dar de baja.';
    }
  }

  _renderActions(person) {
    if (this._confirmOff === person.id) {
      return html`<span class="confirm">¿Dar de baja?
        <button class="yes" @click=${() => this._deactivate(person.id)}>Sí</button>
        <button @click=${() => { this._confirmOff = null; }}>No</button>
      </span>`;
    }
    return html`<button class="off-btn" @click=${() => { this._confirmOff = person.id; }}>Dar de baja</button>`;
  }

  render() {
    return html`
      <section>
        <h2>Añadir persona</h2>
        <form @submit=${this._add}>
          <label>Nombre
            <input type="text" .value=${this._name} @input=${(e) => { this._name = e.target.value; }} required />
          </label>
          <label>Rol en el equipo
            <input type="text" placeholder="p. ej. Backend" .value=${this._teamRole} @input=${(e) => { this._teamRole = e.target.value; }} />
          </label>
          <label>Fecha de inicio
            <input type="date" .value=${this._startDate} @input=${(e) => { this._startDate = e.target.value; }} />
          </label>
          <button class="primary" type="submit">Añadir</button>
        </form>
        ${this.error ? html`<p class="error">${this.error}</p>` : null}
      </section>

      <section>
        <h2>Personas activas (${this.people.length})</h2>
        ${this.loading
          ? html`<p class="empty">Cargando…</p>`
          : this.people.length === 0
            ? html`<p class="empty">Aún no has añadido a nadie. Empieza con el formulario de arriba.</p>`
            : html`
                <table>
                  <thead>
                    <tr><th>Nombre</th><th>Rol</th><th>Desde</th><th></th></tr>
                  </thead>
                  <tbody>
                    ${this.people.map(
                      (p) => html`
                        <tr>
                          <td>${p.name}</td>
                          <td>${p.teamRole || '—'}</td>
                          <td>${formatDate(p.startDate)}</td>
                          <td class="actions">${this._renderActions(p)}</td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              `}
      </section>
    `;
  }
}

if (!customElements.get('team-people')) {
  customElements.define('team-people', TeamPeople);
}
