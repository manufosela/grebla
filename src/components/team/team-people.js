/**
 * <team-people>
 * Sección de personas: lista de personas activas, alta (nombre, rol funcional,
 * fecha de inicio) y baja (active=false, sin borrar histórico). Usa los casos de
 * uso de la capa de aplicación; nunca toca persistencia ni dominio directamente.
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 *  - members: Leader[] (líderes de la instancia, para compartir/transferir)
 *  - currentUid: string (uid del líder en sesión)
 *  - isAdmin: boolean
 */
import { LitElement, html, css } from 'lit';
import '../app-modal.js';
import {
  addPerson,
  listActivePeople,
  deactivatePerson,
  updatePerson,
  sharePerson,
  unsharePerson,
  transferOwnership,
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
    members: { attribute: false },
    currentUid: { attribute: false },
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
    _shareFor: { state: true },
    _shareSel: { state: true },
    _sharePerm: { state: true },
    _transferFor: { state: true },
    _transferSel: { state: true },
    _confirmTransfer: { state: true },
    _editFor: { state: true },
    _editRoles: { state: true },
    _editLabels: { state: true },
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
    .modal-body select { padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem; }
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
    /** @type {import('../../lib/leaders.js').Leader[]} líderes de la instancia (compartir/transferir) */
    this.members = [];
    /** @type {string|null} uid del líder en sesión */
    this.currentUid = null;
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
    /** @type {import('../../tools/team/domain/types.js').Person|null} persona del modal Compartir */
    this._shareFor = null;
    /** @type {string} líder seleccionado en el modal Compartir */
    this._shareSel = '';
    /** @type {import('../../tools/team/domain/types.js').SharePermission} */
    this._sharePerm = 'view';
    /** @type {import('../../tools/team/domain/types.js').Person|null} persona del modal Transferir */
    this._transferFor = null;
    /** @type {string} nuevo dueño seleccionado en el modal Transferir */
    this._transferSel = '';
    /** @type {boolean} confirmación de transferencia */
    this._confirmTransfer = false;
    /** @type {import('../../tools/team/domain/types.js').Person|null} persona del modal Editar */
    this._editFor = null;
    /** @type {string[]} roles seleccionados en el modal Editar */
    this._editRoles = [];
    /** @type {string[]} labels seleccionados en el modal Editar */
    this._editLabels = [];
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
        <button class="act" type="button" @click=${() => this._openEdit(person)}>Editar</button>
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
    const uid = this._transferSel;
    if (!person || !uid) return;
    this.error = '';
    try {
      await transferOwnership(this.persistence, person.id, uid);
      this._transferFor = null;
      this._transferSel = '';
      this._confirmTransfer = false;
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo transferir.';
    }
  }

  // ---- Editar roles / labels ----
  _openEdit(person) {
    this._editFor = person;
    this._editRoles = [...(person.teamRoles ?? [])];
    this._editLabels = [...(person.labels ?? [])];
    this.error = '';
  }

  _closeEdit() {
    this._editFor = null;
    this.error = '';
  }

  _toggleEditRole(name, checked) {
    this._editRoles = checked
      ? [...this._editRoles, name]
      : this._editRoles.filter((r) => r !== name);
  }

  _toggleEditLabel(name, checked) {
    this._editLabels = checked
      ? [...this._editLabels, name]
      : this._editLabels.filter((l) => l !== name);
  }

  async _saveEdit() {
    const person = this._editFor;
    if (!person) return;
    this.error = '';
    try {
      await updatePerson(this.persistence, person.id, {
        teamRoles: [...this._editRoles],
        labels: [...this._editLabels],
      });
      this._editFor = null;
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar los cambios.';
    }
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
                <p>Comparte esta persona con otro líder para que colabore en su seguimiento.</p>
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
                  <label>Líder
                    <select .value=${this._shareSel} @change=${(e) => { this._shareSel = e.target.value; }}>
                      <option value="">— Elige un líder —</option>
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
    const candidates = person
      ? (this.members ?? []).filter((m) => m.uid !== person.ownerLeaderUid)
      : [];
    return html`
      <app-modal .open=${!!person} heading=${heading} @close=${() => this._closeTransfer()}>
        ${person
          ? html`
              <div class="modal-body">
                <p>Cede esta persona a otro líder. Es una transferencia total: dejarás de tener acceso.</p>
                <div class="fields">
                  <label>Nuevo dueño
                    <select
                      .value=${this._transferSel}
                      @change=${(e) => { this._transferSel = e.target.value; this._confirmTransfer = false; }}
                    >
                      <option value="">— Elige un líder —</option>
                      ${candidates.map((m) => html`<option value=${m.uid}>${m.displayName ?? m.email ?? m.uid}</option>`)}
                    </select>
                  </label>
                </div>
                ${this._confirmTransfer
                  ? html`<p class="confirm-text">Perderás el acceso a esta persona. ¿Confirmas la transferencia?</p>`
                  : null}
                ${this.error ? html`<p class="error">${this.error}</p>` : null}
                <div class="actions-row">
                  <button class="act" type="button" @click=${() => this._closeTransfer()}>Cancelar</button>
                  ${this._confirmTransfer
                    ? html`<button class="primary" type="button" @click=${() => this._transfer()}>Sí, transferir</button>`
                    : html`<button class="primary" type="button" ?disabled=${!this._transferSel} @click=${() => { this._confirmTransfer = true; }}>Transferir</button>`}
                </div>
              </div>
            `
          : null}
      </app-modal>
    `;
  }

  _renderEditModal() {
    const person = this._editFor;
    const heading = person ? `Editar · ${person.name}` : 'Editar';
    return html`
      <app-modal .open=${!!person} heading=${heading} @close=${() => this._closeEdit()}>
        ${person
          ? html`
              <div class="modal-body">
                <p>Roles y labels de esta persona.</p>
                <fieldset class="roles">
                  <legend>Roles en el equipo</legend>
                  <div class="edit-checks">
                    ${this.roles.length === 0
                      ? html`<span class="muted">Aún no hay roles.</span>`
                      : this.roles.map(
                          (r) => html`
                            <label class="role-check">
                              <input
                                type="checkbox"
                                .checked=${this._editRoles.includes(r.name)}
                                @change=${(e) => this._toggleEditRole(r.name, e.target.checked)}
                              />
                              <span>${r.name}</span>
                            </label>
                          `,
                        )}
                  </div>
                </fieldset>
                <fieldset class="roles">
                  <legend>Labels (gremios / equipos)</legend>
                  <div class="edit-checks">
                    ${this.labels.length === 0
                      ? html`<span class="muted">Aún no hay labels.</span>`
                      : this.labels.map(
                          (l) => html`
                            <label class="role-check">
                              <input
                                type="checkbox"
                                .checked=${this._editLabels.includes(l.name)}
                                @change=${(e) => this._toggleEditLabel(l.name, e.target.checked)}
                              />
                              <span>${l.name}</span>
                            </label>
                          `,
                        )}
                  </div>
                </fieldset>
                ${this.error ? html`<p class="error">${this.error}</p>` : null}
                <div class="actions-row">
                  <button class="act" type="button" @click=${() => this._closeEdit()}>Cancelar</button>
                  <button class="primary" type="button" @click=${() => this._saveEdit()}>Guardar</button>
                </div>
              </div>
            `
          : null}
      </app-modal>
    `;
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
          <div class="actions-row">
            <button class="primary" type="submit">Añadir</button>
          </div>
        </form>
        </div>
      </details>

      <details open>
        <summary>Personas activas <span class="count">(${this.people.length})</span></summary>
        <div class="body">
        ${this.loading
          ? html`<p class="empty">Cargando…</p>`
          : this.people.length === 0
            ? html`<p class="empty">Aún no has añadido a nadie. Despliega «Añadir persona» para empezar.</p>`
            : html`
                <table>
                  <thead>
                    <tr><th>Nombre</th><th>Roles</th><th>Labels</th><th>Desde</th><th>Acciones</th></tr>
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
        </div>
      </details>

      ${this._renderShareModal()}
      ${this._renderTransferModal()}
      ${this._renderEditModal()}
    `;
  }
}

if (!customElements.get('team-people')) {
  customElements.define('team-people', TeamPeople);
}
