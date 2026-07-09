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
 *  - withMeta     activa sub-label y color por item (solo para labels)
 *  - title / placeholder  textos de la sección
 */
import { LitElement, html, css } from 'lit';
import {
  listCatalog, addCatalog, renameCatalog, removeCatalog, promoteCatalog, updateCatalogMeta,
} from '../tools/team/application/usecases/catalog.js';

export class CatalogManager extends LitElement {
  static properties = {
    persistence: { attribute: false },
    kind: { type: String },
    isAdmin: { attribute: false },
    currentUid: { attribute: false },
    readOnly: { attribute: false },
    leaders: { attribute: false },
    withMeta: { attribute: false },
    title: { type: String },
    placeholder: { type: String },
    _items: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _new: { state: true },
    _newSub: { state: true },
    _newColor: { state: true },
    _editingId: { state: true },
    _editName: { state: true },
    _editSub: { state: true },
    _editColor: { state: true },
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
    .swatch { width: 0.85rem; height: 0.85rem; border-radius: 999px; border: 1px solid rgba(0, 0, 0, 0.15); flex: none; }
    .label-col { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
    .name { font-size: 0.92rem; }
    .sublabel { font-size: 0.72rem; color: var(--rm-muted, #6b7280); }
    .color-in { width: 2.2rem; height: 2rem; padding: 0.1rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; background: var(--rm-surface, #fff); cursor: pointer; }
    .toolbar .sub-in { min-width: 12rem; }
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
    this.withMeta = false;
    this.title = '';
    this.placeholder = 'Nuevo…';
    this._items = [];
    this._loading = false;
    this._error = '';
    this._new = '';
    this._newSub = '';
    this._newColor = '';
    this._editingId = null;
    this._editName = '';
    this._editSub = '';
    this._editColor = '';
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
      const extra = this.withMeta ? { subLabel: this._newSub, color: this._newColor } : {};
      await addCatalog(this.persistence, this.kind, name, extra);
      this._new = '';
      this._newSub = '';
      this._newColor = '';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear.';
    }
  }

  _startEdit(item) {
    this._editingId = item.id;
    this._editName = item.name;
    this._editSub = item.subLabel ?? '';
    this._editColor = item.color ?? '';
    this._confirmId = null;
  }

  async _saveRename() {
    const name = this._editName.trim();
    if (!name || !this._editingId) return;
    this._error = '';
    try {
      const id = this._editingId;
      await renameCatalog(this.persistence, this.kind, id, name);
      // El nombre cascadea a /people; los metadatos (subLabel/color) no.
      if (this.withMeta) {
        await updateCatalogMeta(this.persistence, this.kind, id, { subLabel: this._editSub, color: this._editColor });
      }
      this._editingId = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar.';
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
      ${this.withMeta ? this._renderMetaInputs('_new') : null}
      <button class="btn primary" ?disabled=${!this._new.trim()} @click=${() => this._add()}>
        ${this.isAdmin ? 'Crear global' : 'Añadir'}
      </button>
    </div>`;
  }

  /** Inputs de sub-label + color. `prefix` es '_new' (alta) o '_edit' (edición). */
  _renderMetaInputs(prefix) {
    const sub = prefix === '_new' ? this._newSub : this._editSub;
    const color = prefix === '_new' ? this._newColor : this._editColor;
    const setSub = (v) => { if (prefix === '_new') this._newSub = v; else this._editSub = v; };
    const setColor = (v) => { if (prefix === '_new') this._newColor = v; else this._editColor = v; };
    return html`
      <input
        type="text" class="sub-in" placeholder="Sub-label (opcional)"
        .value=${sub} @input=${(e) => setSub(e.target.value)}
      />
      <input
        type="color" class="color-in" title="Color (opcional)"
        .value=${color || '#e5e7eb'} @input=${(e) => setColor(e.target.value)}
      />
      ${color ? html`<button class="btn" title="Sin color" @click=${() => setColor('')}>×</button>` : null}
    `;
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
        ${this.withMeta ? this._renderMetaInputs('_edit') : null}
        <button class="btn primary" @click=${() => this._saveRename()}>Guardar</button>
        <button class="btn" @click=${() => { this._editingId = null; }}>Cancelar</button>
      </li>`;
    }
    const owner = isPersonal && this.leaders ? html`<span class="owner">${this._ownerName(item.ownerLeaderUid)}</span>` : null;
    const swatchStyle = `background:${item.color}`;
    const liStyle = item.color ? `border-left:4px solid ${item.color}` : '';
    const swatch = item.color ? html`<span class="swatch" style=${swatchStyle}></span>` : null;
    const sub = item.subLabel ? html`<span class="sublabel">${item.subLabel}</span>` : null;
    return html`<li style=${liStyle}>
      ${swatch}
      <span class="label-col">
        <span class="name">${item.name}</span>
        ${sub}
      </span>
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
