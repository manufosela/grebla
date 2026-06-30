/**
 * <superadmin-panel>
 * Vista de gestión del superadmin (separada de la vista de líder). Lista los
 * líderes de la instancia (alta por email vía Cloud Function, baja) y permite
 * ver el equipo de cada líder (personas y su perfil Role Mirror) en LECTURA.
 * Si el superadmin es además líder, "Usar como líder" lo lleva a las herramientas.
 *
 * Propiedades:
 *  - ready: boolean  (lo activa el glue cuando hay sesión de superadmin)
 *  - isLeader: boolean  (si el superadmin también es líder → botón "Usar como líder")
 */
import { LitElement, html, css } from 'lit';
import { listLeaders, addLeaderByEmail, removeLeader } from '../lib/leaders.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';
import { getPersonProfile } from '../lib/firestore.js';

const VIEW_FLAG = 'grebla-view';

export class SuperadminPanel extends LitElement {
  static properties = {
    ready: { attribute: false },
    isLeader: { attribute: false },
    leaders: { state: true },
    selected: { state: true },
    team: { state: true },
    teamLoading: { state: true },
    _email: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .bar h1 { font-size: 1.4rem; margin: 0; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.1rem; margin: 0 0 1rem; }
    .toolbar { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    input {
      padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      font: inherit; font-size: 0.9rem; min-width: 16rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    button {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: #fff; }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    tbody tr.clickable { cursor: pointer; }
    tbody tr.clickable:hover { background: var(--rm-surface-hover, #f9fafb); }
    tr.sel { background: var(--rm-surface-hover, #eef2ff); }
    .muted { color: var(--rm-muted, #9ca3af); }
    .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #fff; }
    .del-btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-danger, #dc2626); border-radius: 6px; padding: 0.2rem 0.6rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.88rem; padding: 0.5rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .ro-note { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; }
  `;

  constructor() {
    super();
    this.ready = false;
    this.isLeader = false;
    /** @type {import('../lib/leaders.js').Leader[]} */
    this.leaders = [];
    /** @type {import('../lib/leaders.js').Leader|null} */
    this.selected = null;
    /** @type {Array<Object>} */
    this.team = [];
    this.teamLoading = false;
    this._email = '';
    this._error = '';
    this._loaded = false;
  }

  updated() {
    if (this.ready && !this._loaded) {
      this._loaded = true;
      this._loadLeaders();
    }
  }

  async _loadLeaders() {
    this._error = '';
    try {
      this.leaders = await listLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los líderes.';
    }
  }

  async _addLeader() {
    const email = this._email.trim();
    if (!email) return;
    this._error = '';
    try {
      await addLeaderByEmail(email);
      this._email = '';
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo añadir el líder.';
    }
  }

  /** @param {string} uid */
  async _removeLeader(uid) {
    this._error = '';
    try {
      await removeLeader(uid);
      if (this.selected?.uid === uid) this.selected = null;
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo quitar el líder.';
    }
  }

  /** @param {import('../lib/leaders.js').Leader} leader */
  async _openTeam(leader) {
    this.selected = leader;
    this.team = [];
    this.teamLoading = true;
    this._error = '';
    try {
      const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: leader.uid });
      const people = await listActivePeople(persistence);
      this.team = await Promise.all(
        people.map(async (p) => ({ ...p, profile: await getPersonProfile(p.id) })),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el equipo.';
    } finally {
      this.teamLoading = false;
    }
  }

  _useAsLeader() {
    sessionStorage.setItem(VIEW_FLAG, 'leader');
    location.assign('/');
  }

  render() {
    return html`
      <div class="bar">
        <h1>Gestión de la organización</h1>
        ${this.isLeader
          ? html`<button class="primary" @click=${this._useAsLeader}>Usar como líder →</button>`
          : null}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._renderLeaders()}
      ${this.selected ? this._renderTeam() : null}
    `;
  }

  _renderLeaders() {
    return html`
      <section>
        <h2>Líderes (${this.leaders.length})</h2>
        <p class="ro-note">Da de alta a los líderes por su email (deben haber iniciado sesión al menos una vez). Pincha un líder para ver su equipo.</p>
        <div class="toolbar">
          <input
            type="email"
            placeholder="email@dominio.com"
            .value=${this._email}
            @input=${(e) => { this._email = e.target.value; }}
          />
          <button class="primary" ?disabled=${!this._email.trim()} @click=${() => this._addLeader()}>Añadir líder</button>
        </div>
        ${this.leaders.length === 0
          ? html`<p class="empty">Aún no hay líderes dados de alta.</p>`
          : html`<table>
              <thead><tr><th>Nombre</th><th>Email</th><th></th></tr></thead>
              <tbody>
                ${this.leaders.map(
                  (l) => html`
                    <tr class="clickable ${this.selected?.uid === l.uid ? 'sel' : ''}" @click=${() => this._openTeam(l)}>
                      <td>${l.displayName ?? '—'}</td>
                      <td class="muted">${l.email ?? '—'}</td>
                      <td @click=${(e) => e.stopPropagation()}>
                        <button class="del-btn" @click=${() => this._removeLeader(l.uid)}>Quitar</button>
                      </td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>`}
      </section>
    `;
  }

  _renderTeam() {
    const name = this.selected.displayName ?? this.selected.email ?? this.selected.uid;
    return html`
      <section>
        <h2>Equipo de ${name}</h2>
        <p class="ro-note">Vista de solo lectura. La gestión de cada persona la hace su líder.</p>
        ${this.teamLoading
          ? html`<p class="empty">Cargando equipo…</p>`
          : this.team.length === 0
            ? html`<p class="empty">Este líder aún no tiene personas en su equipo.</p>`
            : html`<table>
                <thead><tr><th>Persona</th><th>Roles</th><th>Rol dominante</th><th>Completitud</th></tr></thead>
                <tbody>
                  ${this.team.map(
                    (p) => html`
                      <tr>
                        <td>${p.name}</td>
                        <td class="muted">${(p.teamRoles ?? []).join(', ') || '—'}</td>
                        <td>${p.profile?.dominantRole ?? html`<span class="muted">—</span>`}</td>
                        <td>${p.profile?.completion != null ? `${p.profile.completion}%` : '—'}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>`}
      </section>
    `;
  }
}

if (!customElements.get('superadmin-panel')) {
  customElements.define('superadmin-panel', SuperadminPanel);
}
