/**
 * <player-card>
 * Ficha de CIUDADANÍA del jugador (MC-21): presentacional y compartida — la
 * usan el overlay «🏅 Ficha» del juego (career-app) y el bloque «Mi ficha de
 * ciudadanía» de mi-espacio (engineer-space). Solo pinta LOGROS (nunca la ruta
 * ni el detalle de visitas, por ADR):
 *
 *  - Cabecera: nombre del jugador, badges grandes (⭐ Super-ciudadano /
 *    👑 Leyenda con su fecha) y totales (ciudadanías, islas pisadas,
 *    certificados).
 *  - Por isla (orden del índice del archipiélago): certificados X/Y, barra de
 *    % con la marca del objetivo y 🏆 con la fecha de la ciudadanía («—» si no
 *    la tiene). Las islas sin pisar van atenuadas.
 *  - «Consultas al brujo»: placeholder hasta MC-22.
 *
 * Todo llega derivado/cargado por el contenedor: `progress` sale de
 * archipelagoProgress (MC-20) y `achievements` del doc de logros (MC-21). Un
 * logro cumplido SIN registro (pre-MC-21) se muestra con «(fecha no
 * registrada)»; un logro REGISTRADO se muestra aunque el progreso actual haya
 * bajado del umbral (retirar certificados no borra la historia).
 *
 * Propiedades:
 *  - playerName: string                       nombre a pintar en la cabecera
 *  - progress: ArchipelagoProgress|null       progresión derivada del journey
 *  - achievements: Achievements|null          logros registrados (fechas)
 *  - visitedIslands: string[]                 ids de islas pisadas (journey)
 *
 * @typedef {import('../../tools/career/domain/citizenship.js').ArchipelagoProgress} ArchipelagoProgress
 * @typedef {import('../../tools/career/domain/achievements.js').Achievements} Achievements
 */
import { LitElement, html, css } from 'lit';
import { formatAchievedAt } from '../../tools/career/domain/achievements.js';

/** Metadatos de los badges de la cabecera (MC-20/21). */
const BADGES = Object.freeze([
  { id: /** @type {const} */ ('superCitizen'), icon: '⭐', label: 'Super-ciudadano' },
  { id: /** @type {const} */ ('legend'), icon: '👑', label: 'Leyenda del archipiélago' },
]);

export class PlayerCard extends LitElement {
  static properties = {
    playerName: { attribute: false },
    progress: { attribute: false },
    achievements: { attribute: false },
    visitedIslands: { attribute: false },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .head { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .head h4 { margin: 0; font-size: 1.05rem; color: var(--rm-navy, #1e3a5f); }
    /* Badges grandes de la cabecera (⭐/👑 con fecha). */
    .bigbadges { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.6rem 0 0; }
    .bigbadge {
      display: inline-flex; align-items: center; gap: 0.45rem;
      padding: 0.35rem 0.85rem; border-radius: 999px;
      background: linear-gradient(135deg, #f6d365 0%, #e8b931 100%); color: #5b4300;
      font-size: 0.85rem; font-weight: 800;
      box-shadow: 0 1px 4px rgba(17, 24, 39, 0.18);
    }
    .bigbadge.legend { background: linear-gradient(135deg, #b993ff 0%, #7f5af0 100%); color: #fff; }
    .bigbadge .when { font-size: 0.72rem; font-weight: 600; opacity: 0.85; }
    .nobadges { margin: 0.6rem 0 0; font-size: 0.83rem; color: var(--rm-muted, #9ca3af); }
    /* Totales (ciudadanías / islas pisadas / certificados). */
    .totals { display: flex; gap: 1rem; flex-wrap: wrap; margin: 0.75rem 0 0; padding: 0; list-style: none; }
    .totals li { font-size: 0.85rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); font-variant-numeric: tabular-nums; }
    /* Tabla de islas: una fila por isla del índice, en su orden. */
    .sub { margin: 1.1rem 0 0.35rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); font-weight: 700; }
    .isles { list-style: none; margin: 0; padding: 0; }
    .isle {
      display: grid;
      grid-template-columns: minmax(120px, 1.2fr) auto minmax(90px, 1fr) auto;
      gap: 0.35rem 0.75rem;
      align-items: center;
      padding: 0.45rem 0;
      border-top: 1px solid var(--rm-border, #eef0f2);
      font-size: 0.85rem;
    }
    /* Isla sin pisar: atenuada (pero legible: el objetivo sigue a la vista). */
    .isle.unvisited { opacity: 0.45; }
    .isle .name { font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .isle .certs { color: var(--rm-muted, #6b7280); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .minibar { position: relative; height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; }
    .minibar .fill { display: block; height: 100%; max-width: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; }
    .minibar .goal { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--rm-coral-600, #e26d5e); border-radius: 1px; }
    .isle .cit { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .isle .cit.got { font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .isle .cit .when { font-size: 0.75rem; font-weight: 600; color: var(--rm-muted, #6b7280); }
    .isle .cit.none { color: var(--rm-muted, #9ca3af); }
    @media (max-width: 560px) {
      .isle { grid-template-columns: 1fr auto; }
      .isle .minibar { grid-column: 1 / -1; }
    }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; margin: 0.4rem 0 0; }
  `;

  constructor() {
    super();
    this.playerName = '';
    /** @type {ArchipelagoProgress|null} */
    this.progress = null;
    /** @type {Achievements|null} */
    this.achievements = null;
    /** @type {string[]} */
    this.visitedIslands = [];
  }

  /**
   * Etiqueta de la fecha de un registro: la fecha larga, o «fecha no
   * registrada» para logros pre-MC-21 (registro con achievedAt null o logro
   * cumplido aún sin registro).
   * @param {import('../../tools/career/domain/achievements.js').AchievementRecord|undefined} record
   * @returns {string}
   */
  _whenLabel(record) {
    return formatAchievedAt(record?.achievedAt) ?? '(fecha no registrada)';
  }

  /** Badges grandes de la cabecera: los logrados (registro o progreso actual). */
  _renderBadges() {
    const badges = this.achievements?.badges ?? {};
    const earned = BADGES.filter(
      (b) =>
        b.id in badges ||
        (b.id === 'superCitizen' ? this.progress?.superCitizen === true : this.progress?.legend === true),
    );
    if (earned.length === 0) {
      return html`<p class="nobadges">Sin badges todavía: consigue 3 ciudadanías (con Bases de software) para ser ⭐ Super-ciudadano.</p>`;
    }
    return html`<div class="bigbadges">
      ${earned.map(
        (b) => html`<span class="bigbadge ${b.id === 'legend' ? 'legend' : ''}">
          <span aria-hidden="true">${b.icon}</span> ${b.label}
          <span class="when">${this._whenLabel(badges[b.id])}</span>
        </span>`,
      )}
    </div>`;
  }

  /** Fila de una isla: certificados, barra con objetivo y ciudadanía con fecha. */
  _renderIsle(isle) {
    const record = this.achievements?.citizenships?.[isle.id];
    // La ciudadanía registrada es historia: se muestra aunque el progreso
    // actual haya bajado del umbral (retirar certificados no la borra).
    const hasCitizenship = isle.achieved || record !== undefined;
    const visited = (this.visitedIslands ?? []).includes(isle.id);
    return html`<li class="isle ${visited ? '' : 'unvisited'}">
      <span class="name">${isle.name}</span>
      <span class="certs">${isle.certificates}/${isle.total} certificados</span>
      <span
        class="minibar"
        role="progressbar"
        aria-valuenow=${isle.pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${`Certificados de ${isle.name}: ${isle.certificates} de ${isle.total} (${isle.pct}%, objetivo ${isle.targetPct}%)`}
      >
        <span class="fill" style=${`width:${isle.pct}%`}></span>
        <span class="goal" style=${`left:${isle.targetPct}%`}></span>
      </span>
      ${hasCitizenship
        ? html`<span class="cit got">🏆 <span class="when">${this._whenLabel(record)}</span></span>`
        : html`<span class="cit none" aria-label="Sin ciudadanía todavía">—</span>`}
    </li>`;
  }

  render() {
    const prog = this.progress;
    if (!prog || prog.islands.length === 0) {
      return html`<p class="empty">Aún no hay progreso que mostrar en el archipiélago.</p>`;
    }
    const certificates = prog.islands.reduce((sum, i) => sum + i.certificates, 0);
    return html`
      <div class="head">
        <h4>${this.playerName}</h4>
      </div>
      ${this._renderBadges()}
      <ul class="totals" aria-label="Totales del archipiélago">
        <li title="Ciudadanías de isla conseguidas">🛂 ${prog.citizenships} ciudadanía${prog.citizenships === 1 ? '' : 's'}</li>
        <li title="Islas del archipiélago pisadas">🏝️ ${prog.islandsVisited}/${prog.islands.length} islas</li>
        <li title="Certificados conseguidos en total">📜 ${certificates} certificado${certificates === 1 ? '' : 's'}</li>
      </ul>
      <p class="sub">Por isla</p>
      <ul class="isles">
        ${prog.islands.map((isle) => this._renderIsle(isle))}
      </ul>
      <p class="sub">Consultas al brujo</p>
      <p class="empty">Aún no has hecho consultas.</p>
    `;
  }
}

if (!customElements.get('player-card')) {
  customElements.define('player-card', PlayerCard);
}
