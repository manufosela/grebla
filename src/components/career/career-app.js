/**
 * <career-app>
 * Shell del Mapa de Carrera: selector de mapa, barra de progreso/nivel, el mapa
 * visual y un panel de acciones para la ciudad seleccionada. Persiste el journey
 * por usuario vía los casos de uso.
 *
 * Propiedades (inyectadas desde client/career.js):
 *  - store: CareerStore
 *  - uid: string
 */
import { LitElement, html, css } from 'lit';
import './career-map.js';
import {
  getMaps,
  getMap,
  getJourney,
  startMap,
  toggleVisited,
  setCurrent,
  setTarget,
  stats,
} from '../../tools/career/application/usecases.js';

export class CareerApp extends LitElement {
  static properties = {
    store: { attribute: false },
    uid: { attribute: false },
    error: { state: true },
    mapId: { state: true },
    journey: { state: true },
    selected: { state: true },
    loading: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    label { font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; display: inline-flex; gap: 0.4rem; align-items: center; }
    select { padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem; }
    .stat { display: flex; align-items: baseline; gap: 0.6rem; }
    .lvl { font-weight: 800; color: var(--rm-accent, #2a9d8f); }
    .pts { font-size: 0.85rem; color: var(--rm-muted, #6b7280); font-variant-numeric: tabular-nums; }
    .progress { height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; margin-bottom: 1rem; }
    .progress span { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; transition: width 0.3s ease; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr); gap: 1.5rem; align-items: start; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    .panel { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); padding: 1rem 1.25rem; }
    .panel h3 { margin: 0 0 0.2rem; }
    .kind { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; text-transform: capitalize; }
    .actions { display: flex; flex-direction: column; gap: 0.5rem; }
    button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.5rem 0.8rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .pre { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin: 0.75rem 0 0; }
    .hint { font-size: 0.85rem; color: var(--rm-muted, #9ca3af); }
    .legend { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; margin-top: 1rem; font-size: 0.72rem; color: var(--rm-muted, #6b7280); }
    .legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .legend .d { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .legend .d.visited { background: var(--rm-accent, #2a9d8f); }
    .legend .d.reachable { background: var(--rm-coral, #f2887a); }
    .legend .d.locked { background: var(--rm-track, #d7dee2); }
    .legend .r { width: 10px; height: 10px; border-radius: 50%; display: inline-block; border: 2px solid; }
    .legend .r.current { border-color: var(--rm-coral-600, #e26d5e); }
    .legend .r.target { border-color: var(--rm-navy, #1e3a5f); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); }
  `;

  constructor() {
    super();
    this.store = null;
    this.uid = null;
    this.error = '';
    this.mapId = null;
    this.journey = { mapId: null, visited: [], current: null, target: null };
    this.selected = null;
    this.loading = true;
    this._loaded = false;
  }

  updated() {
    if (this.store && this.uid && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      const j = await getJourney(this.store, this.uid);
      this.mapId = j.mapId || getMaps()[0].id;
      this.journey = { mapId: this.mapId, visited: j.visited ?? [], current: j.current ?? null, target: j.target ?? null };
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar tu mapa.';
    } finally {
      this.loading = false;
    }
  }

  get _map() {
    return getMap(this.mapId);
  }

  async _changeMap(event) {
    const id = event.target.value;
    this.mapId = id;
    this.selected = null;
    this.error = '';
    try {
      this.journey = await startMap(this.store, this.uid, id);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cambiar de mapa.';
    }
  }

  _onSelect(event) {
    this.selected = event.detail.cityId;
  }

  async _act(action) {
    const map = this._map;
    this.error = '';
    try {
      if (action === 'toggle') this.journey = await toggleVisited(this.store, this.uid, map, this.journey, this.selected);
      else if (action === 'current') this.journey = await setCurrent(this.store, this.uid, this.journey, this.selected);
      else if (action === 'target') this.journey = await setTarget(this.store, this.uid, this.journey, this.selected);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo actualizar.';
    }
  }

  render() {
    if (this.error && !this.store) return html`<p class="error">${this.error}</p>`;
    if (this.loading || !this.store) return html`<p class="empty">Cargando tu mapa…</p>`;
    const map = this._map;
    const s = stats(map, this.journey);
    const sel = this.selected ? map.cities.find((c) => c.id === this.selected) : null;
    const visited = this.journey.visited ?? [];
    return html`
      <div class="bar">
        <label>Mapa
          <select @change=${this._changeMap}>
            ${getMaps().map((m) => html`<option value=${m.id} ?selected=${m.id === this.mapId}>${m.name}</option>`)}
          </select>
        </label>
        <div class="stat"><span class="lvl">${s.level}</span><span class="pts">${s.points}/${s.total} pts · ${s.pct}%</span></div>
      </div>
      <div class="progress"><span style=${`width:${s.pct}%`}></span></div>
      ${this.error ? html`<p class="error">${this.error}</p>` : null}

      <div class="grid">
        <career-map
          .map=${map}
          .journey=${this.journey}
          .reachable=${s.reachable}
          .selected=${this.selected}
          @select-city=${this._onSelect}
        ></career-map>

        <div class="panel">
          ${sel
            ? html`
                <h3>${sel.name}</h3>
                <p class="kind">${sel.kind} · ${sel.weight} pts</p>
                <div class="actions">
                  <button class="primary" @click=${() => this._act('toggle')}>
                    ${visited.includes(sel.id) ? 'Quitar de visitadas' : 'Marcar como visitada'}
                  </button>
                  <button @click=${() => this._act('current')}>Marcar como ciudad actual</button>
                  <button @click=${() => this._act('target')}>Marcar como objetivo</button>
                </div>
                ${(sel.prereqs ?? []).length
                  ? html`<p class="pre">Requiere: ${sel.prereqs.map((p) => map.cities.find((c) => c.id === p)?.name).join(', ')}</p>`
                  : null}
              `
            : html`<p class="hint">Haz clic en una ciudad del mapa para ver sus acciones.</p>`}
          <div class="legend">
            <span><i class="d visited"></i>Visitada</span>
            <span><i class="d reachable"></i>Disponible</span>
            <span><i class="d locked"></i>Bloqueada</span>
            <span><i class="r current"></i>Actual</span>
            <span><i class="r target"></i>Objetivo</span>
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('career-app')) {
  customElements.define('career-app', CareerApp);
}
