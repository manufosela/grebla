/**
 * <team-departures>
 * Sección "Bajas": personas dadas de baja (no se borran, conservan su histórico)
 * con su fecha de alta y de baja, más una tarjeta con la tasa de rotación del
 * equipo en los últimos 12 meses. Agregado, no compara personas (R3).
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 */
import { LitElement, html, css } from 'lit';
import { listDepartedPeople, getTurnover } from '../../tools/team/application/usecases/index.js';
import { deletePerson } from '../../lib/people.js';

const MS_YEAR = 365 * 86_400_000;
const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** @param {string} iso */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export class TeamDepartures extends LitElement {
  static properties = {
    persistence: { attribute: false },
    departed: { state: true },
    turnover: { state: true },
    loading: { state: true },
    error: { state: true },
    _confirmFor: { state: true },
    _confirmName: { state: true },
    _deleting: { state: true },
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
    .stats { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .stat { display: flex; flex-direction: column; gap: 0.2rem; }
    .stat .value { font-size: 1.6rem; font-weight: 800; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .stat .label { font-size: 0.78rem; color: var(--rm-muted, #6b7280); }
    .period { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin-top: 0.75rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .hint { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; }
    .act-cell { text-align: right; }
    button.danger { border: 1px solid var(--rm-danger, #dc2626); color: var(--rm-danger, #dc2626); background: var(--rm-surface, #fff); border-radius: 999px; padding: 0.3rem 0.7rem; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
    button.danger:hover:not(:disabled) { background: var(--rm-danger, #dc2626); color: #fff; }
    button.danger:disabled { opacity: 0.5; cursor: not-allowed; }
    .del-backdrop { position: fixed; inset: 0; z-index: 70; background: rgba(17, 24, 39, 0.5); display: flex; align-items: center; justify-content: center; }
    .del-dialog { width: min(460px, calc(100% - 2rem)); background: var(--rm-surface, #fff); border-radius: 12px; padding: 1.2rem 1.4rem; box-shadow: 0 16px 44px rgba(17, 24, 39, 0.35); }
    .del-dialog h3 { margin: 0 0 0.6rem; color: var(--rm-danger, #dc2626); }
    .del-dialog p { font-size: 0.88rem; margin: 0 0 0.6rem; }
    .del-hint { color: var(--rm-muted, #6b7280); }
    .del-dialog input { width: 100%; box-sizing: border-box; font: inherit; padding: 0.5rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; }
    .del-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .del-actions .act { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); border-radius: 8px; padding: 0.45rem 0.9rem; cursor: pointer; }
    .del-actions .danger { border-radius: 8px; padding: 0.45rem 0.9rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person[]} */
    this.departed = [];
    this.turnover = null;
    this.loading = true;
    this.error = '';
    this._loaded = false;
    /** @type {import('../../tools/team/domain/types.js').Person|null} persona en confirmación de borrado */
    this._confirmFor = null;
    /** @type {string} nombre tecleado para confirmar el borrado */
    this._confirmName = '';
    this._deleting = false;
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
      const now = new Date();
      const from = new Date(now.getTime() - MS_YEAR);
      const [departed, turnover] = await Promise.all([
        listDepartedPeople(this.persistence),
        getTurnover(this.persistence, { from: from.toISOString(), to: now.toISOString() }),
      ]);
      this.departed = departed;
      this.turnover = turnover;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar las bajas.';
    } finally {
      this.loading = false;
    }
  }

  /** Abre la confirmación de borrado definitivo de una baja. */
  _openConfirm(person) {
    this._confirmFor = person;
    this._confirmName = '';
    this.error = '';
  }

  _closeConfirm() {
    this._confirmFor = null;
    this._confirmName = '';
  }

  /** Borra DEFINITIVAMENTE (Cloud Function recursiveDelete) tras confirmar por
   * nombre. Solo se habilita si el nombre tecleado coincide. */
  async _doDelete() {
    const person = this._confirmFor;
    if (!person) return;
    if (this._confirmName.trim() !== person.name) return;
    this._deleting = true;
    this.error = '';
    try {
      await deletePerson(person.id);
      this._confirmFor = null;
      this._confirmName = '';
      await this._load(); // desaparece de la lista y de las estadísticas
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo borrar la persona.';
    } finally {
      this._deleting = false;
    }
  }

  render() {
    if (this.loading) return html`<p class="empty">Cargando…</p>`;
    if (this.error) return html`<p class="error">${this.error}</p>`;
    const t = this.turnover;
    return html`
      <section>
        <h2>Rotación del equipo</h2>
        <div class="stats">
          <div class="stat"><span class="value">${t ? `${Math.round(t.turnoverRate)}%` : '—'}</span><span class="label">Tasa de rotación</span></div>
          <div class="stat"><span class="value">${t?.departures ?? 0}</span><span class="label">Bajas</span></div>
          <div class="stat"><span class="value">${t?.hires ?? 0}</span><span class="label">Altas</span></div>
          <div class="stat"><span class="value">${t ? Math.round(t.avgHeadcount) : 0}</span><span class="label">Plantilla media</span></div>
        </div>
        <p class="period">Periodo: últimos 12 meses${t ? ` (${formatDate(t.from)} – ${formatDate(t.to)})` : ''}.</p>
      </section>

      <section>
        <h2>Personas dadas de baja (${this.departed.length})</h2>
        ${this.error ? html`<p class="error">${this.error}</p>` : null}
        <p class="hint">La baja conserva el histórico (fuera de las estadísticas activas). <strong>Borrar definitivamente</strong> elimina a la persona y TODOS sus datos (plan de carrera, valoraciones, lecturas…): irreversible.</p>
        ${this.departed.length === 0
          ? html`<p class="empty">No hay bajas registradas.</p>`
          : html`
              <table>
                <thead>
                  <tr><th>Nombre</th><th>Gremios</th><th>Alta</th><th>Baja</th><th></th></tr>
                </thead>
                <tbody>
                  ${this.departed.map(
                    (p) => html`
                      <tr>
                        <td>${p.name}</td>
                        <td>
                          ${(p.guilds ?? []).length === 0
                            ? html`<span class="muted">—</span>`
                            : html`<span class="chips">${p.guilds.map((r) => html`<span class="chip">${r}</span>`)}</span>`}
                        </td>
                        <td>${formatDate(p.startDate)}</td>
                        <td>${formatDate(p.deactivatedAt)}</td>
                        <td class="act-cell">
                          <button class="danger" type="button" @click=${() => this._openConfirm(p)}>🗑 Borrar definitivamente</button>
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `}
      </section>
      ${this._renderConfirm()}
    `;
  }

  /** Modal de confirmación fuerte: hay que escribir el nombre exacto para borrar. */
  _renderConfirm() {
    const person = this._confirmFor;
    if (!person) return null;
    const matches = this._confirmName.trim() === person.name;
    return html`<div class="del-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeConfirm(); }}>
      <div class="del-dialog" role="dialog" aria-modal="true" aria-label="Borrar definitivamente">
        <h3>Borrar definitivamente</h3>
        <p>Vas a eliminar a <strong>${person.name}</strong> y <strong>todos sus datos</strong> (plan de carrera, valoraciones, lecturas, conversaciones y notas). <strong>No se puede deshacer.</strong></p>
        <p class="del-hint">Escribe <strong>${person.name}</strong> para confirmar:</p>
        <input
          type="text"
          .value=${this._confirmName}
          placeholder=${person.name}
          @input=${(e) => { this._confirmName = e.target.value; }}
        />
        <div class="del-actions">
          <button class="act" type="button" @click=${() => this._closeConfirm()}>Cancelar</button>
          <button class="danger" type="button" ?disabled=${!matches || this._deleting} @click=${() => this._doDelete()}>
            ${this._deleting ? 'Borrando…' : 'Borrar definitivamente'}
          </button>
        </div>
      </div>
    </div>`;
  }
}

if (!customElements.get('team-departures')) {
  customElements.define('team-departures', TeamDepartures);
}
