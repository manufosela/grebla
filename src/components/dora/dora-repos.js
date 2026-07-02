/**
 * <dora-repos>
 * Configuración de repositorios DORA: alta (superadmin y líderes) con solo el
 * repo (owner/repo) y una fecha de inicio opcional (si se omite, se mide desde la
 * creación del repo); lista, métricas y baja. Cada líder gestiona SUS repos; el
 * superadmin, todos. El viewer solo ve la lista. La agrupación por equipos/gremios
 * se hará más adelante, a posteriori, una vez haya métricas.
 *
 * Propiedades:
 *  - persistence: DoraPersistence (inyectada por <dora-app>)
 *  - canEdit: boolean  (superadmin o líder pueden añadir/editar/borrar sus repos)
 */
import { LitElement, html, css } from 'lit';
import {
  addRepo,
  listRepos,
  removeRepo,
  updateRepoConfig,
  listTeams,
  listGuilds,
  registerDeployment,
  listDeployments,
  removeDeployment,
} from '../../tools/dora/application/usecases.js';
import { leadTimeLevel, deployFrequencyLevel } from '../../tools/dora/domain/levels.js';
import { deploymentFrequencyPerWeek } from '../../tools/dora/domain/deployments.js';
import { getCurrentUser } from '../../lib/auth.js';
import { levelBadge, levelStyles } from './level-badge.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
};

const dateTimeFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
};

/** Valor por defecto para un <input type="datetime-local"> = ahora, hora local. */
const nowForInput = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Abreviatura de un sha de commit (primeros 7 caracteres). */
const shortSha = (sha) => (typeof sha === 'string' && sha ? sha.slice(0, 7) : '');

export class DoraRepos extends LitElement {
  static properties = {
    persistence: { attribute: false },
    canEdit: { attribute: false },
    repos: { state: true },
    loading: { state: true },
    error: { state: true },
    _full: { state: true },
    _start: { state: true },
    _confirm: { state: true },
    refresh: { attribute: false },
    _refreshing: { state: true },
    _teams: { state: true },
    _guilds: { state: true },
    _editing: { state: true },
    _editTeam: { state: true },
    _editGuilds: { state: true },
    _editBranch: { state: true },
    _editSignal: { state: true },
    _deployOpen: { state: true },
    _deployEvents: { state: true },
    _deployLoading: { state: true },
    _depAt: { state: true },
    _depSha: { state: true },
    _depStatus: { state: true },
    _depNote: { state: true },
    _depSaving: { state: true },
    _depError: { state: true },
    _depConfirm: { state: true },
  };

  static styles = [css`
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
    input.edit-in { width: 100%; min-width: 8rem; font-size: 0.82rem; padding: 0.3rem 0.4rem; }
    .del-btn.edit { color: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); margin-right: 0.4rem; }
    .tag { display: inline-block; background: var(--rm-track, #e9f0f2); color: var(--rm-muted, #6b7280); border-radius: 999px; padding: 0.05rem 0.5rem; font-size: 0.76rem; margin: 0 0.2rem 0.2rem 0; }
    .deploy-toggle { display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.25rem; border: 0; background: none; padding: 0; color: var(--rm-accent, #2a9d8f); font-size: 0.76rem; font-weight: 600; cursor: pointer; }
    tr.detail > td { background: var(--rm-track, #f7fafb); padding: 1rem 1.1rem; }
    .deploy-panel { display: flex; flex-direction: column; gap: 0.9rem; }
    .deploy-freq { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem 1rem; font-size: 0.85rem; }
    .deploy-freq .real { font-weight: 700; color: var(--rm-text, #111827); }
    .deploy-freq .real .value { font-size: 1.15rem; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .deploy-freq .kind { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-muted, #6b7280); font-weight: 600; }
    .deploy-freq .proxy { color: var(--rm-muted, #6b7280); }
    .deploy-form { display: grid; grid-template-columns: auto auto auto 1fr auto; gap: 0.6rem; align-items: end; }
    @media (max-width: 720px) { .deploy-form { grid-template-columns: 1fr; } }
    .deploy-form label { font-size: 0.72rem; }
    .deploy-form input, .deploy-form select { padding: 0.4rem 0.5rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.82rem; }
    .deploy-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .deploy-list li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem; padding: 0.35rem 0; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .deploy-list .when { font-variant-numeric: tabular-nums; }
    .deploy-list .by { color: var(--rm-muted, #6b7280); }
    .deploy-list code { font-size: 0.8rem; }
    .pill { display: inline-block; border-radius: 999px; padding: 0.05rem 0.55rem; font-size: 0.72rem; font-weight: 700; }
    .pill.success { background: #dcfce7; color: #15803d; }
    .pill.failed { background: #fee2e2; color: #b91c1c; }
    .spacer { flex: 1; }
    .deploy-empty { color: var(--rm-muted, #9ca3af); font-size: 0.82rem; }
  `, levelStyles];

  constructor() {
    super();
    this.persistence = null;
    this.canEdit = false;
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
    /** @type {string[]} catálogos vivos derivados de los repos */
    this._teams = [];
    this._guilds = [];
    /** @type {string|null} id del repo en edición de agrupación */
    this._editing = null;
    this._editTeam = '';
    this._editGuilds = '';
    this._editBranch = '';
    this._editSignal = 'branch';
    /** @type {string|null} id del repo con el panel de despliegues abierto */
    this._deployOpen = null;
    /** @type {import('../../tools/dora/domain/types.js').Deployment[]} */
    this._deployEvents = [];
    this._deployLoading = false;
    this._depAt = '';
    this._depSha = '';
    this._depStatus = 'success';
    this._depNote = '';
    this._depSaving = false;
    this._depError = '';
    /** @type {string|null} id del despliegue pendiente de confirmar borrado */
    this._depConfirm = null;
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
      const [repos, teams, guilds] = await Promise.all([
        listRepos(this.persistence),
        listTeams(this.persistence),
        listGuilds(this.persistence),
      ]);
      this.repos = repos;
      this._teams = teams;
      this._guilds = guilds;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar los repos.';
    } finally {
      this.loading = false;
    }
  }

  _startEdit(repo) {
    this._confirm = null;
    this._editing = repo.id;
    this._editTeam = repo.team ?? '';
    this._editGuilds = (repo.guilds ?? []).join(', ');
    this._editBranch = repo.baseBranch || 'main';
    this._editSignal = repo.deploySignal || 'branch';
  }

  _cancelEdit() {
    this._editing = null;
    this._editTeam = '';
    this._editGuilds = '';
    this._editBranch = '';
    this._editSignal = 'branch';
  }

  async _saveEdit(id) {
    this.error = '';
    try {
      await updateRepoConfig(this.persistence, id, {
        team: this._editTeam,
        guilds: this._editGuilds.split(',').map((g) => g.trim()).filter(Boolean),
        baseBranch: this._editBranch,
        deploySignal: this._editSignal,
      });
      this._cancelEdit();
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la configuración.';
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

  /** Abre/cierra el panel de despliegues reales de un repo y carga sus eventos. */
  async _toggleDeploys(repo) {
    if (this._deployOpen === repo.id) {
      this._deployOpen = null;
      this._deployEvents = [];
      return;
    }
    this._deployOpen = repo.id;
    this._deployEvents = [];
    this._depError = '';
    this._depConfirm = null;
    this._depAt = nowForInput();
    this._depSha = '';
    this._depStatus = 'success';
    this._depNote = '';
    await this._loadDeployments(repo.id);
  }

  async _loadDeployments(repoId) {
    this._deployLoading = true;
    this._depError = '';
    try {
      this._deployEvents = await listDeployments(this.persistence, repoId);
    } catch (err) {
      this._depError = err instanceof Error ? err.message : 'No se pudieron cargar los despliegues.';
    } finally {
      this._deployLoading = false;
    }
  }

  /** Registra un despliegue del repo con el autor de la sesión actual. */
  async _registerDeploy(event, repo) {
    event.preventDefault();
    this._depError = '';
    this._depSaving = true;
    try {
      const user = getCurrentUser();
      const createdBy = user ? { uid: user.uid, name: user.displayName ?? user.email ?? user.uid } : undefined;
      await registerDeployment(this.persistence, repo.id, {
        at: this._depAt,
        sha: this._depSha,
        status: this._depStatus,
        note: this._depNote,
        createdBy,
      });
      // Reset del formulario a un nuevo "ahora" para el siguiente registro.
      this._depAt = nowForInput();
      this._depSha = '';
      this._depNote = '';
      this._depStatus = 'success';
      await this._loadDeployments(repo.id);
    } catch (err) {
      this._depError = err instanceof Error ? err.message : 'No se pudo registrar el despliegue.';
    } finally {
      this._depSaving = false;
    }
  }

  async _removeDeploy(repoId, id) {
    this._depConfirm = null;
    this._depError = '';
    try {
      await removeDeployment(this.persistence, repoId, id);
      await this._loadDeployments(repoId);
    } catch (err) {
      this._depError = err instanceof Error ? err.message : 'No se pudo eliminar el despliegue.';
    }
  }

  /**
   * Ventana para la frecuencia real: desde la fecha de inicio del repo (o, si no
   * hay, el inicio del periodo ya medido, o su creación) hasta ahora. Sin `||`
   * sobre datos críticos: se encadena con `??` respetando null como "sin valor".
   */
  _deployPeriod(repo) {
    const from = repo.startDate ?? repo.metrics?.periodFrom ?? repo.createdAt ?? new Date().toISOString();
    return { from, to: new Date().toISOString() };
  }

  _renderForm() {
    if (!this.canEdit) {
      return html`<p class="muted">Solo puedes consultar la lista de repositorios.</p>`;
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
    if (!m) return html`<td class="muted">—</td><td class="muted">—</td><td class="muted">—</td>`;
    if (m.error) return html`<td class="err" colspan="3" title=${m.error}>${m.error}</td>`;
    const lt = m.leadTimeHoursAvg != null ? `${m.leadTimeHoursAvg} h` : '—';
    const df = m.deployFrequencyPerWeek != null ? `${m.deployFrequencyPerWeek}` : '—';
    const people = m.contributors != null ? m.contributors : '—';
    return html`<td title=${m.computedAt ? `Calculado ${fmtDate(m.computedAt)}` : ''}>${lt}${levelBadge(leadTimeLevel(m.leadTimeHoursAvg))}</td><td>${df}${levelBadge(deployFrequencyLevel(m.deployFrequencyPerWeek))}</td><td>${people}</td>`;
  }

  _renderActions(repo) {
    if (!this.canEdit) return null;
    if (this._editing === repo.id) {
      return html`<span class="confirm">
        <button class="yes" @click=${() => this._saveEdit(repo.id)}>Guardar</button>
        <button @click=${() => this._cancelEdit()}>Cancelar</button>
      </span>`;
    }
    if (this._confirm === repo.id) {
      return html`<span class="confirm">¿Quitar?
        <button class="yes" @click=${() => this._remove(repo.id)}>Sí</button>
        <button @click=${() => { this._confirm = null; }}>No</button>
      </span>`;
    }
    return html`
      <button class="del-btn edit" @click=${() => this._startEdit(repo)}>Configurar</button>
      <button class="del-btn" @click=${() => { this._confirm = repo.id; }}>Quitar</button>
    `;
  }

  /** Panel de despliegues reales de un repo: frecuencia real, alta y lista. */
  _renderDeployPanel(repo) {
    const events = this._deployEvents;
    const realFreq = deploymentFrequencyPerWeek(events, this._deployPeriod(repo));
    const proxyFreq = repo.metrics?.deployFrequencyPerWeek;
    const hasEvents = events.length > 0;
    return html`
      <div class="deploy-panel">
        <div class="deploy-freq">
          ${hasEvents
            ? html`<span class="real"><span class="value">${realFreq}</span> /sem ${levelBadge(deployFrequencyLevel(realFreq))} <span class="kind">real (eventos)</span></span>`
            : html`<span class="deploy-empty">Sin despliegues registrados: la frecuencia real aún no se puede calcular.</span>`}
          <span class="proxy">proxy: merges/releases → ${proxyFreq != null ? `${proxyFreq} /sem` : '—'}${hasEvents ? '' : ' (estimación)'}</span>
        </div>
        ${this.canEdit ? this._renderDeployForm(repo) : null}
        ${this._depError ? html`<p class="error">${this._depError}</p>` : null}
        ${this._deployLoading
          ? html`<p class="deploy-empty">Cargando despliegues…</p>`
          : this._renderDeployList(repo)}
      </div>
    `;
  }

  _renderDeployForm(repo) {
    return html`
      <form class="deploy-form" @submit=${(e) => this._registerDeploy(e, repo)}>
        <label>Fecha y hora
          <input type="datetime-local" required .value=${this._depAt} @input=${(e) => { this._depAt = e.target.value; }} />
        </label>
        <label>Estado
          <select @change=${(e) => { this._depStatus = e.target.value; }}>
            <option value="success" ?selected=${this._depStatus === 'success'}>success</option>
            <option value="failed" ?selected=${this._depStatus === 'failed'}>failed</option>
          </select>
        </label>
        <label>Commit (sha, opcional)
          <input type="text" placeholder="a1b2c3d" .value=${this._depSha} @input=${(e) => { this._depSha = e.target.value; }} />
        </label>
        <label>Nota (opcional)
          <input type="text" placeholder="contexto del despliegue" .value=${this._depNote} @input=${(e) => { this._depNote = e.target.value; }} />
        </label>
        <button class="primary" type="submit" ?disabled=${this._depSaving}>${this._depSaving ? 'Registrando…' : 'Registrar despliegue'}</button>
      </form>
    `;
  }

  _renderDeployList(repo) {
    if (this._deployEvents.length === 0) {
      return html`<p class="deploy-empty">Aún no hay despliegues registrados para este repo.</p>`;
    }
    return html`
      <ul class="deploy-list">
        ${this._deployEvents.map((e) => html`
          <li>
            <span class="pill ${e.status === 'failed' ? 'failed' : 'success'}">${e.status}</span>
            <span class="when">${fmtDateTime(e.at)}</span>
            ${e.sha ? html`<code>${shortSha(e.sha)}</code>` : null}
            ${e.createdBy?.name ? html`<span class="by">por ${e.createdBy.name}</span>` : null}
            ${e.note ? html`<span class="by" title=${e.note}>· ${e.note}</span>` : null}
            <span class="spacer"></span>
            ${this.canEdit ? this._renderDeployActions(repo, e) : null}
          </li>
        `)}
      </ul>
    `;
  }

  _renderDeployActions(repo, e) {
    if (this._depConfirm === e.id) {
      return html`<span class="confirm">¿Quitar?
        <button class="yes" @click=${() => this._removeDeploy(repo.id, e.id)}>Sí</button>
        <button @click=${() => { this._depConfirm = null; }}>No</button>
      </span>`;
    }
    return html`<button class="del-btn" @click=${() => { this._depConfirm = e.id; }}>Quitar</button>`;
  }

  /** Celdas de equipo, gremios y rama base: en edición (admin) muestran inputs. */
  _renderConfigCells(repo) {
    if (this.canEdit && this._editing === repo.id) {
      return html`
        <td><input class="edit-in" list="dora-teams" placeholder="(sin equipo)"
          .value=${this._editTeam} @input=${(e) => { this._editTeam = e.target.value; }} /></td>
        <td><input class="edit-in" list="dora-guilds" placeholder="gremios, separados por comas"
          .value=${this._editGuilds} @input=${(e) => { this._editGuilds = e.target.value; }} /></td>
        <td>
          <select class="edit-in" @change=${(e) => { this._editSignal = e.target.value; }}>
            <option value="branch" ?selected=${this._editSignal !== 'release'}>rama</option>
            <option value="release" ?selected=${this._editSignal === 'release'}>release/tag</option>
          </select>
          ${this._editSignal !== 'release'
            ? html`<input class="edit-in" placeholder="main" .value=${this._editBranch} @input=${(e) => { this._editBranch = e.target.value; }} />`
            : null}
        </td>
      `;
    }
    const guilds = repo.guilds ?? [];
    return html`
      <td>${repo.team || html`<span class="muted">—</span>`}</td>
      <td>${guilds.length ? guilds.map((g) => html`<span class="tag">${g}</span>`) : html`<span class="muted">—</span>`}</td>
      <td>${repo.deploySignal === 'release'
        ? html`<span class="tag">releases</span>`
        : html`<code>${repo.baseBranch || 'main'}</code>`}</td>
    `;
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
                    <tr><th>Repositorio</th><th>Equipo</th><th>Gremios</th><th>Despliegue</th><th>Desde</th><th>Lead time</th><th>Deploy/sem</th><th>Personas</th>${this.canEdit ? html`<th></th>` : null}</tr>
                  </thead>
                  <tbody>
                    ${this.repos.map(
                      (r) => html`
                        <tr>
                          <td>
                            <code>${r.fullName}</code>
                            <button class="deploy-toggle" aria-expanded=${this._deployOpen === r.id}
                              @click=${() => this._toggleDeploys(r)}>
                              ${this._deployOpen === r.id ? '▾' : '▸'} Despliegues reales
                            </button>
                          </td>
                          ${this._renderConfigCells(r)}
                          <td>${fmtDate(r.startDate)}</td>
                          ${this._metricCells(r)}
                          ${this.canEdit ? html`<td class="num">${this._renderActions(r)}</td>` : null}
                        </tr>
                        ${this._deployOpen === r.id
                          ? html`<tr class="detail"><td colspan=${this.canEdit ? 9 : 8}>${this._renderDeployPanel(r)}</td></tr>`
                          : null}
                      `,
                    )}
                  </tbody>
                </table>
                <datalist id="dora-teams">${this._teams.map((t) => html`<option value=${t}></option>`)}</datalist>
                <datalist id="dora-guilds">${this._guilds.map((g) => html`<option value=${g}></option>`)}</datalist>
                <p class="muted note">Equipo, gremios y rama base (señal de despliegue, por defecto <code>main</code>) se configuran aquí, a posteriori. La columna <strong>Deploy/sem</strong> es un <strong>proxy</strong> (merges/releases desde la API pública de GitHub). Para la <strong>frecuencia real</strong> abre «Despliegues reales» en cada repo y registra los despliegues a producción. Siempre a nivel de equipo, nunca por persona.</p>
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
