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
import {
  addPerson,
  listActivePeople,
  deactivatePerson,
  listTeamRoles,
  addTeamRole,
  listLabels,
  addLabel,
} from '../../tools/team/application/usecases/index.js';

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
    isAdmin: { attribute: false },
    people: { state: true },
    roles: { state: true },
    labels: { state: true },
    loading: { state: true },
    error: { state: true },
    _name: { state: true },
    _selected: { state: true },
    _selectedLabels: { state: true },
    _newRole: { state: true },
    _newLabel: { state: true },
    _startDate: { state: true },
    _github: { state: true },
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
    form { display: flex; flex-direction: column; gap: 1rem; }
    .row { display: grid; grid-template-columns: 2fr 1.3fr auto; gap: 0.75rem; align-items: end; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
    label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    fieldset.roles { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.75rem 0.9rem; margin: 0; }
    fieldset.roles legend { font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; padding: 0 0.4rem; }
    .role-checks { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 0.75rem; }
    .role-check { flex-direction: row; align-items: center; gap: 0.4rem; font-weight: 500; color: var(--rm-text, #111827); cursor: pointer; }
    .role-add { display: flex; gap: 0.5rem; align-items: center; }
    .role-add input { flex: 1; }
    .role-hint { font-size: 0.78rem; margin: 0; }
    .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
    .chip { background: var(--rm-track, #e9f0f2); color: var(--rm-text, #111827); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    .muted { color: var(--rm-muted, #9ca3af); }
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
    tr.rowlink { cursor: pointer; }
    tr.rowlink:hover td { background: var(--rm-surface-hover, #f9fafb); }
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
    /** @type {boolean} Solo un admin puede añadir roles al catálogo global. */
    this.isAdmin = false;
    /** @type {import('../../tools/team/domain/types.js').Person[]} */
    this.people = [];
    /** @type {import('../../tools/team/domain/types.js').TeamRole[]} */
    this.roles = [];
    /** @type {import('../../tools/team/domain/types.js').Label[]} */
    this.labels = [];
    this.loading = true;
    this.error = '';
    this._name = '';
    /** @type {string[]} nombres de roles seleccionados para el alta */
    this._selected = [];
    /** @type {string[]} nombres de labels seleccionados para el alta */
    this._selectedLabels = [];
    this._newRole = '';
    this._newLabel = '';
    this._startDate = '';
    this._github = '';
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
      const [people, roles, labels] = await Promise.all([
        listActivePeople(this.persistence),
        listTeamRoles(this.persistence),
        listLabels(this.persistence),
      ]);
      this.people = people;
      this.roles = roles;
      this.labels = labels;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar las personas.';
    } finally {
      this.loading = false;
    }
  }

  _toggleRole(name, checked) {
    this._selected = checked
      ? [...this._selected, name]
      : this._selected.filter((r) => r !== name);
  }

  async _addRole() {
    const name = this._newRole.trim();
    if (!name) return;
    this.error = '';
    try {
      if (!this.roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
        await addTeamRole(this.persistence, name);
        this.roles = await listTeamRoles(this.persistence);
      }
      if (!this._selected.includes(name)) this._selected = [...this._selected, name];
      this._newRole = '';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo añadir el rol.';
    }
  }

  _toggleLabel(name, checked) {
    this._selectedLabels = checked
      ? [...this._selectedLabels, name]
      : this._selectedLabels.filter((l) => l !== name);
  }

  async _addLabel() {
    const name = this._newLabel.trim();
    if (!name) return;
    this.error = '';
    try {
      if (!this.labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
        await addLabel(this.persistence, name);
        this.labels = await listLabels(this.persistence);
      }
      if (!this._selectedLabels.includes(name)) this._selectedLabels = [...this._selectedLabels, name];
      this._newLabel = '';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo añadir el label.';
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
        teamRoles: [...this._selected],
        labels: [...this._selectedLabels],
        startDate: this._startDate || new Date().toISOString().slice(0, 10),
        githubLogin: this._github,
      });
      this._name = '';
      this._selected = [];
      this._selectedLabels = [];
      this._newRole = '';
      this._newLabel = '';
      this._startDate = '';
      this._github = '';
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo crear la persona.';
    }
  }

  _openPerson(person) {
    this.dispatchEvent(
      new CustomEvent('open-person', { detail: { person }, bubbles: true, composed: true }),
    );
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
          <div class="row">
            <label>Nombre
              <input type="text" .value=${this._name} @input=${(e) => { this._name = e.target.value; }} required />
            </label>
            <label>Fecha de inicio
              <input type="date" .value=${this._startDate} @input=${(e) => { this._startDate = e.target.value; }} />
            </label>
            <label>Usuario de GitHub (opcional)
              <input type="text" placeholder="usuario" .value=${this._github} @input=${(e) => { this._github = e.target.value; }} />
            </label>
            <button class="primary" type="submit">Añadir</button>
          </div>
          <fieldset class="roles">
            <legend>Roles en el equipo</legend>
            <div class="role-checks">
              ${this.roles.length === 0
                ? html`<span class="muted">Aún no hay roles. Añade el primero abajo.</span>`
                : this.roles.map(
                    (r) => html`
                      <label class="role-check">
                        <input
                          type="checkbox"
                          .checked=${this._selected.includes(r.name)}
                          @change=${(e) => this._toggleRole(r.name, e.target.checked)}
                        />
                        <span>${r.name}</span>
                      </label>
                    `,
                  )}
            </div>
            <div class="role-add">
              <input
                type="text"
                placeholder="Añadir un rol nuevo (tuyo)…"
                .value=${this._newRole}
                @input=${(e) => { this._newRole = e.target.value; }}
                @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._addRole(); } }}
              />
              <button type="button" @click=${this._addRole}>Añadir rol</button>
            </div>
            <p class="role-hint muted">Los roles globales los ve todo el equipo; los que añadas aquí son tuyos (gestiónalos en Ajustes).</p>
          </fieldset>
          <fieldset class="roles">
            <legend>Labels (gremios / equipos)</legend>
            <div class="role-checks">
              ${this.labels.length === 0
                ? html`<span class="muted">Aún no hay labels. Añade el primero abajo.</span>`
                : this.labels.map(
                    (l) => html`
                      <label class="role-check">
                        <input
                          type="checkbox"
                          .checked=${this._selectedLabels.includes(l.name)}
                          @change=${(e) => this._toggleLabel(l.name, e.target.checked)}
                        />
                        <span>${l.name}</span>
                      </label>
                    `,
                  )}
            </div>
            <div class="role-add">
              <input
                type="text"
                placeholder="Añadir un label nuevo (tuyo)…"
                .value=${this._newLabel}
                @input=${(e) => { this._newLabel = e.target.value; }}
                @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._addLabel(); } }}
              />
              <button type="button" @click=${this._addLabel}>Añadir label</button>
            </div>
          </fieldset>
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
                    <tr><th>Nombre</th><th>Roles</th><th>Labels</th><th>Desde</th><th></th></tr>
                  </thead>
                  <tbody>
                    ${this.people.map(
                      (p) => html`
                        <tr class="rowlink" @click=${() => this._openPerson(p)} title="Abrir ficha">
                          <td>${p.name}</td>
                          <td>
                            ${(p.teamRoles ?? []).length === 0
                              ? html`<span class="muted">—</span>`
                              : html`<span class="chips">${p.teamRoles.map((r) => html`<span class="chip">${r}</span>`)}</span>`}
                          </td>
                          <td>
                            ${(p.labels ?? []).length === 0
                              ? html`<span class="muted">—</span>`
                              : html`<span class="chips">${p.labels.map((l) => html`<span class="chip">${l}</span>`)}</span>`}
                          </td>
                          <td>${formatDate(p.startDate)}</td>
                          <td class="actions" @click=${(e) => e.stopPropagation()}>${this._renderActions(p)}</td>
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
