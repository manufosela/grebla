/**
 * <career-tracking> — seguimiento del plan de desarrollo (RMR-TSK-0566).
 *
 * Quien acompaña a un equipo necesita saber por dónde va cada persona y quién
 * tiene el plan parado. Eso no se veía en ninguna parte: el único rastro era un
 * botón «⏱ Tiempo» DENTRO del juego, que además solo daba minutos —sin decir por
 * dónde va nadie— y obligaba a entrar a jugar para mirarlo.
 *
 * Aquí no se mide nada nuevo: estos datos ya estaban en la ficha de cada persona
 * (su viaje y el cronómetro MC-23). Lo único que cambia es que ahora se pueden
 * mirar juntos.
 *
 * El orden por defecto es el de la CONVERSACIÓN PENDIENTE —primero quien no ha
 * empezado y quien lleva más tiempo sin tocarlo—, no un ranking: dedicarle más
 * ratos no es ser mejor ingeniero.
 *
 * Aquí vive el seguimiento de carrera ENTERO (RMR-TSK-0590). Antes había otra tabla
 * en «Equipo › Carrera» que contaba la otra mitad —nivel, ciudadanías,
 * certificados— y obligaba a abrir dos pantallas y cruzarlas a mano para mirar a
 * una sola persona. Esa se ha retirado: esta es la única.
 */
import { LitElement, html, css } from 'lit';
import { tableStyles } from '../common/table-styles.js';
import { skeletonLines } from '../app-skeleton.js';
import { getCurrentUser } from '../../lib/auth.js';
import { ARCHIPELAGO_ISLANDS } from '../../tools/career/data/archipelago.js';
import { getJourney, getPlaytime } from '../../tools/career/application/usecases.js';
import { getLevelAssessment } from '../../lib/careerAssessment.js';
import { marksOf, closureHistory } from '../../tools/career/data/levelAssessment.js';
import { effectiveSubLevel, nextLevelFor } from '../../tools/career/domain/subLevel.js';
import { levelProgressFor } from '../../tools/career/domain/levelProgress.js';
import { careerRoster } from '../../tools/career/domain/careerRoster.js';
import { updatePerson } from '../../tools/team/application/usecases/index.js';
import { formatPlayMinutes } from '../../tools/career/domain/playtime.js';
import { ACTIVITY_WINDOW_DAYS, trackingRow, sortByNeglect, withCareer } from '../../tools/career/domain/tracking.js';

/** Tope de fichas que se leen de una vez, igual que el resto del juego. */
const MAX_PEOPLE = 25;

/** Dos semanas sin tocarlo ya es una conversación pendiente, no un despiste. */
const COLD_DAYS = 14;

/** Nombres del catálogo de código: el suelo hasta que llegue el de la instancia. */
const ISLAND_NAME = new Map(ARCHIPELAGO_ISLANDS.map((i) => [i.id, i.name]));

/** Cuánto hace de la última vez, dicho como lo diría una persona. */
function sinceLabel(idleDays) {
  if (idleDays == null) return 'nunca';
  if (idleDays === 0) return 'hoy';
  if (idleDays === 1) return 'ayer';
  return `hace ${idleDays} días`;
}

export class CareerTracking extends LitElement {
  static properties = {
    people: { attribute: false },
    store: { attribute: false },
    persistence: { attribute: false },
    framework: { attribute: false },
    islands: { attribute: false },
    _rows: { state: true },
    _selected: { state: true },
    _tab: { state: true },
    _error: { state: true },
    _editingSub: { state: true },
    _subDraft: { state: true },
  };

  static styles = [tableStyles, css`
    :host { display: block; }
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; margin: 0 0 1.1rem;
      background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; }
    .tab { background: none; border: 0; border-radius: 9px; padding: 0.5rem 1.15rem; font: inherit;
      font-weight: 600; font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; }
    .tab:hover { color: var(--rm-accent, #2a9d8f); }
    .tab.on { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }

    .layout { display: grid; grid-template-columns: 18rem 1fr; gap: 1.5rem; align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

    .side { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--rm-surface, #fff); }
    .side h2 { margin: 0; padding: 0.7rem 0.9rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--rm-muted, #5b6b7d); border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .side ul { list-style: none; margin: 0; padding: 0; max-height: 34rem; overflow: auto; }
    .side li + li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .person { width: 100%; display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start;
      padding: 0.6rem 0.9rem; background: none; border: 0; cursor: pointer; font: inherit; text-align: left; }
    .person:hover { background: var(--rm-surface-hover, #f6f9fa); }
    .person[aria-current="true"] { background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 12%, transparent);
      box-shadow: inset 3px 0 0 var(--rm-accent, #2a9d8f); }
    .person .name { font-weight: 600; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .person .meta { font-size: 0.75rem; color: var(--rm-muted, #5b6b7d); }
    .person .cold { color: var(--rm-danger, #b45309); font-weight: 700; }

    .main h2 { margin: 0 0 0.2rem; font-size: 1.05rem; color: var(--rm-text, #111827); }
    .pick, .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }

    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.75rem; margin: 1rem 0 0; }
    .fact { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.75rem; background: var(--rm-surface, #fff); }
    .fact dt { margin: 0 0 0.2rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #5b6b7d); }
    .fact dd { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--rm-text, #111827); font-variant-numeric: tabular-nums; }
    .sub { margin: 1.4rem 0 0.4rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #5b6b7d); }
    .note { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); line-height: 1.5; max-width: 52ch; }

    /* Nivel y sub-nivel (vienen de la pestaña «Carrera» que se retira). El ámbar
       marca el ajuste a mano del manager: se distingue del cálculo a simple vista. */
    .lvl { display: inline-block; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .lvl.sub { background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 16%, var(--rm-surface, #fff));
      border: 1px solid var(--rm-accent, #2a9d8f); border-radius: 999px; padding: 0.05rem 0.5rem; cursor: help; }
    .lvl.sub.manual { background: #e9c46a; border-color: #b8860b; color: #4a3800; }
    .muted { color: var(--rm-muted, #5b6b7d); }
    .pencil { border: 0; background: none; cursor: pointer; font-size: 0.75rem; opacity: 0.5; padding: 0 0.15rem; }
    .pencil:hover { opacity: 1; }
    .pencil:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; opacity: 1; }
    .subedit { display: inline-flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; margin-top: 0.3rem; }
    .subedit select, .subedit input { font: inherit; font-size: 0.78rem; border: 1px solid var(--rm-border, #dde7ec);
      border-radius: 6px; padding: 0.15rem 0.35rem; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .subedit input { width: 10rem; }
    .mini { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); border-radius: 6px;
      font: inherit; font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.45rem; cursor: pointer; color: var(--rm-text, #111827); }
  `];

  constructor() {
    super();
    this.people = [];
    this.store = null;
    /** @type {unknown} persistencia de Equipo; sin ella el sub-nivel es de solo lectura */
    this.persistence = null;
    /** @type {import('../../tools/career/data/framework.js').CareerFramework|null} */
    this.framework = null;
    /** @type {{id: string, name: string}[]|null} archipiélago de la instancia */
    this.islands = null;
    /** @type {ReturnType<typeof trackingRow>[]|null} null mientras carga */
    this._rows = null;
    this._selected = null;
    this._tab = 'personas';
    this._error = '';
    this._editingSub = null;
    this._subDraft = null;
    /** @type {Map<string, string>} índice de nombres en uso; el de código hasta que cargue */
    this._islandById = ISLAND_NAME;
  }

  updated(changed) {
    // El framework y el archipiélago llegan del glue por separado: sin ellos el
    // nivel y las ciudadanías saldrían vacíos, así que se recarga al llegar.
    if (changed.has('people') || changed.has('store')
      || changed.has('framework') || changed.has('islands')) this._load();
  }

  async _load() {
    if (!this.store) return;
    const gente = (this.people ?? []).slice(0, MAX_PEOPLE);
    if (gente.length === 0) { this._rows = []; return; }
    this._rows = null;
    const now = new Date();
    // El archipiélago de la instancia manda sobre el de código: ver un nombre
    // viejo al lado de un progreso nuevo desorienta más que no ver nada.
    const islas = this.islands?.length ? this.islands : ARCHIPELAGO_ISLANDS;
    this._islandById = new Map(islas.map((i) => [i.id, i.name]));
    try {
      const partes = await Promise.all(gente.map((person) => this._rowFor(person, now)));
      const journeyById = new Map(partes.map((p) => [p.row.personId, p.journey]));
      const logros = careerRoster({
        people: gente,
        journeyById,
        islands: islas,
        framework: this.framework,
        subLevelById: await this._subLevels(gente),
      });
      this._rows = sortByNeglect(withCareer(partes.map((p) => p.row), logros));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el seguimiento.';
      this._rows = [];
    }
  }

  /**
   * Nombre de una isla; si no está en el índice, su id antes que una raya —un id
   * raro es información, una raya no. Espera un id: quién decide qué se dice
   * cuando no hay isla es cada pantalla, que sabe si toca «sin isla» o «—».
   */
  _islandName(id) {
    return this._islandById.get(id) ?? id;
  }

  /** Celda de isla en la tabla: sin empezar, sin isla, o su nombre. */
  _islandCell(row) {
    if (!row.started) return 'sin empezar';
    return row.currentIsland ? this._islandName(row.currentIsland) : '—';
  }

  /**
   * Una persona que falle sale como «sin datos» en vez de tumbar la pantalla. El
   * viaje se devuelve junto a la fila porque el progreso de carrera se calcula
   * del mismo documento: leerlo dos veces sería pagar dos veces por lo mismo.
   */
  async _rowFor(person, now) {
    const [journey, playtime] = await Promise.all([
      getJourney(this.store, person.id).catch(() => null),
      getPlaytime(this.store, person.id).catch(() => null),
    ]);
    return { row: trackingRow({ person, journey, stats: null, playtime }, now), journey };
  }

  /**
   * Sub-nivel efectivo por persona (RMR-PCS-0044): sale de lo VALORADO contra el
   * nivel SIGUIENTE, no del avance en el mapa —formarse no sube de nivel—, y el
   * ajuste manual del manager prevalece sobre el cálculo. Una valoración
   * ilegible (otra rama) deja a esa persona sin chip, nada más.
   */
  async _subLevels(gente) {
    const niveles = this.framework?.levels ?? [];
    const progressById = new Map();
    await Promise.all(gente.map(async (p) => {
      const next = nextLevelFor(niveles, p.levelId);
      if (!next) return;
      try {
        const valoracion = await getLevelAssessment(p.id, next.id);
        progressById.set(p.id, levelProgressFor({
          person: p, framework: this.framework, marks: marksOf(valoracion), history: closureHistory(valoracion),
        }));
      } catch { /* sin valoración legible: sin chip */ }
    }));
    const codeOf = (id) => niveles.find((l) => l.id === id)?.code ?? null;
    return new Map(gente.map((p) => {
      const prog = progressById.get(p.id) ?? null;
      const derived = prog
        ? { sub: prog.sub, done: prog.earned, total: prog.total, pct: prog.pct, label: prog.label }
        : null;
      return [p.id, effectiveSubLevel(p, derived, codeOf(p.levelId))];
    }));
  }

  render() {
    return html`
      <div class="tabs" role="tablist" aria-label="Seguimiento del plan de desarrollo">
        ${this._renderTab('personas', 'Personas')}
        ${this._renderTab('conjunto', 'Conjunto')}
      </div>
      ${this._error ? this._renderError() : null}
      ${this._tab === 'personas' ? this._renderPeople() : this._renderTable()}`;
  }

  _renderTab(id, label) {
    return html`<button class="tab ${this._tab === id ? 'on' : ''}" type="button" role="tab"
      aria-selected=${this._tab === id ? 'true' : 'false'}
      @click=${() => { this._tab = id; }}>${label}</button>`;
  }

  _renderError() {
    return html`<p class="error">${this._error}</p>`;
  }

  _renderPeople() {
    return html`
      <div class="layout">
        <aside class="side">${this._renderSide()}</aside>
        <section class="main">${this._renderDetail()}</section>
      </div>`;
  }

  _renderSide() {
    if (this._rows === null) return html`<h2>Equipo</h2>${skeletonLines(6)}`;
    if (this._rows.length === 0) return html`<h2>Equipo</h2><p class="empty" style="padding:0.9rem">No hay nadie en tu ámbito.</p>`;
    const filas = this._rows.map((r) => this._renderRow(r));
    return html`<h2>Equipo · ${this._rows.length}</h2><ul>${filas}</ul>`;
  }

  _renderRow(row) {
    return html`<li>${this._renderPerson(row)}</li>`;
  }

  _renderPerson(row) {
    // La lista dice lo que hay que saber sin abrir a nadie: cuánto hace que no
    // lo toca. Quien lleva mucho (o no ha empezado) va marcado.
    const frio = !row.started || row.activity.idleDays == null || row.activity.idleDays >= COLD_DAYS;
    const clase = frio ? 'meta cold' : 'meta';
    const meta = row.started
      ? html`<span class=${clase}>${sinceLabel(row.activity.idleDays)}</span>`
      : html`<span class="meta cold">sin empezar</span>`;
    return html`
      <button class="person" aria-current=${this._selected === row.personId ? 'true' : 'false'}
        @click=${() => { this._selected = row.personId; }}>
        <span class="name">${row.name}</span>
        ${meta}
      </button>`;
  }

  _renderDetail() {
    if (this._rows === null) return skeletonLines(6);
    const row = (this._rows ?? []).find((r) => r.personId === this._selected);
    if (!row) return html`<p class="pick">Elige a una persona para ver por dónde va su plan.</p>`;
    return html`
      <h2>${row.name}</h2>
      <p class="pick">${this._renderWhere(row)}</p>
      <p class="sub">Carrera</p>
      ${this._renderCareer(row)}
      <p class="sub">Dedicación</p>
      ${this._renderFacts(row)}
      <p class="note">
        Los días y las medias son de los últimos ${ACTIVITY_WINDOW_DAYS} días, que es lo que
        guarda el cronómetro. El total es de siempre. Sirve para ver quién tiene el plan
        parado; no dice quién trabaja mejor.
      </p>`;
  }

  _renderWhere(row) {
    if (!row.started) return 'Todavía no ha empezado su plan: ni ruta trazada ni paradas visitadas.';
    const isla = row.currentIsland ? this._islandName(row.currentIsland) : 'sin isla';
    return `En ${isla} · ${row.visitedCount} paradas visitadas · ruta de ${row.routeCount}`;
  }

  /**
   * Lo CONSEGUIDO, que antes vivía en otra pantalla. El nivel objetivo se dice
   * con su rótulo y no con el id: el id no significa nada para quien lo lee.
   */
  _renderCareer(row) {
    const c = row.career;
    if (!c) return html`<p class="pick">No se ha podido leer su progreso de carrera.</p>`;
    return html`
      <dl class="facts">
        <div class="fact"><dt>Nivel actual</dt><dd>${this._renderCurrentLevel(row)}</dd></div>
        <div class="fact"><dt>Nivel objetivo</dt>
          <dd title=${c.levelTitle ?? ''}>${c.levelCode ?? '—'}</dd></div>
        ${this._renderFact('Ciudadanías', String(c.citizenships))}
        ${this._renderFact('Certificados', String(c.certificates))}
        ${this._renderFact('Islas pisadas', String(c.islandsVisited))}
      </dl>`;
  }

  _renderFacts(row) {
    const a = row.activity;
    // Sin una sola sesión no hay nada que promediar: ceros donde no hubo medida
    // se leen como medida.
    const jugó = a.lastDay !== null;
    const dato = (v) => (jugó ? v : '—');
    return html`
      <dl class="facts">
        ${this._renderFact('Días activos', dato(String(a.daysActive)))}
        ${this._renderFact('Tiempo en la ventana', dato(formatPlayMinutes(a.windowMinutes) ?? '—'))}
        ${this._renderFact('Media por día activo', dato(formatPlayMinutes(a.avgMinutesPerActiveDay) ?? '—'))}
        ${this._renderFact('Total de siempre', dato(formatPlayMinutes(a.totalMinutes) ?? '—'))}
        ${this._renderFact('Última vez', sinceLabel(a.idleDays))}
      </dl>`;
  }

  _renderFact(label, value) {
    return html`<div class="fact"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  /**
   * Nivel ACTUAL con el sub-nivel efectivo (RMR-PCS-0034): «L1.2» con el porqué
   * en el tooltip. El ✏️ solo aparece si esta pantalla tiene con qué escribir:
   * sin persistencia de Equipo, un lápiz que no guarda es una trampa.
   */
  _renderCurrentLevel(row) {
    const chip = this._renderSubChip(row);
    if (!this.persistence) return chip;
    if (this._editingSub === row.personId) return html`${chip} ${this._renderSubEditor(row)}`;
    return html`${chip}
      <button
        class="pencil"
        title="Ajustar el sub-nivel (tu juicio manda sobre el cálculo)"
        aria-label="Ajustar el sub-nivel de ${row.name}"
        @click=${() => {
          this._editingSub = row.personId;
          this._subDraft = { value: row.career?.subLevel?.sub ?? 1, note: row.career?.subLevel?.note ?? '' };
        }}
      >✏️</button>`;
  }

  _renderSubChip(row) {
    const s = row.career?.subLevel;
    if (!s) {
      return row.career?.currentLevelCode
        ? html`<span class="lvl">${row.career.currentLevelCode}</span>`
        : html`<span class="muted">—</span>`;
    }
    const auto = s.pct === null
      ? 'sin valorar todavía frente al nivel siguiente'
      : `${s.pct}% del nivel siguiente cumplido (${s.done} de ${s.total} puntos valorados)`;
    const porqué = s.note ? `: ${s.note}` : '';
    const title = s.source === 'manual'
      ? `Ajustado por el manager${porqué} · cálculo: ${auto}`
      : auto;
    return html`<span class="lvl sub ${s.source === 'manual' ? 'manual' : ''}" title=${title}>${s.label}</span>`;
  }

  _renderSubEditor(row) {
    const draft = this._subDraft ?? { value: 1, note: '' };
    return html`<span class="subedit">
      <select aria-label="Sub-nivel" @change=${(e) => { this._subDraft = { ...draft, value: Number(e.target.value) }; }}>
        ${[1, 2, 3].map((v) => html`<option value=${v} ?selected=${draft.value === v}>.${v}</option>`)}
      </select>
      <input
        type="text"
        aria-label="Por qué se ajusta"
        placeholder="¿Por qué? (nota)"
        .value=${draft.note}
        @input=${(e) => { this._subDraft = { ...draft, note: e.target.value }; }}
      />
      <button class="mini" @click=${() => this._saveSubOverride(row)}>Guardar</button>
      ${row.career?.subLevel?.source === 'manual'
        ? html`<button class="mini" @click=${() => this._clearSubOverride(row)}>Volver al automático</button>`
        : null}
      <button class="mini" aria-label="Cancelar" @click=${() => { this._editingSub = null; }}>✕</button>
    </span>`;
  }

  async _saveSubOverride(row) {
    const draft = this._subDraft ?? { value: 1, note: '' };
    this._error = '';
    const override = {
      value: draft.value,
      note: draft.note.trim() || null,
      byUid: getCurrentUser()?.uid ?? null,
      at: new Date().toISOString(),
    };
    try {
      await updatePerson(this.persistence, row.personId, { subLevelOverride: override });
      this._editingSub = null;
      this._applyOverride(row.personId, override);
    } catch (err) {
      console.error('[seguimiento] no se pudo ajustar el sub-nivel:', err);
      this._error = 'No se pudo guardar el ajuste (¿tienes permiso de edición sobre esta persona?).';
    }
  }

  async _clearSubOverride(row) {
    this._error = '';
    try {
      await updatePerson(this.persistence, row.personId, { subLevelOverride: null });
      this._editingSub = null;
      this._applyOverride(row.personId, null);
    } catch (err) {
      console.error('[seguimiento] no se pudo quitar el ajuste:', err);
      this._error = 'No se pudo quitar el ajuste.';
    }
  }

  /**
   * Las fichas llegan del glue de una sola vez, así que tras escribir hay que
   * poner al día la copia local: recargar sin hacerlo volvería a pintar el valor
   * viejo. No se inventa nada —es exactamente lo que se acaba de guardar— y el
   * cambio de `people` dispara la recarga por sí solo.
   */
  _applyOverride(personId, override) {
    this.people = (this.people ?? []).map(
      (p) => (p.id === personId ? { ...p, subLevelOverride: override } : p),
    );
  }

  _renderTable() {
    if (this._rows === null) return skeletonLines(8);
    if (this._rows.length === 0) return html`<p class="empty">No hay nadie en tu ámbito.</p>`;
    const filas = this._rows.map((r) => this._renderTableRow(r));
    return html`
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Persona</th><th>Nivel</th><th>Dónde va</th><th class="num">Paradas</th>
              <th class="num">Ciudadanías</th><th class="num">Certificados</th>
              <th class="num">Días activos</th><th class="num">Media/día</th><th>Última vez</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p class="note">
        Ordenado por quién lleva más tiempo sin tocarlo, que es el orden de la
        conversación pendiente. Ventana: ${ACTIVITY_WINDOW_DAYS} días.
      </p>`;
  }

  _renderTableRow(row) {
    // Quien nunca ha jugado no lleva ceros: un «0 min» se lee como una medida, y
    // aquí no hay medida ninguna. La raya dice lo que pasa de verdad.
    const jugó = row.activity.lastDay !== null;
    const c = row.career;
    return html`
      <tr>
        <td>${row.name}</td>
        <td>${this._renderSubChip(row)}</td>
        <td>${this._islandCell(row)}</td>
        <td class="num">${row.started ? row.visitedCount : '—'}</td>
        <td class="num">${c ? c.citizenships : '—'}</td>
        <td class="num">${c ? c.certificates : '—'}</td>
        <td class="num">${jugó ? row.activity.daysActive : '—'}</td>
        <td class="num">${jugó ? (formatPlayMinutes(row.activity.avgMinutesPerActiveDay) ?? '—') : '—'}</td>
        <td>${sinceLabel(row.activity.idleDays)}</td>
      </tr>`;
  }
}

customElements.define('career-tracking', CareerTracking);
