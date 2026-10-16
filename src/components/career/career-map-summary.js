/**
 * <career-map-summary> — el mapa de carrera de una persona, en solo lectura
 * (RMR-TSK-0735): su ficha de ciudadanía, la isla con su progreso, la casa
 * actual, las dominadas por comarca y su ruta. Lo montan Mi espacio (`self`) y
 * la ficha de su manager: lo mismo, con el texto en la persona que toca. Nadie
 * juega el mapa de otro: aquí no hay acciones.
 */
import { LitElement, html, css } from 'lit';
import './career-map.js';
import './player-card.js';
import { stats } from '../../tools/career/application/usecases.js';
import { archipelagoProgress } from '../../tools/career/domain/citizenship.js';
import { mapSummary } from '../../tools/career/domain/mapSummary.js';

export class CareerMapSummary extends LitElement {
  static properties = {
    person: { attribute: false },
    island: { attribute: false },
    journey: { attribute: false },
    archipelago: { attribute: false },
    achievements: { attribute: false },
    endorsements: { attribute: false },
    questions: { attribute: false },
    /** Lo mira la propia persona (Mi espacio): «tu»; si no, «su». */
    self: { type: Boolean },
  };

  static styles = css`
    :host { display: block; }
    .sub { margin: 1.1rem 0 0.4rem; font-weight: 700; color: var(--rm-text, #111827); }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .playlink { color: var(--rm-accent, #2a9d8f); font-weight: 700; text-decoration: none; margin-left: 0.35rem; }
    .playlink:hover { text-decoration: underline; }
    .map-cta { margin: 0.4rem 0 1.1rem; font-size: 0.88rem; }
    .map-head { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.4rem; }
    .map-head .lvl { font-weight: 800; color: var(--rm-accent, #2a9d8f); }
    .map-head .pts { font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); font-variant-numeric: tabular-nums; }
    .progress { height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; margin-bottom: 1rem; }
    .progress span { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; }
    .now-city { margin: 0; font-weight: 700; }
    .by-area { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem 1.25rem; }
    .by-area .area-name { font-weight: 700; font-size: 0.85rem; margin: 0 0 0.2rem; }
    .by-area .cities { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .by-area .cities li { padding: 0.15rem 0; color: var(--rm-text, #111827); }
    .route { margin: 0; padding-left: 1.2rem; font-size: 0.85rem; }
    .route li { padding: 0.15rem 0; }
  `;

  render() {
    const summary = mapSummary(this.island, this.journey);
    if (!summary) {
      // El ingeniero JUEGA (JG-1): sin plan trazado, su salida es ir al juego.
      return this.self
        ? html`<p class="empty">Aún no tienes un mapa de carrera trazado.
            <a class="playlink" href="/tools/career-map">🎮 Empieza a jugar tu mapa</a></p>`
        : html`<p class="empty">Aún no ha trazado su mapa de carrera.</p>`;
    }
    const s = stats(this.island, this.journey);
    const my = this.self ? 'Mi' : 'Su';
    return html`
      ${this._citizenship(my)}
      <p class="sub">${my} isla actual</p>
      <div class="map-head">
        <span class="lvl">${s.level}</span>
        <span class="pts">${s.points}/${s.total} pts · ${s.pct}%</span>
      </div>
      <div class="progress"><span style="width:${s.pct}%"></span></div>
      <career-map .map=${this.island} .journey=${this.journey} .selected=${null}></career-map>
      ${this.self ? html`<p class="map-cta">
        <a class="playlink" href="/tools/career-map">🕹️ Ver mapa completo y jugar en 3D si quieres</a></p>` : null}
      <p class="sub">Casa actual</p>
      ${summary.current ? html`<p class="now-city">${summary.current.name}</p>` : html`<p class="empty">Sin casa actual marcada.</p>`}
      <p class="sub">Casas dominadas (${summary.visitedCount})</p>
      ${summary.dominatedByArea.length === 0
        ? html`<p class="empty">${this.self ? 'Aún no has dominado ninguna casa.' : 'Aún no ha dominado ninguna casa.'}</p>`
        : html`<div class="by-area">${summary.dominatedByArea.map((g) => html`<div class="area">
            <p class="area-name">${g.area.name}</p>
            <ul class="cities">${g.cities.map((c) => html`<li>${c.name}</li>`)}</ul></div>`)}</div>`}
      ${summary.route.length ? html`<p class="sub">${this.self ? 'Tu' : 'Su'} ruta</p>
        <ol class="route">${summary.route.map((name) => html`<li>${name}</li>`)}</ol>` : null}`;
  }

  /** La ficha de ciudadanía (MC-21): el mismo <player-card> del juego, en solo lectura. */
  _citizenship(my) {
    if (!this.archipelago || !this.journey) return null;
    return html`
      <p class="sub">${my} ficha de ciudadanía</p>
      <player-card .playerName=${this.person?.name ?? ''}
        .progress=${archipelagoProgress(this.journey, this.archipelago.islands)}
        .achievements=${this.achievements} .endorsements=${this.endorsements}
        .visitedIslands=${this.journey.visitedIslands ?? []} .questions=${this.questions ?? []}></player-card>`;
  }
}

if (!customElements.get('career-map-summary')) customElements.define('career-map-summary', CareerMapSummary);
