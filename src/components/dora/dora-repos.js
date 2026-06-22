/**
 * <dora-repos>
 * Configuración de repositorios DORA: alta (admin) con solo el repo (owner/repo) y
 * una fecha de inicio opcional (si se omite, se mide desde la creación del repo);
 * lista, métricas y baja. Quien no es admin solo ve la lista. La agrupación por
 * equipos/gremios se hará más adelante, a posteriori, una vez haya métricas.
 *
 * Propiedades:
 *  - persistence: DoraPersistence (inyectada por <dora-app>)
 *  - isAdmin: boolean
 */
import { LitElement, html, css } from 'lit';
import {
  addRepo,
  listRepos,
  removeRepo,
} from '../../tools/dora/application/usecases.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
};

export class DoraRepos extends LitElement {
  static properties = {
    persistence: { attribute: false },
    isAdmin: { attribute: false },
    repos: { state: true },
    loading: { state: true },
    error: { state: true },
    _full: { state: true },
    _start: { state: true },
    _confirm: { state: true },
    refresh: { attribute: false },
    _refreshing: { state: true },
  };

  static styles = css`
    :host { display: block; }
    section { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.05rem; margin: 0 0 1rem; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    .row { display: grid; grid-template-columns: 2fr 1.2fr auto; gap: 0.75rem; align-items: end; }
    @media (max-width: 720px) { .row { grid-template-columns: 1fr; } }
    label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    input { padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem; }
    button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.5rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    code { font-size: 0.88rem; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; margin: 0.5rem 0 0; }
    .del-btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-danger, #dc2626); border-radius: 6px; padding: 0.2rem 0.6rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .confirm { font-size: 0.78rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }
    .confirm button { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.78rem; padding: 0 0.25rem; }
    .confirm .yes { color: var(--rm-danger, #dc2626); }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .toolbar h2 { margin: 0; }
    button.primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .note { margin-top: 0.5rem; font-size: 0.75rem; }
    .help { font-size: 0.78rem; line-height: 1.5; margin: 0; }
    td.err { color: var(--rm-danger, #dc2626); font-size: 0.8rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.isAdmin = false;
    /** @type {import('../../tools/dora/domain/types.js').DoraRepo[]} */
    this.repos = [];
    this.loading = true;
    this.error = '';
    this._full = '';
    this._start = '';
    /** @type {string|null} */
    this._confirm = null;
    this.refresh = null;
    this._refreshing = false;
    this._loaded = false;
  }

  async _refreshMetrics() {
    if (!this.refresh) return;
    this._refreshing = true;
    this.error = '';
    try {
      await this.refresh();
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron calcular las métricas.';
    } finally {
      this._refreshing = false;
    }
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
      this.repos = await listRepos(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar los repos.';
    } finally {
      this.loading = false;
    }
  }

  async _add(event) {
    event.preventDefault();
    this.error = '';
    try {
      await addRepo(this.persistence, { fullName: this._full, startDate: this._start });
      this._full = '';
      this._start = '';
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo añadir el repo.';
    }
  }

  async _remove(id) {
    this._confirm = null;
    this.error = '';
    try {
      await removeRepo(this.persistence, id);
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo eliminar el repo.';
    }
  }

  _renderForm() {
    if (!this.isAdmin) {
      return html`<p class="muted">Solo un administrador puede añadir o quitar repositorios.</p>`;
    }
    return html`
      <form @submit=${this._add}>
        <div class="row">
          <label>Repositorio (owner/repo)
            <input type="text" placeholder="mi-org/mi-repo" .value=${this._full} @input=${(e) => { this._full = e.target.value; }} required />
          </label>
          <label>Medir desde (opcional)
            <input type="date" .value=${this._start} @input=${(e) => { this._start = e.target.value; }} />
          </label>
          <button class="primary" type="submit">Añadir repo</button>
        </div>
        <p class="muted help">Solo necesitas el <strong>repositorio</strong>. Si dejas la fecha vacía, se mide desde la <strong>creación del repo</strong>. Por ahora solo repos <strong>públicos</strong> (los privados necesitarán token). Agrupar por equipos o gremios se hará más adelante, una vez haya métricas.</p>
      </form>
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
    `;
  }

  _metricCells(repo) {
    const m = repo.metrics;
    if (!m) return html`<td class="muted">—</td><td class="muted">—</td>`;
    if (m.error) return html`<td class="err" colspan="2" title=${m.error}>${m.error}</td>`;
    const lt = m.leadTimeHoursAvg != null ? `${m.leadTimeHoursAvg} h` : '—';
    const df = m.deployFrequencyPerWeek != null ? `${m.deployFrequencyPerWeek}` : '—';
    return html`<td title=${m.computedAt ? `Calculado ${fmtDate(m.computedAt)}` : ''}>${lt}</td><td>${df}</td>`;
  }

  _renderActions(repo) {
    if (!this.isAdmin) return null;
    if (this._confirm === repo.id) {
      return html`<span class="confirm">¿Quitar?
        <button class="yes" @click=${() => this._remove(repo.id)}>Sí</button>
        <button @click=${() => { this._confirm = null; }}>No</button>
      </span>`;
    }
    return html`<button class="del-btn" @click=${() => { this._confirm = repo.id; }}>Quitar</button>`;
  }

  render() {
    return html`
      <section>
        <div class="toolbar">
          <h2>Repositorios a medir (${this.repos.length})</h2>
          ${this.refresh && this.repos.length > 0
            ? html`<button class="primary" ?disabled=${this._refreshing} @click=${this._refreshMetrics}>
                ${this._refreshing ? 'Calculando…' : 'Actualizar métricas'}
              </button>`
            : null}
        </div>
        ${this.loading
          ? html`<p class="empty">Cargando…</p>`
          : this.repos.length === 0
            ? html`<p class="empty">Aún no hay repositorios configurados.</p>`
            : html`
                <table>
                  <thead>
                    <tr><th>Repositorio</th><th>Desde</th><th>Lead time</th><th>Deploy/sem</th>${this.isAdmin ? html`<th></th>` : null}</tr>
                  </thead>
                  <tbody>
                    ${this.repos.map(
                      (r) => html`
                        <tr>
                          <td><code>${r.fullName}</code></td>
                          <td>${fmtDate(r.startDate)}</td>
                          ${this._metricCells(r)}
                          ${this.isAdmin ? html`<td class="num">${this._renderActions(r)}</td>` : null}
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
                <p class="muted note">Métricas desde la API pública de GitHub (repos públicos). Siempre a nivel de equipo, nunca por persona.</p>
              `}
      </section>

      <section>
        <h2>Añadir repositorio</h2>
        ${this._renderForm()}
      </section>
    `;
  }
}

if (!customElements.get('dora-repos')) {
  customElements.define('dora-repos', DoraRepos);
}
