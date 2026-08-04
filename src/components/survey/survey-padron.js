/**
 * <survey-padron> — gestión del PADRÓN de empresa (RMR-TSK-0333). People
 * (superadmin o gestor de encuestas) mantiene la lista de personas y sus datos
 * (email, nombre, departamento, fecha de alta, fecha de nacimiento, ubicación),
 * que alimentan la segmentación de las encuestas. Importar CSV (upsert por
 * email), alta a mano, editar y borrar. Guarda la fecha de nacimiento (la edad se
 * calcula al vuelo en los dashboards).
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { skeletonLines } from '../app-skeleton.js';
import { parsePadron } from '../../tools/survey/domain/padron.js';
import { listPadron, addPadronPerson, updatePadronPerson, deletePadronPerson, importPadron } from '../../lib/padron.js';

const EMPTY = { id: null, email: '', name: '', department: '', hireDate: '', birthDate: '', location: '', active: true };

export class SurveyPadron extends LitElement {
  static properties = {
    _rows: { state: true },
    _loading: { state: true },
    _form: { state: true },
    _showForm: { state: true },
    _busy: { state: true },
    _notice: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); color: var(--rm-text, #1e3a5f); }
    h2 { font-size: 1.15rem; margin: 0 0 0.4rem; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; margin: 0 0 1rem; }
    button { font: inherit; cursor: pointer; border-radius: 8px; font-weight: 600; }
    .primary { background: var(--teal); border: 1px solid var(--teal); color: var(--rm-on-accent, #fff); padding: 0.5rem 1.1rem; }
    .primary:disabled { opacity: 0.5; cursor: default; }
    .ghost { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); padding: 0.4rem 0.8rem; font-size: 0.82rem; }
    .ghost:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .toolbar { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
    .toolbar input[type="file"] { font-size: 0.82rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 52rem; }
    th, td { text-align: left; padding: 0.5rem 0.55rem; border-bottom: 1px solid var(--rm-border, #eef0f2); white-space: nowrap; }
    th { color: var(--rm-muted, #5b6b7d); font-weight: 600; font-size: 0.78rem; }
    td.muted { color: var(--rm-muted, #5b6b7d); }
    .act { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 6px; padding: 0.2rem 0.55rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .act.danger:hover { border-color: #b42318; color: #b42318; }
    .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.7rem; margin: 0 0 1rem; padding: 0.9rem 1rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 10px; background: var(--rm-surface-hover, #f6f9fa); }
    .field { display: flex; flex-direction: column; gap: 0.25rem; }
    .field label { font-size: 0.78rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }
    input, select { padding: 0.45rem 0.6rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    input:focus, select:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    .form-actions { grid-column: 1 / -1; display: flex; gap: 0.7rem; }
    .notice { color: var(--rm-accent-700, var(--teal)); font-size: 0.85rem; }
    .error { color: #b42318; font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; padding: 0.5rem 0; }
  `;

  constructor() {
    super();
    this._rows = [];
    this._loading = false;
    this._form = { ...EMPTY };
    this._showForm = false;
    this._busy = false;
    this._notice = '';
    this._error = '';
    this._loaded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._loaded) { this._loaded = true; this._load(); }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._rows = await listPadron();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el padrón.';
    } finally {
      this._loading = false;
    }
  }

  async _onCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    this._busy = true;
    this._error = '';
    this._notice = '';
    try {
      const rows = parsePadron(await file.text());
      if (!rows.length) { this._error = 'El CSV no tiene ninguna fila con email válido.'; return; }
      const { added, updated } = await importPadron(rows);
      this._notice = `Padrón actualizado: ${added} nueva${added === 1 ? '' : 's'}, ${updated} actualizada${updated === 1 ? '' : 's'}.`;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo importar el CSV.';
    } finally {
      this._busy = false;
    }
  }

  _new() { this._form = { ...EMPTY }; this._showForm = true; this._notice = ''; this._error = ''; }
  _edit(row) { this._form = { ...EMPTY, ...row }; this._showForm = true; this._notice = ''; this._error = ''; }
  _cancelForm() { this._showForm = false; this._form = { ...EMPTY }; }
  _set(key, value) { this._form = { ...this._form, [key]: value }; }

  async _save() {
    const email = String(this._form.email ?? '').trim();
    if (!email.includes('@')) { this._error = 'El email no es válido.'; return; }
    this._busy = true;
    this._error = '';
    try {
      const { id, ...data } = this._form;
      if (id) await updatePadronPerson(id, data);
      else await addPadronPerson(data);
      this._showForm = false;
      this._form = { ...EMPTY };
      this._notice = 'Padrón guardado.';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar.';
    } finally {
      this._busy = false;
    }
  }

  async _delete(row) {
    try {
      await deletePadronPerson(row.id);
      this._rows = this._rows.filter((r) => r.id !== row.id);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar.';
    }
  }

  _renderForm() {
    const f = this._form;
    const fields = [
      ['email', 'Email', 'email'],
      ['name', 'Nombre', 'text'],
      ['department', 'Departamento', 'text'],
      ['hireDate', 'Fecha de alta', 'date'],
      ['birthDate', 'Fecha de nacimiento', 'date'],
      ['location', 'Ubicación', 'text'],
    ];
    return html`<div class="form">
      ${fields.map(([key, label, type]) => html`<div class="field">
        <label for=${key}>${label}</label>
        <input id=${key} type=${type} .value=${f[key] ?? ''} @input=${(e) => this._set(key, e.target.value)} />
      </div>`)}
      <div class="field">
        <label for="active">Estado</label>
        <select id="active" @change=${(e) => this._set('active', e.target.value === 'true')}>
          <option value="true" ?selected=${f.active !== false}>Activo</option>
          <option value="false" ?selected=${f.active === false}>Baja</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="primary" ?disabled=${this._busy} @click=${() => this._save()}>${f.id ? 'Guardar cambios' : 'Añadir'}</button>
        <button class="ghost" @click=${() => this._cancelForm()}>Cancelar</button>
      </div>
    </div>`;
  }

  render() {
    return html`
      ${this._busy ? html`<busy-overlay message="Guardando el padrón…"></busy-overlay>` : null}
      <h2>Padrón de empresa</h2>
      <p class="lead">Las personas y sus datos alimentan la segmentación de las encuestas. Importa el CSV (upsert por email), añade a mano, edita o borra. Se guarda la fecha de nacimiento; la edad se calcula sola.</p>
      <div class="toolbar">
        <button class="primary" @click=${() => this._new()}>Añadir persona</button>
        <label class="ghost">Importar CSV <input type="file" accept=".csv,text/csv,text/plain" @change=${(e) => this._onCsv(e)} hidden /></label>
        ${this._busy ? html`<span class="lead">Procesando…</span>` : null}
      </div>
      ${this._notice ? html`<p class="notice">${this._notice}</p>` : null}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._showForm ? this._renderForm() : null}
      ${this._loading ? skeletonLines(5) : this._rows.length ? html`
        <div class="table-wrap"><table>
          <thead><tr><th>Email</th><th>Nombre</th><th>Departamento</th><th>Alta</th><th>Nacimiento</th><th>Ubicación</th><th>Estado</th><th></th></tr></thead>
          <tbody>${this._rows.map((r) => html`<tr>
            <td>${r.email}</td>
            <td>${r.name || '—'}</td>
            <td>${r.department || '—'}</td>
            <td class="muted">${r.hireDate || '—'}</td>
            <td class="muted">${r.birthDate || '—'}</td>
            <td>${r.location || '—'}</td>
            <td>${r.active === false ? 'Baja' : 'Activo'}</td>
            <td><button class="act" @click=${() => this._edit(r)}>Editar</button>
              <button class="act danger" @click=${() => this._delete(r)}>Borrar</button></td>
          </tr>`)}</tbody>
        </table></div>
        <p class="lead">${this._rows.length} persona${this._rows.length === 1 ? '' : 's'} en el padrón.</p>`
        : html`<p class="empty">El padrón está vacío. Importa el CSV o añade a mano.</p>`}`;
  }
}

if (!customElements.get('survey-padron')) {
  customElements.define('survey-padron', SurveyPadron);
}
