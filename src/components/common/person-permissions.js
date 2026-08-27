/**
 * Matriz de permisos de UNA persona (RMR-TSK-0460).
 *
 * Hay dos puertas a esto —Administración › Permisos y la ficha de la persona—
 * porque cada uno entra por donde está mirando: quien administra busca
 * «permisos», y quien está viendo a alguien quiere ver los suyos ahí mismo.
 * Dos puertas, sí; dos implementaciones, no: ya habían divergido (la del panel
 * perdió la columna «Gestiona» sin que nadie se enterara), así que ambas montan
 * este componente.
 *
 * Quién persiste es cosa del host: recibe `save(personId, toolOverrides)` porque
 * la ficha escribe con `updatePerson` y el panel con su capa de persistencia.
 * Del borrador, el rollback y el aviso de error se encarga este componente.
 *
 *   <person-permissions .person=${p} .policies=${pols} .save=${fn}></person-permissions>
 */
import { LitElement, html, css } from 'lit';
import { noteStyles } from './note-styles.js';
import { effectiveToolAccess, applyOverride, overrideMode } from '../../tools/team/domain/toolAccess.js';

export class PersonPermissions extends LitElement {
  static properties = {
    /** @type {{ id: string, orgRole?: string|null, orgBranch?: string|null, toolOverrides?: Record<string, any> }|null} */
    person: { attribute: false },
    /** @type {Array<{ toolId: string, label?: string }>} */
    policies: { attribute: false },
    /** @type {(personId: string, toolOverrides: Record<string, any>) => Promise<void>} */
    save: { attribute: false },
    readOnly: { type: Boolean, attribute: 'read-only' },
    _draft: { state: true },
    _error: { state: true },
    _saved: { state: true },
  };

  static styles = [noteStyles, css`
    :host { display: block; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    select {
      padding: 0.3rem 0.5rem; border-radius: 8px; font: inherit; font-size: 0.85rem;
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827);
    }
    .table-wrap { overflow-x: auto; }
    .muted { color: var(--rm-muted, #6b7280); }
    .empty { color: var(--rm-muted, #6b7280); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; margin: 0 0 0.6rem; }
    .saved { color: var(--rm-ok, #15803d); font-size: 0.85rem; margin: 0 0 0.6rem; }
  `];

  constructor() {
    super();
    this.person = null;
    this.policies = [];
    this.save = null;
    this.readOnly = false;
    this._draft = {};
    this._error = '';
    this._saved = false;
  }

  /** El borrador se resiembra al cambiar de persona: si no, se editaría a la anterior. */
  willUpdate(changed) {
    if (changed.has('person') && changed.get('person')?.id !== this.person?.id) {
      this._draft = structuredClone(this.person?.toolOverrides ?? {});
      this._error = '';
      this._saved = false;
    }
  }

  /** Referencia de la persona SIN excepciones: lo que hereda de su rol y su rama. */
  get _roleRef() {
    const p = this.person;
    return { personId: p?.id ?? null, branch: p?.orgBranch ?? 'generico', roleId: p?.orgRole ?? null };
  }

  /**
   * Cambia una excepción y la persiste. Optimista con rollback: la tabla
   * responde al instante, y si la escritura falla vuelve a lo que había en vez
   * de quedarse enseñando un permiso que no existe.
   * @param {string} toolId
   * @param {'use'|'manage'} dim
   * @param {'yes'|'no'|'inherit'} mode
   */
  async _set(toolId, dim, mode) {
    if (!this.person || !this.save) return;
    const antes = this._draft;
    const draft = applyOverride(antes, toolId, dim, mode);
    this._draft = draft;
    this._error = '';
    this._saved = false;
    try {
      await this.save(this.person.id, draft);
      this._saved = true;
      this.dispatchEvent(new CustomEvent('permissions-saved', {
        detail: { personId: this.person.id, toolOverrides: draft }, bubbles: true, composed: true,
      }));
    } catch (err) {
      this._draft = antes;
      this._error = err instanceof Error ? err.message : 'No se pudo guardar el permiso.';
    }
  }

  /** Celda tri-estado. La etiqueta de «heredar» dice qué pasa si no tocas nada. */
  _cell(toolId, dim, heredado) {
    const mode = overrideMode(this._draft, toolId, dim);
    return html`<select ?disabled=${this.readOnly} aria-label="${dim === 'use' ? 'Ve o usa' : 'Gestiona'}"
      @change=${(e) => this._set(toolId, dim, e.target.value)}>
      <option value="inherit" ?selected=${mode === 'inherit'}>Heredar (${heredado ? 'sí' : 'no'})</option>
      <option value="yes" ?selected=${mode === 'yes'}>Sí</option>
      <option value="no" ?selected=${mode === 'no'}>No</option>
    </select>`;
  }

  render() {
    const p = this.person;
    if (!p) return html`<p class="empty">Elige a una persona para ver y cambiar sus permisos.</p>`;
    const policies = this.policies ?? [];
    if (policies.length === 0) return html`<p class="empty">No hay herramientas configuradas todavía.</p>`;
    const roleRef = this._roleRef;
    return html`
      <p class="info-note">
        Qué <strong>ve</strong> y qué <strong>gestiona</strong> esta persona. Por defecto hereda de su
        rol${p.orgRole ? html` (<strong>${p.orgRole}</strong>)` : ''}; aquí se fuerza una excepción solo
        para ella —por ejemplo, dejarle ver algo de otra área sin moverla de sitio en el organigrama—.
      </p>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this._saved ? html`<p class="saved">Guardado.</p>` : null}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Herramienta</th><th>Ve / usa</th><th>Gestiona</th></tr></thead>
          <tbody>
            ${policies.map((pol) => {
              const def = effectiveToolAccess({ ...roleRef, toolOverrides: {} }, pol);
              return html`<tr>
                <td>${pol.label ?? pol.toolId} <span class="muted">(${pol.toolId})</span></td>
                <td>${this._cell(pol.toolId, 'use', def.use.value)}</td>
                <td>${this._cell(pol.toolId, 'manage', def.manage.value)}</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>`;
  }
}

if (!customElements.get('person-permissions')) {
  customElements.define('person-permissions', PersonPermissions);
}
