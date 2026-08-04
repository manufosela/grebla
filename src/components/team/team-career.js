/**
 * <team-career> — pestaña «Carrera» de la tool Equipo (RMR-PCS-0029 · F2b).
 *
 * Vista LISTADA, read-only, del progreso de carrera de las personas del ámbito
 * del manager (el mismo que ya resuelve Equipo: líder→su equipo, supermanager→su
 * rama, superadmin→todos). NO es el juego: acompañar el crecimiento sin entrar a
 * jugar el mapa de nadie. Carga los journeys BAJO DEMANDA (al montar esta
 * pestaña), no al abrir Equipo — así «carga solo lo necesario» y escala.
 */
import { LitElement, html, css } from 'lit';
import { getCurrentUser } from '../../lib/auth.js';
import { listCareerRoutes } from '../../lib/careerMap.js';
import { subLevelForPerson, effectiveSubLevel } from '../../tools/career/domain/subLevel.js';
import { skeletonBlock } from '../app-skeleton.js';
import { listActivePeople, updatePerson } from '../../tools/team/application/usecases/index.js';
import { getJourney } from '../../tools/career/application/usecases.js';
import { careerRoster } from '../../tools/career/domain/careerRoster.js';

export class TeamCareer extends LitElement {
  static properties = {
    persistence: { attribute: false },
    careerStore: { attribute: false },
    archipelago: { attribute: false },
    framework: { attribute: false },
    _rows: { state: true },
    _error: { state: true },
    _editingSub: { state: true },
    _subDraft: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .lead { color: var(--rm-muted, #6b7280); font-size: 0.9rem; margin: 0 0 1rem; }
    .error { color: var(--rm-danger, #dc2626); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1.5rem 0; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 40rem; }
    th, td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    td.num { font-variant-numeric: tabular-nums; }
    .lvl.sub.manual { background: #e9c46a; border-color: #b8860b; color: #4a3800; }
    .pencil { border: 0; background: none; cursor: pointer; font-size: 0.75rem; opacity: 0.5; padding: 0 0.15rem; }
    .pencil:hover { opacity: 1; }
    .subedit { display: inline-flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
    .subedit select, .subedit input { font: inherit; font-size: 0.78rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 6px; padding: 0.15rem 0.35rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    .subedit input { width: 11rem; }
    .mini { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); border-radius: 6px; font: inherit; font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.45rem; cursor: pointer; color: var(--rm-text, #111827); }
    .lvl.sub { background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 16%, var(--rm-surface, #fff)); border: 1px solid var(--rm-accent, #2a9d8f); border-radius: 999px; padding: 0.05rem 0.5rem; cursor: help; }
    .lvl { display: inline-block; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .muted { color: var(--rm-muted, #9ca3af); }
    .pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700; background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 14%, transparent); color: var(--rm-accent, #2a9d8f); }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.careerStore = null;
    this.archipelago = null;
    this.framework = null;
    /** @type {import('../../tools/career/domain/careerRoster.js').CareerRosterRow[]|null} */
    this._rows = null;
    this._error = '';
    this._loaded = false;
  }

  updated() {
    if (this._loaded) return;
    if (this.persistence && this.careerStore && this.archipelago) {
      this._loaded = true;
      this._load();
    } else if (this.persistence && (!this.careerStore || !this.archipelago)) {
      // El glue ya terminó (persistence llega el último) pero faltan el store de
      // carrera o el archipiélago: su preparación falló. No esperar eternamente.
      this._loaded = true;
      this._error = 'No se pudo preparar el progreso de carrera. Recarga la página.';
    }
  }

  async _load() {
    this._error = '';
    try {
      const people = await listActivePeople(this.persistence);
      // Rutas para el sub-nivel derivado (RMR-PCS-0034): si fallan, el listado
      // sale sin badges — nunca tumba la tabla.
      let routes = [];
      try {
        routes = await listCareerRoutes();
      } catch { /* sin rutas: sin badges */ }
      const journeyById = new Map();
      // Journeys BAJO DEMANDA: 1 lectura por persona, en paralelo, al abrir la
      // pestaña. Un journey ilegible (otra rama) no tumba al resto.
      await Promise.all(
        people.map(async (p) => {
          try {
            journeyById.set(p.id, await getJourney(this.careerStore, p.id));
          } catch {
            // sin datos para esa persona: saldrá como «no empezó»
          }
        }),
      );
      const levelCodeOf = (id) => (this.framework?.levels ?? []).find((l) => l.id === id)?.code ?? null;
      const subLevelById = new Map(
        people.map((p) => [
          p.id,
          effectiveSubLevel(
            p,
            subLevelForPerson({ person: p, framework: this.framework, routes, journey: journeyById.get(p.id) ?? null }),
            levelCodeOf(p.levelId),
          ),
        ]),
      );
      this._rows = careerRoster({
        people,
        journeyById,
        islands: this.archipelago?.islands ?? [],
        framework: this.framework,
        subLevelById,
      });
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el progreso.';
    }
  }

  /** Nivel ACTUAL con el sub-nivel efectivo (RMR-PCS-0034): «L1.2» con
   * tooltip del porqué; ajuste manual del manager en ámbar con su nota; ✏️
   * abre el mini-editor inline (F3). */
  _renderCurrentLevel(r) {
    const chip = this._renderSubChip(r);
    if (this._editingSub === r.personId) return html`${chip} ${this._renderSubEditor(r)}`;
    return html`${chip}
      <button
        class="pencil"
        title="Ajustar el sub-nivel (tu juicio manda sobre el cálculo)"
        aria-label="Ajustar el sub-nivel de ${r.name}"
        @click=${() => {
          this._editingSub = r.personId;
          this._subDraft = { value: r.subLevel?.sub ?? 1, note: r.subLevel?.note ?? '' };
        }}
      >✏️</button>`;
  }

  _renderSubChip(r) {
    const s = r.subLevel;
    if (!s) {
      return r.currentLevelCode
        ? html`<span class="lvl">${r.currentLevelCode}</span>`
        : html`<span class="muted">—</span>`;
    }
    const auto = s.pct === null
      ? 'sin ruta publicada'
      : `${s.pct}% del camino al siguiente nivel evidenciado (${s.done}/${s.total} paradas certificadas)`;
    const title = s.source === 'manual'
      ? `Ajustado por el manager${s.note ? `: ${s.note}` : ''} · cálculo: ${auto}`
      : auto;
    return html`<span class="lvl sub ${s.source === 'manual' ? 'manual' : ''}" title=${title}>${s.label}</span>`;
  }

  _renderSubEditor(r) {
    const draft = this._subDraft ?? { value: 1, note: '' };
    return html`<span class="subedit">
      <select @change=${(e) => { this._subDraft = { ...draft, value: Number(e.target.value) }; }}>
        ${[1, 2, 3].map((v) => html`<option value=${v} ?selected=${draft.value === v}>.${v}</option>`)}
      </select>
      <input
        type="text"
        placeholder="¿Por qué? (nota)"
        .value=${draft.note}
        @input=${(e) => { this._subDraft = { ...draft, note: e.target.value }; }}
      />
      <button class="mini" @click=${() => this._saveSubOverride(r)}>Guardar</button>
      ${r.subLevel?.source === 'manual'
        ? html`<button class="mini" @click=${() => this._clearSubOverride(r)}>Volver al automático</button>`
        : null}
      <button class="mini" @click=${() => { this._editingSub = null; }}>✕</button>
    </span>`;
  }

  async _saveSubOverride(r) {
    const draft = this._subDraft ?? { value: 1, note: '' };
    this._error = '';
    try {
      await updatePerson(this.persistence, r.personId, {
        subLevelOverride: {
          value: draft.value,
          note: draft.note.trim() || null,
          byUid: getCurrentUser()?.uid ?? null,
          at: new Date().toISOString(),
        },
      });
      this._editingSub = null;
      await this._load();
    } catch (err) {
      console.error('[carrera] no se pudo ajustar el sub-nivel:', err);
      this._error = 'No se pudo guardar el ajuste (¿tienes permiso de edición sobre esta persona?).';
    }
  }

  async _clearSubOverride(r) {
    this._error = '';
    try {
      await updatePerson(this.persistence, r.personId, { subLevelOverride: null });
      this._editingSub = null;
      await this._load();
    } catch (err) {
      console.error('[carrera] no se pudo quitar el ajuste:', err);
      this._error = 'No se pudo quitar el ajuste.';
    }
  }

  render() {
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (this._rows === null) return html`${skeletonBlock('320px')}`;
    if (this._rows.length === 0) return html`<p class="empty">No hay personas en tu ámbito.</p>`;
    return html`
      <p class="lead">Progreso de carrera de tu gente (solo lectura). Cada persona juega su propio mapa; aquí ves su avance.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Nivel actual</th>
              <th>Nivel objetivo</th>
              <th>Ciudadanías</th>
              <th>Certificados</th>
              <th>Islas pisadas</th>
              <th>Isla actual</th>
            </tr>
          </thead>
          <tbody>
            ${this._rows.map((r) => html`<tr>
              <td>${r.name}</td>
              <td>${this._renderCurrentLevel(r)}</td>
              <td>${r.levelCode ? html`<span class="lvl" title=${r.levelTitle ?? ''}>${r.levelCode}</span>` : html`<span class="muted">—</span>`}</td>
              <td class="num">${r.citizenships > 0 ? html`<span class="pill">${r.citizenships}</span>` : html`<span class="muted">0</span>`}</td>
              <td class="num">${r.certificates}</td>
              <td class="num">${r.islandsVisited}</td>
              <td>${r.currentIsland ?? html`<span class="muted">sin empezar</span>`}</td>
            </tr>`)}
          </tbody>
        </table>
      </div>
    `;
  }
}

customElements.define('team-career', TeamCareer);
