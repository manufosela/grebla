/**
 * <team-people>
 * Sección de personas: lista de personas activas, alta (nombre, rol funcional,
 * fecha de inicio) y baja (active=false, sin borrar histórico). Usa los casos de
 * uso de la capa de aplicación; nunca toca persistencia ni dominio directamente.
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 *  - members: Leader[] (managers de la instancia, para compartir/transferir)
 *  - currentUid: string (uid del manager en sesión)
 *  - isAdmin: boolean
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import '../app-modal.js';
import {
  addPerson,
  listActivePeople,
  deactivatePerson,
  sharePerson,
  unsharePerson,
  transferOwnership,
  releaseOwnership,
  listLabels,
  listSquads,
  squadNames,
  addLabel,
  listGuilds,
  addGuild,
} from '../../tools/team/application/usecases/index.js';
import { composeTitle } from '../../tools/career/data/framework.js';
import { listUsers, unlinkedUsers } from '../../lib/users.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** Valor sentinela del selector de transferencia para «soltar» (dejar sin manager). */
const RELEASE_OWNER = '__release__';

/** @param {string} iso */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export class TeamPeople extends LitElement {
  static properties = {
    persistence: { attribute: false },
    members: { attribute: false },
    currentUid: { attribute: false },
    isAdmin: { attribute: false },
    framework: { attribute: false },
    people: { state: true },
    labels: { state: true },
    squads: { state: true },
    guilds: { state: true },
    users: { state: true },
    loading: { state: true },
    error: { state: true },
    _name: { state: true },
    _selectedUid: { state: true },
    _selectedDisciplines: { state: true },
    _levelId: { state: true },
    _selectedGuilds: { state: true },
    _newGuild: { state: true },
    _selectedLabels: { state: true },
    _newLabel: { state: true },
    _startDate: { state: true },
    _github: { state: true },
    _external: { state: true },
    _sortBy: { state: true },
    _sortDir: { state: true },
    _confirmOff: { state: true },
    _shareFor: { state: true },
    _shareSel: { state: true },
    _sharePerm: { state: true },
    _transferFor: { state: true },
    _transferSel: { state: true },
    _confirmTransfer: { state: true },
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
    label.chk-inline { flex-direction: row; align-items: center; gap: 0.4rem; }
    label.chk-inline input { width: auto; }
    fieldset.roles { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.75rem 0.9rem; margin: 0; }
    fieldset.roles legend { font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; padding: 0 0.4rem; }
    .role-checks { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 0.75rem; }
    .role-check { flex-direction: row; align-items: center; gap: 0.4rem; font-weight: 500; color: var(--rm-text, #111827); cursor: pointer; }
    .role-add { display: flex; gap: 0.5rem; align-items: center; }
    .role-add input { flex: 1; }
    .role-hint { font-size: 0.78rem; margin: 0; }
    /* Micro-aclaración por eje (Disciplinas/Gremios/Labels) dentro del alta/edición. */
    .eje-hint { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin: 0 0 0.6rem; }
    .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
    .chip { background: var(--rm-track, #e9f0f2); color: var(--rm-text, #111827); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    /* Invitación pendiente (persona pre-invitada por email, aún sin vincular). */
    .pending { display: block; margin-top: 0.2rem; font-size: 0.74rem; font-weight: 600; color: #8a5a00; }
    .invite-field input:disabled { opacity: 0.55; }
    .title { font-weight: 600; color: var(--rm-text, #111827); }
    .leader { font-size: 0.85rem; color: var(--rm-text, #111827); }
    .muted { color: var(--rm-muted, #9ca3af); }
    th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    th.sortable:hover { color: var(--rm-accent, #2a9d8f); }
    .ext-badge { display: inline-block; margin-left: 0.4rem; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-navy, #1e3a5f); background: var(--rm-chip, #eef2f7); border: 1px solid var(--rm-border, #d1d5db); border-radius: 999px; padding: 0.05rem 0.45rem; vertical-align: middle; }
    .link-inline {
      border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
      font: inherit; font-weight: 700; color: var(--rm-accent, #2a9d8f); text-decoration: underline;
    }
    .link-inline:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    .fw-hint a { color: var(--rm-accent, #2a9d8f); font-weight: 700; }
    input, select {
      padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); font-size: 0.9rem;
    }
    button {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827); border-radius: 8px; padding: 0.5rem 0.9rem;
      font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
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

    /* Bloques colapsables: alta vs lista. */
    details {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 0 1.5rem;
      margin-bottom: 1.5rem;
    }
    details > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.05rem;
      font-weight: 700;
      padding: 1.1rem 0;
      color: var(--rm-text, #111827);
    }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before {
      content: '▸';
      color: var(--rm-muted, #9ca3af);
      font-size: 0.9rem;
      transition: transform 0.15s ease;
    }
    details[open] > summary::before { transform: rotate(90deg); }
    details > summary .count { color: var(--rm-muted, #6b7280); font-weight: 600; }
    details .body { padding-bottom: 1.25rem; }
    /* La tarjeta de alta se distingue visualmente de la lista. */
    details.add-card {
      background: var(--rm-track, #f4f8f9);
      border: 1px dashed var(--rm-accent, #2a9d8f);
      border-left: 4px solid var(--rm-accent, #2a9d8f);
    }
    details.add-card > summary { color: var(--rm-accent, #2a9d8f); }

    /* Acciones por fila. */
    .row-actions { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; justify-content: flex-end; }
    .act {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827); border-radius: 6px; padding: 0.25rem 0.6rem;
      font-size: 0.78rem; font-weight: 600; cursor: pointer;
    }
    .act:hover { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); }
    .act.danger { color: var(--rm-danger, #dc2626); }
    .act.danger:hover { border-color: var(--rm-danger, #dc2626); color: var(--rm-danger, #dc2626); }

    /* Contenido de los modales. */
    .modal-body { display: flex; flex-direction: column; gap: 1rem; }
    .modal-body p { margin: 0; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    .modal-body .fields { display: flex; flex-direction: column; gap: 0.75rem; }
    .modal-body select { padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); font-size: 0.9rem; }
    .modal-body .actions-row { display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
    .shared-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .shared-list li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; border-top: 1px solid var(--rm-border, #eef0f2); padding-top: 0.4rem; }
    .shared-list .who { font-weight: 600; }
    .shared-list .perm { color: var(--rm-muted, #6b7280); }
    .shared-list .rm { margin-left: auto; border: 0; background: none; color: var(--rm-danger, #dc2626); font-weight: 700; font-size: 0.8rem; cursor: pointer; padding: 0 0.25rem; }
    .confirm-text { font-size: 0.8rem; color: var(--rm-danger, #dc2626); white-space: normal; }
    .edit-checks { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
  `;

  constructor() {
    super();
    /** @type {import('../../tools/team/domain/ports.js').PersistencePort|null} */
    this.persistence = null;
    /** @type {boolean} Solo un admin puede añadir roles al catálogo global. */
    this.isAdmin = false;
    /** @type {import('../../lib/leaders.js').Leader[]} managers de la instancia (compartir/transferir) */
    this.members = [];
    /** @type {string|null} uid del manager en sesión */
    this.currentUid = null;
    /** @type {import('../../tools/career/data/framework.js').CareerFramework|null} framework de carrera (disciplinas/niveles) */
    this.framework = null;
    /** @type {import('../../tools/team/domain/types.js').Person[]} */
    this.people = [];
    /** @type {import('../../tools/team/domain/types.js').Label[]} */
    this.labels = [];
    /** @type {{id:string,name:string}[]} catálogo de squads (RMR-TSK-0276) */
    this.squads = [];
    /** @type {import('../../tools/team/domain/types.js').Guild[]} */
    this.guilds = [];
    /** @type {Array<{ uid: string, displayName: string|null, email: string|null }>} directorio /users (para vincular cuenta) */
    this.users = [];
    this.loading = true;
    this.error = '';
    this._name = '';
    /** @type {string} uid de la cuenta a vincular en el alta ('' = sin vincular) */
    this._selectedUid = '';
    /** @type {string[]} ids de disciplina seleccionadas para el alta */
    this._selectedDisciplines = [];
    /** @type {string} id de nivel seleccionado para el alta ('' = sin nivel) */
    this._levelId = '';
    /** @type {string[]} nombres de gremios seleccionados para el alta */
    this._selectedGuilds = [];
    this._newGuild = '';
    /** @type {string[]} nombres de labels seleccionados para el alta */
    this._selectedLabels = [];
    this._newLabel = '';
    this._startDate = '';
    this._github = '';
    this._external = false;
    /** @type {'name'|'leader'|'startDate'|null} columna de orden de la tabla */
    this._sortBy = null;
    /** @type {1|-1} sentido del orden (1 asc, -1 desc) */
    this._sortDir = 1;
    /** @type {string|null} */
    this._confirmOff = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} persona del modal Compartir */
    this._shareFor = null;
    /** @type {string} manager seleccionado en el modal Compartir */
    this._shareSel = '';
    /** @type {import('../../tools/team/domain/types.js').SharePermission} */
    this._sharePerm = 'view';
    /** @type {import('../../tools/team/domain/types.js').Person|null} persona del modal Transferir */
    this._transferFor = null;
    /** @type {string} nuevo dueño seleccionado en el modal Transferir */
    this._transferSel = '';
    /** @type {boolean} confirmación de transferencia */
    this._confirmTransfer = false;
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
      const [people, labels, guilds, users, squads] = await Promise.all([
        listActivePeople(this.persistence),
        listLabels(this.persistence),
        listGuilds(this.persistence),
        listUsers(),
        listSquads(this.persistence).catch(() => []),
      ]);
      this.people = people;
      this.labels = labels;
      this.squads = squads;
      this.guilds = guilds;
      this.users = users;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar las personas.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * uids de cuentas ya vinculadas a las personas cargadas del manager. `exceptUid`
   * (p. ej. la cuenta de la persona en edición) se excluye para que siga siendo
   * una opción seleccionable del selector.
   * @param {string} [exceptUid]
   * @returns {Set<string>}
   */
  _linkedUids(exceptUid) {
    const set = new Set();
    for (const p of this.people) {
      if (typeof p.uid === 'string' && p.uid && p.uid !== exceptUid) set.add(p.uid);
    }
    return set;
  }

  /**
   * Cuentas "sin asignar" para vincular (directorio /users menos las ya
   * vinculadas), conservando opcionalmente `exceptUid` como opción disponible.
   * @param {string} [exceptUid]
   * @returns {Array<{ uid: string, displayName: string|null, email: string|null }>}
   */
  _unlinkedAccounts(exceptUid) {
    return /** @type {Array<{ uid: string, displayName: string|null, email: string|null }>} */ (
      unlinkedUsers(this.users, this._linkedUids(exceptUid))
    );
  }

  /**
   * Etiqueta legible de una cuenta (displayName y email si los hay).
   * @param {{ uid: string, displayName: string|null, email: string|null }} user
   * @returns {string}
   */
  _accountLabel(user) {
    const name = user.displayName ?? user.email ?? user.uid;
    return user.displayName && user.email ? `${name} · ${user.email}` : name;
  }

  /**
   * Elige una cuenta a vincular en el alta: fija el uid y, si la cuenta trae
   * displayName, precarga el nombre de la persona con él.
   * @param {string} uid
   */
  _onSelectAltaAccount(uid) {
    this._selectedUid = uid;
    if (uid) {
      const user = this.users.find((u) => u.uid === uid);
      if (user?.displayName) this._name = user.displayName;
    }
  }

  /**
   * Selector opcional "Vincular cuenta": ofrece las cuentas sin asignar (más la
   * ya vinculada a la persona en edición, vía `exceptUid`). La opción
   * "— sin vincular —" desvincula (uid → null).
   * @param {string} value  uid seleccionado ('' = sin vincular)
   * @param {(uid: string) => void} onChange
   * @param {string} [exceptUid]
   */
  _renderAccountSelect(value, onChange, exceptUid) {
    const accounts = this._unlinkedAccounts(exceptUid);
    return html`
      <label>Vincular cuenta (opcional)
        <select .value=${value ?? ''} @change=${(e) => onChange(e.target.value)}>
          <option value="">— sin vincular —</option>
          ${accounts.map((u) => html`<option value=${u.uid}>${this._accountLabel(u)}</option>`)}
        </select>
      </label>
    `;
  }

  /** @param {string} id @param {boolean} checked */
  _toggleDiscipline(id, checked) {
    this._selectedDisciplines = checked
      ? [...this._selectedDisciplines, id]
      : this._selectedDisciplines.filter((d) => d !== id);
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

  _toggleGuild(name, checked) {
    this._selectedGuilds = checked
      ? [...this._selectedGuilds, name]
      : this._selectedGuilds.filter((g) => g !== name);
  }

  async _addGuild() {
    const name = this._newGuild.trim();
    if (!name) return;
    this.error = '';
    try {
      if (!this.guilds.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
        await addGuild(this.persistence, name);
        this.guilds = await listGuilds(this.persistence);
      }
      if (!this._selectedGuilds.includes(name)) this._selectedGuilds = [...this._selectedGuilds, name];
      this._newGuild = '';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo añadir el gremio.';
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
        disciplines: [...this._selectedDisciplines],
        levelId: this._levelId || null,
        guilds: [...this._selectedGuilds],
        labels: [...this._selectedLabels],
        startDate: this._startDate || new Date().toISOString().slice(0, 10),
        githubLogin: this._github,
        uid: this._selectedUid || null,
        external: this._external,
      });
      this._name = '';
      this._selectedDisciplines = [];
      this._levelId = '';
      this._selectedGuilds = [];
      this._newGuild = '';
      this._selectedLabels = [];
      this._newLabel = '';
      this._startDate = '';
      this._github = '';
      this._external = false;
      this._selectedUid = '';
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo crear la persona.';
    }
  }

  /** Abre la ficha de la persona; opcionalmente en una sub-pestaña concreta
   * (p. ej. «datos» desde el botón Editar, RMR-TSK-0173). */
  _openPerson(person, subtab) {
    this.dispatchEvent(
      new CustomEvent('open-person', { detail: { person, subtab }, bubbles: true, composed: true }),
    );
  }

  /** Celda «Manager» de la tabla (solo superadmin): nombre del dueño o «Sin manager».
   * Reutiliza `_leaderName` (displayName › email › uid). */
  _renderLeaderCell(person) {
    if (!person.ownerLeaderUid) return html`<span class="muted">Sin manager</span>`;
    return html`<span class="leader">${this._leaderName(person.ownerLeaderUid)}</span>`;
  }

  /** Lista de personas activas: cargando / vacío / tabla (sin ternarios anidados). */
  _renderPeopleList() {
    if (this.loading) return skeletonLines(5);
    if (this.people.length === 0) {
      return html`<p class="empty">Aún no has añadido a nadie. Despliega «Añadir persona» para empezar.</p>`;
    }
    return html`
      <table>
        <thead>
          <tr>
            ${this._sortableTh('name', 'Nombre')}
            ${this.isAdmin ? this._sortableTh('leader', 'Manager') : null}
            <th>Carrera</th><th>Gremios</th><th>Squads</th>
            ${this._sortableTh('startDate', 'Desde')}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${this._sortedPeople().map((p) => this._renderPersonRow(p))}</tbody>
      </table>`;
  }

  /** Cabecera de columna ordenable, con indicador de sentido. */
  _sortableTh(key, label) {
    const active = this._sortBy === key;
    let arrow = '';
    if (active) arrow = this._sortDir === 1 ? ' ▲' : ' ▼';
    return html`<th class="sortable" role="button" tabindex="0"
      @click=${() => this._toggleSort(key)}
      @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._toggleSort(key); } }}
    >${label}${arrow}</th>`;
  }

  _toggleSort(key) {
    if (this._sortBy === key) this._sortDir = /** @type {1|-1} */ (-this._sortDir);
    else { this._sortBy = key; this._sortDir = 1; }
  }

  /** Personas ordenadas según la columna activa (sin orden → como vienen). */
  _sortedPeople() {
    const people = [...this.people];
    if (!this._sortBy) return people;
    const dir = this._sortDir;
    const keyOf = (p) => {
      if (this._sortBy === 'leader') return (this._leaderName(p.ownerLeaderUid) || '~~~').toLowerCase();
      if (this._sortBy === 'startDate') return p.startDate || '';
      return (p.name || '').toLowerCase();
    };
    return people.sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      if (ka < kb) return -dir;
      if (ka > kb) return dir;
      return 0;
    });
  }

  /** Un chip (gremio/label). `color` opcional lo tiñe (labels con color de catálogo). */
  _chipEl(text, color) {
    const style = color ? `background:${color};border-color:${color};color:#fff` : '';
    return html`<span class="chip" style=${style}>${text}</span>`;
  }

  /** Color del label en el catálogo (o '' si no tiene). */
  _labelColor(name) {
    const label = (this.labels ?? []).find((l) => l.name === name);
    return label?.color || '';
  }

  /** Celda de chips (gremios o labels), o «—» si está vacía. Con `withColor`,
   * cada chip usa el color de su label del catálogo. */
  _renderChips(items, withColor = false) {
    const list = items ?? [];
    if (list.length === 0) return html`<span class="muted">—</span>`;
    return html`<span class="chips">${list.map((x) => this._chipEl(x, withColor ? this._labelColor(x) : ''))}</span>`;
  }

  /** Una fila de la tabla de personas. */
  _renderPersonRow(p) {
    const title = composeTitle(this.framework, p.levelId, p.disciplines);
    const pending = !p.uid && p.pendingEmail
      ? html`<span class="pending" title="Aún no se ha logado: se vinculará en su primer login con este email">⏳ Pendiente: ${p.pendingEmail}</span>`
      : null;
    const ext = p.external ? html`<span class="ext-badge" title="Persona externa">Externo</span>` : null;
    return html`
      <tr class="rowlink" @click=${() => this._openPerson(p)} title="Abrir ficha">
        <td>${p.name}${ext}${pending}</td>
        ${this.isAdmin ? html`<td>${this._renderLeaderCell(p)}</td>` : null}
        <td>${title ? html`<span class="title">${title}</span>` : html`<span class="muted">—</span>`}</td>
        <td>${this._renderChips(p.guilds)}</td>
        <td>${this._renderChips(squadNames(p.squadIds, this.squads))}</td>
        <td>${formatDate(p.startDate)}</td>
        <td class="actions" @click=${(e) => e.stopPropagation()}>${this._renderActions(p)}</td>
      </tr>`;
  }

  /**
   * Pide a `<team-app>` que cambie de sección principal (p. ej. «Ajustes» para
   * gestionar gremios/labels) mediante el evento burbujeante `goto-tab`.
   * @param {string} tab
   * @returns {void}
   */
  _gotoTab(tab) {
    this.dispatchEvent(
      new CustomEvent('goto-tab', { detail: { tab }, bubbles: true, composed: true }),
    );
  }

  /**
   * Mensaje de salida cuando falta configuración del framework de carrera
   * (disciplinas o niveles). El framework lo gestiona el superadministrador en
   * `/admin#careerFramework`; si el usuario no lo es, solo se informa (sin
   * dead-end silencioso).
   * @param {string} what  qué falta ("disciplinas" | "niveles")
   * @returns {import('lit').TemplateResult}
   */
  _frameworkHint(what) {
    return this.isAdmin
      ? html`<span class="muted fw-hint">No hay ${what} en el framework de carrera.
          <a href="/admin#careerFramework">Configúralo en el panel de administración</a>.</span>`
      : html`<span class="muted">No hay ${what} en el framework de carrera. Los gestiona el superadministrador.</span>`;
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

  /**
   * Solo el dueño de la persona o un admin del tenant pueden compartirla o
   * transferirla.
   * @param {import('../../tools/team/domain/types.js').Person} person
   * @returns {boolean}
   */
  _canManage(person) {
    return this.isAdmin || (this.currentUid != null && person.ownerLeaderUid === this.currentUid);
  }

  _renderActions(person) {
    const manage = this._canManage(person);
    return html`
      <div class="row-actions">
        <button class="act" type="button" @click=${() => this._openPerson(person, 'datos')}>Editar</button>
        ${manage
          ? html`
              <button class="act" type="button" @click=${() => this._openShare(person)}>Compartir</button>
              <button class="act" type="button" @click=${() => this._openTransfer(person)}>Transferir</button>
            `
          : null}
        ${this._confirmOff === person.id
          ? html`<span class="confirm">¿Dar de baja?
              <button class="yes" type="button" @click=${() => this._deactivate(person.id)}>Sí</button>
              <button type="button" @click=${() => { this._confirmOff = null; }}>No</button>
            </span>`
          : html`<button class="act danger" type="button" @click=${() => { this._confirmOff = person.id; }}>Dar de baja</button>`}
      </div>
    `;
  }

  /** @param {string} uid */
  _leaderName(uid) {
    const m = (this.members ?? []).find((x) => x.uid === uid);
    return m?.displayName ?? m?.email ?? uid;
  }

  /** Refleja en la lista local los cambios de compartición de una persona. */
  _syncPerson(updated) {
    this.people = this.people.map((p) => (p.id === updated.id ? updated : p));
  }

  // ---- Compartir ----
  _openShare(person) {
    this._shareFor = person;
    this._shareSel = '';
    this._sharePerm = 'view';
    this.error = '';
  }

  _closeShare() {
    this._shareFor = null;
    this.error = '';
  }

  async _share() {
    const person = this._shareFor;
    const uid = this._shareSel;
    if (!person || !uid) return;
    this.error = '';
    try {
      await sharePerson(this.persistence, person.id, uid, this._sharePerm);
      const sharedWith = { ...(person.sharedWith ?? {}), [uid]: this._sharePerm };
      const updated = { ...person, sharedWith, sharedWithUids: Object.keys(sharedWith) };
      this._syncPerson(updated);
      this._shareFor = updated;
      this._shareSel = '';
      this._sharePerm = 'view';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo compartir.';
    }
  }

  /** @param {string} uid */
  async _unshare(uid) {
    const person = this._shareFor;
    if (!person) return;
    this.error = '';
    try {
      await unsharePerson(this.persistence, person.id, uid);
      const sharedWith = { ...(person.sharedWith ?? {}) };
      delete sharedWith[uid];
      const updated = { ...person, sharedWith, sharedWithUids: Object.keys(sharedWith) };
      this._syncPerson(updated);
      this._shareFor = updated;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo dejar de compartir.';
    }
  }

  // ---- Transferir ----
  _openTransfer(person) {
    this._transferFor = person;
    this._transferSel = '';
    this._confirmTransfer = false;
    this.error = '';
  }

  _closeTransfer() {
    this._transferFor = null;
    this._confirmTransfer = false;
    this.error = '';
  }

  async _transfer() {
    const person = this._transferFor;
    const sel = this._transferSel;
    if (!person || !sel) return;
    this.error = '';
    try {
      if (sel === RELEASE_OWNER) {
        await releaseOwnership(this.persistence, person.id);
      } else {
        await transferOwnership(this.persistence, person.id, sel);
      }
      this._transferFor = null;
      this._transferSel = '';
      this._confirmTransfer = false;
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo transferir.';
    }
  }


  // ---- Selectores del framework de carrera (reutilizados en alta y edición) ----

  /**
   * Fieldset «Disciplinas»: checkboxes de las disciplinas del framework (ya
   * vienen ordenadas por `order`), guardando sus ids.
   * @param {string[]} selectedIds  ids marcados
   * @param {(id: string, checked: boolean) => void} onToggle
   */
  _renderDisciplineChecks(selectedIds, onToggle) {
    const disciplines = this.framework?.disciplines ?? [];
    return html`
      <fieldset class="roles">
        <legend>Disciplinas</legend>
        <p class="eje-hint">Familia de carrera (Backend, Web, Infra…) que ajusta las expectativas del nivel.</p>
        <div class="role-checks">
          ${disciplines.length === 0
            ? this._frameworkHint('disciplinas')
            : disciplines.map(
                (d) => html`
                  <label class="role-check">
                    <input
                      type="checkbox"
                      .checked=${selectedIds.includes(d.id)}
                      @change=${(e) => onToggle(d.id, e.target.checked)}
                    />
                    <span>${d.name}</span>
                  </label>
                `,
              )}
        </div>
      </fieldset>
    `;
  }

  /**
   * Selector «Nivel»: los niveles del framework agrupados por track (<optgroup>),
   * mostrando `code · title`. Opción «— sin nivel —» para dejarlo sin asignar.
   * @param {string} value  id de nivel seleccionado ('' = sin nivel)
   * @param {(id: string) => void} onChange
   */
  _renderLevelSelect(value, onChange) {
    const tracks = this.framework?.tracks ?? [];
    const levels = this.framework?.levels ?? [];
    const groups = tracks
      .map((t) => ({ track: t, levels: levels.filter((l) => l.trackId === t.id) }))
      .filter((g) => g.levels.length > 0);
    // Sin niveles no hay nada que elegir: en vez de un desplegable vacío (dead-end),
    // se informa de dónde se configuran (o se enlaza si el usuario es superadmin).
    if (groups.length === 0) {
      return html`<label>Nivel ${this._frameworkHint('niveles')}</label>`;
    }
    return html`
      <label>Nivel
        <select .value=${value ?? ''} @change=${(e) => onChange(e.target.value)}>
          <option value="">— sin nivel —</option>
          ${groups.map(
            (g) => html`
              <optgroup label=${g.track.name}>
                ${g.levels.map((l) => html`<option value=${l.id}>${l.code} · ${l.title}</option>`)}
              </optgroup>
            `,
          )}
        </select>
      </label>
    `;
  }

  _renderShareModal() {
    const person = this._shareFor;
    const heading = person ? `Compartir · ${person.name}` : 'Compartir';
    const shared = person?.sharedWith ?? {};
    const sharedUids = Object.keys(shared);
    const candidates = person
      ? (this.members ?? []).filter(
          (m) => m.uid !== person.ownerLeaderUid && !sharedUids.includes(m.uid),
        )
      : [];
    return html`
      <app-modal .open=${!!person} heading=${heading} @close=${() => this._closeShare()}>
        ${person
          ? html`
              <div class="modal-body">
                <p>Comparte esta persona con otro manager para que colabore en su seguimiento.</p>
                ${sharedUids.length === 0
                  ? html`<p>Aún no la has compartido con nadie.</p>`
                  : html`<ul class="shared-list">
                      ${sharedUids.map(
                        (uid) => html`<li>
                          <span class="who">${this._leaderName(uid)}</span>
                          <span class="perm">${shared[uid] === 'edit' ? 'Puede editar' : 'Solo ver'}</span>
                          <button class="rm" type="button" @click=${() => this._unshare(uid)}>Quitar</button>
                        </li>`,
                      )}
                    </ul>`}
                <div class="fields">
                  <label>Manager
                    <select .value=${this._shareSel} @change=${(e) => { this._shareSel = e.target.value; }}>
                      <option value="">— Elige un manager —</option>
                      ${candidates.map((m) => html`<option value=${m.uid}>${m.displayName ?? m.email ?? m.uid}</option>`)}
                    </select>
                  </label>
                  <label>Permiso
                    <select .value=${this._sharePerm} @change=${(e) => { this._sharePerm = e.target.value; }}>
                      <option value="view">Solo ver</option>
                      <option value="edit">Puede editar</option>
                    </select>
                  </label>
                </div>
                ${this.error ? html`<p class="error">${this.error}</p>` : null}
                <div class="actions-row">
                  <button class="act" type="button" @click=${() => this._closeShare()}>Cerrar</button>
                  <button class="primary" type="button" ?disabled=${!this._shareSel} @click=${() => this._share()}>Compartir</button>
                </div>
              </div>
            `
          : null}
      </app-modal>
    `;
  }

  _renderTransferModal() {
    const person = this._transferFor;
    const heading = person ? `Transferir · ${person.name}` : 'Transferir';
    return html`
      <app-modal .open=${!!person} heading=${heading} @close=${() => this._closeTransfer()}>
        ${person ? this._renderTransferBody(person) : null}
      </app-modal>
    `;
  }

  /** Cuerpo del modal de transferencia (destino: otro manager o «sin manager»). */
  _renderTransferBody(person) {
    const candidates = (this.members ?? []).filter((m) => m.uid !== person.ownerLeaderUid);
    const isRelease = this._transferSel === RELEASE_OWNER;
    const confirmText = isRelease
      ? 'La persona quedará sin manager (solo el superadmin podrá gestionarla). ¿Confirmas?'
      : 'Perderás el acceso a esta persona. ¿Confirmas la transferencia?';
    const primaryLabel = this._transferPrimaryLabel(isRelease);
    const onPrimary = this._confirmTransfer ? () => this._transfer() : () => { this._confirmTransfer = true; };
    return html`
      <div class="modal-body">
        <p>Cede esta persona a otro manager, o suéltala para dejarla sin manager. Es una transferencia total: dejarás de tener acceso.</p>
        <div class="fields">
          <label>Nuevo dueño
            <select
              .value=${this._transferSel}
              @change=${(e) => { this._transferSel = e.target.value; this._confirmTransfer = false; }}
            >
              <option value="">— Elige un destino —</option>
              ${candidates.map((m) => html`<option value=${m.uid}>${m.displayName ?? m.email ?? m.uid}</option>`)}
              <option value=${RELEASE_OWNER}>— Sin manager (soltar) —</option>
            </select>
          </label>
        </div>
        ${this._confirmTransfer ? html`<p class="confirm-text">${confirmText}</p>` : null}
        ${this.error ? html`<p class="error">${this.error}</p>` : null}
        <div class="actions-row">
          <button class="act" type="button" @click=${() => this._closeTransfer()}>Cancelar</button>
          <button class="primary" type="button" ?disabled=${!this._confirmTransfer && !this._transferSel} @click=${onPrimary}>${primaryLabel}</button>
        </div>
      </div>
    `;
  }

  /** Texto del botón primario del modal de transferencia según el paso y el destino. */
  _transferPrimaryLabel(isRelease) {
    if (this._confirmTransfer) return isRelease ? 'Sí, soltar' : 'Sí, transferir';
    return isRelease ? 'Soltar' : 'Transferir';
  }

  render() {
    return html`
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
      <details class="add-card">
        <summary>Añadir persona</summary>
        <div class="body">
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
            <label class="chk-inline">
              <input type="checkbox" .checked=${this._external} @change=${(e) => { this._external = e.target.checked; }} />
              Es externo/a
            </label>
          </div>
          ${this._renderAccountSelect(this._selectedUid, (uid) => this._onSelectAltaAccount(uid))}
          ${this._renderDisciplineChecks(this._selectedDisciplines, (id, checked) => this._toggleDiscipline(id, checked))}
          ${this._renderLevelSelect(this._levelId, (id) => { this._levelId = id; })}
          <fieldset class="roles">
            <legend>Gremios</legend>
            <p class="eje-hint">Tecnología o stack que domina la persona (JavaScript, Python, Kubernetes…); no mide nivel.</p>
            <div class="role-checks">
              ${this.guilds.length === 0
                ? html`<span class="muted">Aún no hay gremios. Añade el primero abajo.</span>`
                : this.guilds.map(
                    (g) => html`
                      <label class="role-check">
                        <input
                          type="checkbox"
                          .checked=${this._selectedGuilds.includes(g.name)}
                          @change=${(e) => this._toggleGuild(g.name, e.target.checked)}
                        />
                        <span>${g.name}</span>
                      </label>
                    `,
                  )}
            </div>
            <div class="role-add">
              <input
                type="text"
                placeholder="Añadir un gremio nuevo (tuyo)…"
                .value=${this._newGuild}
                @input=${(e) => { this._newGuild = e.target.value; }}
                @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._addGuild(); } }}
              />
              <button type="button" @click=${this._addGuild}>Añadir gremio</button>
            </div>
          </fieldset>
          <fieldset class="roles">
            <legend>Labels</legend>
            <p class="eje-hint">Agrupación libre por equipo, squad o guardia.</p>
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
          <div class="actions-row">
            <button class="primary" type="submit">Añadir</button>
          </div>
        </form>
        </div>
      </details>

      <details open>
        <summary>Personas activas <span class="count">(${this.people.length})</span></summary>
        <div class="body">
        ${this._renderPeopleList()}
        </div>
      </details>

      ${this._renderShareModal()}
      ${this._renderTransferModal()}
    `;
  }
}

if (!customElements.get('team-people')) {
  customElements.define('team-people', TeamPeople);
}
