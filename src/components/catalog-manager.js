/**
 * <catalog-manager> — gestión ÚNICA de un catálogo con ámbito (areas|guilds|
 * labels). Se reutiliza en Ajustes del Equipo (líder) y en el panel de superadmin,
 * para no tener dos UIs divergentes de lo mismo. Una sola capa de datos: la
 * fachada de usecases del tool Equipo (rename cascadea a /people en gremios/labels).
 *
 * Props:
 *  - persistence  puerto de Equipo (líder → sus personales; superadmin viewAll → todos)
 *  - kind         'areas' | 'guilds' | 'labels'
 *  - isAdmin      superadmin: gestiona globales y promueve personales
 *  - currentUid   uid del que mira (para decidir quién edita un personal)
 *  - readOnly     viewer: solo lectura
 *  - leaders      opcional [{uid, displayName?, email?}] para mostrar el dueño de un personal
 *  - title / placeholder  textos de la sección
 */
import { LitElement, html, css } from 'lit';
import {
  listCatalog, addCatalog, renameCatalog, removeCatalog, promoteCatalog,
} from '../tools/team/application/usecases/catalog.js';

export class CatalogManager extends LitElement {
  static properties = {
    persistence: { attribute: false },
    kind: { type: String },
    isAdmin: { attribute: false },
    currentUid: { attribute: false },
    readOnly: { attribute: false },
    leaders: { attribute: false },
    title: { type: String },
    placeholder: { type: String },
    _items: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _new: { state: true },
    _editingId: { state: true },
    _editName: { state: true },
    _confirmId: { state: true },
  };

  static styles = css`
    :host { display: block; }
    h3 { font-size: 1rem; margin: 0 0 0.6rem; }
    .toolbar { display: flex; gap: 0.5rem; margin: 0 0 0.8rem; flex-wrap: wrap; }
    input[type='text'], .edit-in {
      font: inherit; padding: 0.4rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db);
      border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    .toolbar input { min-width: 14rem; }
    .btn {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.35rem 0.75rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sub { font-size: 0.78rem; font-weight: 700; color: var(--rm-muted, #6b7280); margin: 0.9rem 0 0.3rem; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    li { display: flex; align-items: center; gap: 0.5rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.4rem 0.7rem; }
    .name { font-size: 0.92rem; }
    .badge { font-size: 0.68rem; border-radius: 999px; padding: 0.05rem 0.45rem; background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f); }
    .owner { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
    .spacer { flex: 1; }
    .actions { display: flex; gap: 0.35rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.88rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.kind = 'labels';
    this.isAdmin = false;
    this.currentUid = null;
    this.readOnly = false;
    this.leaders = null;
    this.title = '';
    this.placeholder = 'Nuevo…';
    this._items = [];
    this._loading = false;
    this._error = '';
    this._new = '';
    this._editingId = null;
    this._editName = '';
    this._confirmId = null;
    this._loaded = false;
  }

  updated(changed) {
    // Recarga si cambia la persistencia (inyectada por el host) o el kind.
    if ((changed.has('persistence') || changed.has('kind')) && this.persistence) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._items = await listCatalog(this.persistence, this.kind);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el catálogo.';
    } finally {
      this._loading = false;
    }
  }

  /** ¿Puede el que mira gestionar (editar/borrar) este item? */
  _canManage(item) {
    if (this.readOnly) return false;
    return item.ownerLeaderUid ? (item.ownerLeaderUid === this.currentUid || this.isAdmin) : this.isAdmin;
  }

  async _add() {
    const name = this._new.trim();
    if (!name) return;
    this._error = '';
    try {
      await addCatalog(this.persistence, this.kind, name);
      this._new = '';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear.';
    }
  }

  _startEdit(item) {
    this._editingId = item.id;
    this._editName = item.name;
    this._confirmId = null;
  }

  async _saveRename() {
    const name = this._editName.trim();
    if (!name || !this._editingId) return;
    this._error = '';
    try {
      await renameCatalog(this.persistence, this.kind, this._editingId, name);
      this._editingId = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo renombrar.';
    }
  }

  async _remove(id) {
    this._error = '';
    try {
      await removeCatalog(this.persistence, this.kind, id);
      this._confirmId = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo eliminar.';
    }
  }

  async _promote(id) {
    this._error = '';
    try {
      await promoteCatalog(this.persistence, this.kind, id);
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo promover.';
    }
  }

  _ownerName(uid) {
    const l = (this.leaders ?? []).find((x) => x.uid === uid);
    return l?.displayName ?? l?.email ?? uid;
  }

  render() {
    const globals = this._items.filter((i) => !i.ownerLeaderUid);
    const personals = this._items.filter((i) => i.ownerLeaderUid);
    return html`
      ${this.title ? html`<h3>${this.title}</h3>` : null}
      ${this.readOnly ? null : this._renderAdd()}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._loading ? html`<p class="empty">Cargando…</p>` : this._renderLists(globals, personals)}
    `;
  }

  _renderAdd() {
    return html`<div class="toolbar">
      <input
        type="text"
        placeholder=${this.placeholder}
        .value=${this._new}
        @input=${(e) => { this._new = e.target.value; }}
        @keydown=${(e) => { if (e.key === 'Enter') this._add(); }}
      />
      <button class="btn primary" ?disabled=${!this._new.trim()} @click=${() => this._add()}>
        ${this.isAdmin ? 'Crear global' : 'Añadir'}
      </button>
    </div>`;
  }

  _renderLists(globals, personals) {
    const globalItems = globals.map((i) => this._renderItem(i, false));
    const personalItems = personals.map((i) => this._renderItem(i, true));
    return html`
      <p class="sub">Globales</p>
      ${globals.length ? html`<ul>${globalItems}</ul>` : html`<p class="empty">Aún no hay globales.</p>`}
      ${personals.length
        ? html`<p class="sub">Personales de líderes</p><ul>${personalItems}</ul>`
        : null}
    `;
  }

  _renderItem(item, isPersonal) {
    if (this._editingId === item.id) {
      return html`<li>
        <input
          class="edit-in"
          type="text"
          .value=${this._editName}
          @input=${(e) => { this._editName = e.target.value; }}
          @keydown=${(e) => {
            if (e.key === 'Enter') this._saveRename();
            else if (e.key === 'Escape') { this._editingId = null; }
          }}
        />
        <button class="btn primary" @click=${() => this._saveRename()}>Guardar</button>
        <button class="btn" @click=${() => { this._editingId = null; }}>Cancelar</button>
      </li>`;
    }
    const owner = isPersonal && this.leaders ? html`<span class="owner">${this._ownerName(item.ownerLeaderUid)}</span>` : null;
    return html`<li>
      <span class="name">${item.name}</span>
      ${isPersonal ? null : html`<span class="badge">Global</span>`}
      ${owner}
      <span class="spacer"></span>
      <div class="actions">${this._renderActions(item, isPersonal)}</div>
    </li>`;
  }

  _renderActions(item, isPersonal) {
    if (!this._canManage(item)) return null;
    const promote = isPersonal && this.isAdmin
      ? html`<button class="btn" @click=${() => this._promote(item.id)}>Promover a global</button>`
      : null;
    const del = this._confirmId === item.id
      ? html`<button class="btn danger" @click=${() => this._remove(item.id)}>Confirmar</button>
             <button class="btn" @click=${() => { this._confirmId = null; }}>Cancelar</button>`
      : html`<button class="btn" @click=${() => this._startEdit(item)}>Editar</button>
             <button class="btn danger" @click=${() => { this._confirmId = item.id; }}>Borrar</button>`;
    return html`${promote}${del}`;
  }
}

if (!customElements.get('catalog-manager')) {
  customElements.define('catalog-manager', CatalogManager);
}
