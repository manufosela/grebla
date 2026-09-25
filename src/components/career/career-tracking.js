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
 */
import { LitElement, html, css } from 'lit';
import { tableStyles } from '../common/table-styles.js';
import { skeletonLines } from '../app-skeleton.js';
import { ARCHIPELAGO_ISLANDS } from '../../tools/career/data/archipelago.js';
import { getJourney, getPlaytime } from '../../tools/career/application/usecases.js';
import { formatPlayMinutes } from '../../tools/career/domain/playtime.js';
import { ACTIVITY_WINDOW_DAYS, trackingRow, sortByNeglect } from '../../tools/career/domain/tracking.js';

/** Tope de fichas que se leen de una vez, igual que el resto del juego. */
const MAX_PEOPLE = 25;

/** Dos semanas sin tocarlo ya es una conversación pendiente, no un despiste. */
const COLD_DAYS = 14;

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
    _rows: { state: true },
    _selected: { state: true },
    _tab: { state: true },
    _error: { state: true },
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
  `];

  constructor() {
    super();
    this.people = [];
    this.store = null;
    /** @type {ReturnType<typeof trackingRow>[]|null} null mientras carga */
    this._rows = null;
    this._selected = null;
    this._tab = 'personas';
    this._error = '';
  }

  updated(changed) {
    if (changed.has('people') || changed.has('store')) this._load();
  }

  async _load() {
    if (!this.store) return;
    const gente = (this.people ?? []).slice(0, MAX_PEOPLE);
    if (gente.length === 0) { this._rows = []; return; }
    this._rows = null;
    const now = new Date();
    try {
      const filas = await Promise.all(gente.map((person) => this._rowFor(person, now)));
      this._rows = sortByNeglect(filas);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el seguimiento.';
      this._rows = [];
    }
  }

  /** Una persona que falle sale como «sin datos» en vez de tumbar la pantalla. */
  async _rowFor(person, now) {
    const [journey, playtime] = await Promise.all([
      getJourney(this.store, person.id).catch(() => null),
      getPlaytime(this.store, person.id).catch(() => null),
    ]);
    return trackingRow({ person, journey, stats: null, playtime }, now);
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
    const isla = ISLAND_NAME.get(row.currentIsland) ?? row.currentIsland ?? 'sin isla';
    const objetivo = row.targetLevelId ? ` · objetivo ${row.targetLevelId}` : '';
    return `En ${isla} · ${row.visitedCount} paradas visitadas · ruta de ${row.routeCount}${objetivo}`;
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

  _renderTable() {
    if (this._rows === null) return skeletonLines(8);
    if (this._rows.length === 0) return html`<p class="empty">No hay nadie en tu ámbito.</p>`;
    const filas = this._rows.map((r) => this._renderTableRow(r));
    return html`
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Persona</th><th>Dónde va</th><th class="num">Paradas</th>
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
    return html`
      <tr>
        <td>${row.name}</td>
        <td>${row.started ? (ISLAND_NAME.get(row.currentIsland) ?? '—') : 'sin empezar'}</td>
        <td class="num">${row.started ? row.visitedCount : '—'}</td>
        <td class="num">${jugó ? row.activity.daysActive : '—'}</td>
        <td class="num">${jugó ? (formatPlayMinutes(row.activity.avgMinutesPerActiveDay) ?? '—') : '—'}</td>
        <td>${sinceLabel(row.activity.idleDays)}</td>
      </tr>`;
  }
}

customElements.define('career-tracking', CareerTracking);
