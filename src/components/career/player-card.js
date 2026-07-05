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
 *  - «Consultas al brujo» (MC-22): las Q&A del jugador en TODAS las islas —
 *    isla, fecha, estado, texto y la respuesta con su crédito («respondida por
 *    {answeredBy/creditedTo}»). Solo lectura: preguntar y marcar como vista se
 *    hace en el panel del brujo del juego.
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
 *  - endorsements: Endorsements|null          avales del manager (JG-6): el contador «N avalados ✓»
 *  - visitedIslands: string[]                 ids de islas pisadas (journey)
 *  - questions: WizardQuestion[]              consultas al brujo (MC-22, ya ordenadas)
 *
 * La ficha lista islas (no certificados individuales, por ADR): del aval solo
 * cabe el CONTADOR en los totales — el sello casa a casa vive en la tarjeta
 * de cada casa del juego.
 *
 * @typedef {import('../../tools/career/domain/citizenship.js').ArchipelagoProgress} ArchipelagoProgress
 * @typedef {import('../../tools/career/domain/achievements.js').Achievements} Achievements
 * @typedef {import('../../tools/career/domain/endorsements.js').Endorsements} Endorsements
 * @typedef {import('../../tools/career/domain/wizard.js').WizardQuestion} WizardQuestion
 */
import { LitElement, html, css } from 'lit';
import { formatAchievedAt } from '../../tools/career/domain/achievements.js';
import { endorsedCount } from '../../tools/career/domain/endorsements.js';
import { sortQuestionsByDateDesc } from '../../tools/career/domain/wizard.js';

/** Etiquetas de estado de una consulta al brujo (MC-22). */
const QUESTION_BADGES = Object.freeze({
  pending: 'Esperando al brujo',
  answered: 'Respuesta lista',
  seen: 'Vista',
});

/** Formato de fechas de las consultas (misma localización que los logros). */
const questionDateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** Fecha legible de una consulta, o '—' si no la trae. @param {string} iso */
function formatQuestionDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : questionDateFmt.format(d);
}

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
    endorsements: { attribute: false },
    visitedIslands: { attribute: false },
    questions: { attribute: false },
    carpools: { attribute: false },
    coins: { attribute: false },
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
    /* Certificados avalados por el manager (JG-6): dorado, familia del sello. */
    .totals li.endorsed { color: #8a6400; }
    .totals li.endorsed .tick { font-weight: 900; }
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
    /* Carpools del jugador (CP-1): una fila por grupo, misma retícula que las islas. */
    .cps { list-style: none; margin: 0; padding: 0; }
    .cp {
      display: grid;
      grid-template-columns: minmax(120px, 1.2fr) auto minmax(90px, 1fr) auto;
      gap: 0.35rem 0.75rem;
      align-items: center;
      padding: 0.45rem 0;
      border-top: 1px solid var(--rm-border, #eef0f2);
      font-size: 0.85rem;
    }
    .cp .name { font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .cp .certs { color: var(--rm-muted, #6b7280); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cpstatus { font-size: 0.66rem; font-weight: 800; padding: 0.12rem 0.5rem; border-radius: 999px; white-space: nowrap; }
    .cpstatus.open { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .cpstatus.full { background: var(--rm-navy, #1e3a5f); color: #fff; }
    .cpstatus.completed { background: linear-gradient(135deg, #f6d365 0%, #e8b931 100%); color: #5b4300; }
    .cpstatus.closed { background: var(--rm-track, #e9f0f2); color: var(--rm-muted, #6b7280); }
    @media (max-width: 560px) {
      .cp { grid-template-columns: 1fr auto; }
      .cp .minibar { grid-column: 1 / -1; }
    }
    /* Tribbu-coins (CP-2): saldo y últimas transacciones del libro mayor. */
    .coinsbar { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; margin: 0.2rem 0 0.4rem; }
    .coinsbal { font-size: 1.15rem; font-weight: 800; color: var(--rm-navy, #1e3a5f); font-variant-numeric: tabular-nums; }
    .coinshint { font-size: 0.72rem; color: var(--rm-muted, #6b7280); }
    .coinstx { list-style: none; margin: 0; padding: 0; }
    .coinstx li {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 0.35rem 0.75rem;
      align-items: baseline;
      padding: 0.35rem 0;
      border-top: 1px solid var(--rm-border, #eef0f2);
      font-size: 0.83rem;
    }
    .coinstx .what { color: var(--rm-text, #111827); }
    .coinstx .when { font-size: 0.72rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }
    .coinstx .delta { font-weight: 800; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; white-space: nowrap; }
    /* Consultas al brujo (MC-22): una entrada por Q&A, todas las islas. */
    .wizqs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .wizq { border: 1px solid var(--rm-border, #eef0f2); border-radius: 10px; padding: 0.5rem 0.7rem; }
    .wmeta { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
    .wisle { font-size: 0.78rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .wmeta .when { font-size: 0.72rem; color: var(--rm-muted, #6b7280); }
    .wstatus { font-size: 0.66rem; font-weight: 800; padding: 0.12rem 0.5rem; border-radius: 999px; white-space: nowrap; }
    .wstatus.pending { background: #fdebc8; color: #8a5a00; }
    .wstatus.answered { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .wstatus.seen { background: var(--rm-track, #e9f0f2); color: var(--rm-muted, #6b7280); }
    .wtext { margin: 0.35rem 0 0; font-size: 0.83rem; color: var(--rm-text, #111827); white-space: pre-wrap; }
    .wizanswer {
      margin-top: 0.45rem;
      border-left: 3px solid var(--rm-accent, #2a9d8f);
      background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 8%, var(--rm-surface, #fff));
      border-radius: 0 8px 8px 0;
      padding: 0.4rem 0.6rem;
    }
    .wizanswer .wtext { margin: 0; }
    .wby { margin: 0.3rem 0 0; font-size: 0.72rem; font-style: italic; color: var(--rm-muted, #6b7280); }
  `;

  constructor() {
    super();
    this.playerName = '';
    /** @type {ArchipelagoProgress|null} */
    this.progress = null;
    /** @type {Achievements|null} */
    this.achievements = null;
    /**
     * Avales del manager (JG-6): alimenta el contador «N avalados ✓» de los
     * totales. null = el contenedor no los aporta y el contador no se pinta.
     * @type {Endorsements|null}
     */
    this.endorsements = null;
    /** @type {string[]} */
    this.visitedIslands = [];
    /** @type {WizardQuestion[]} */
    this.questions = [];
    /**
     * Carpools del jugador con su avance (CP-1), derivados por el contenedor
     * (career-app: sus carpools + su propio journey — sin lecturas extra).
     * null = el contenedor no los aporta (p. ej. mi-espacio): la sección no
     * se pinta. [] = aporta y no participa en ninguno.
     * @type {{ id: string, name: string, status: string, completed: number, total: number, pct: number }[]|null}
     */
    this.carpools = null;
    /**
     * Tribbu-coins del jugador (CP-2), derivados por el contenedor del ledger
     * verificable: saldo materializado y las últimas transacciones legibles
     * (razón + delta + fecha ISO). null = el contenedor no los aporta (p. ej.
     * mi-espacio): la sección no se pinta.
     * @type {{ balance: number, recent: { label: string, delta: number, ts: string }[] }|null}
     */
    this.coins = null;
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
        ${this._renderEndorsedTotal()}
      </ul>
      <p class="sub">Por isla</p>
      <ul class="isles">
        ${prog.islands.map((isle) => this._renderIsle(isle))}
      </ul>
      ${this._renderCoins()}
      ${this._renderCarpools()}
      <p class="sub">Consultas al brujo</p>
      ${this._renderQuestions()}
    `;
  }

  /**
   * Contador «N avalados ✓» de los totales (JG-6): certificados con el sello
   * del manager. Solo se pinta si el contenedor aporta los avales (null = la
   * sección de totales queda como estaba). La ficha lista islas, no
   * certificados individuales: el sello casa a casa vive en la tarjeta de
   * cada casa del juego.
   */
  _renderEndorsedTotal() {
    if (this.endorsements === null) return null;
    const n = endorsedCount(this.endorsements);
    return html`<li class="endorsed" title="Certificados avalados por el manager">
      <span class="tick" aria-hidden="true">✓</span> ${n} avalado${n === 1 ? '' : 's'}
    </li>`;
  }

  /**
   * Sección «Tribbu-coins» (CP-2): saldo del libro mayor y las últimas
   * transacciones legibles (razón + delta + fecha). Solo se pinta si el
   * contenedor la aporta (career-app la deriva del ledger verificable; en
   * mi-espacio no llega y la sección desaparece entera).
   */
  _renderCoins() {
    if (this.coins === null) return null;
    return html`
      <p class="sub">Tribbu-coins</p>
      <div class="coinsbar">
        <span class="coinsbal" title="Saldo de tribbu-coins según el libro mayor">🪙 ${this.coins.balance}</span>
        <span class="coinshint">emitidos solo por contratos: libro mayor firmado y auditable</span>
      </div>
      ${this.coins.recent.length === 0
        ? html`<p class="empty">Aún no hay transacciones: consigue certificados para ganar tribbu-coins.</p>`
        : html`<ul class="coinstx" aria-label="Últimas transacciones de tribbu-coins">
            ${this.coins.recent.map(
              (tx) => html`<li>
                <span class="what">${tx.label}</span>
                <span class="when">${formatQuestionDate(tx.ts)}</span>
                <span class="delta">+${tx.delta} 🪙</span>
              </li>`,
            )}
          </ul>`}
    `;
  }

  /**
   * Sección «Carpools» (CP-1): los grupos del jugador con su avance personal
   * (paradas X/Y y %). Solo se pinta si el contenedor aporta la lista (en
   * mi-espacio no llega y la sección desaparece entera).
   */
  _renderCarpools() {
    if (this.carpools === null) return null;
    return html`
      <p class="sub">Carpools</p>
      ${this.carpools.length === 0
        ? html`<p class="empty">Aún no participa en ningún carpool.</p>`
        : html`<ul class="cps">
            ${this.carpools.map(
              (cp) => html`<li class="cp">
                <span class="name">🚗 ${cp.name}</span>
                <span class="certs">${cp.completed}/${cp.total} paradas</span>
                <span
                  class="minibar"
                  role="progressbar"
                  aria-valuenow=${cp.pct}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label=${`Avance en el carpool ${cp.name}: ${cp.completed} de ${cp.total} paradas (${cp.pct}%)`}
                >
                  <span class="fill" style=${`width:${cp.pct}%`}></span>
                </span>
                <span class="cpstatus ${cp.status}">${PlayerCard.CARPOOL_STATUS_LABELS[cp.status] ?? cp.status}</span>
              </li>`,
            )}
          </ul>`}
    `;
  }

  /** Etiquetas legibles del estado de un carpool (CP-1). */
  static CARPOOL_STATUS_LABELS = Object.freeze({
    open: 'Abierto',
    full: 'Completo',
    completed: 'Terminado',
    closed: 'Cerrado',
  });

  /**
   * Las Q&A del brujo (MC-22), todas las islas, la más reciente primero
   * (ordenación defensiva en puro: el contenedor ya las manda ordenadas).
   * Cada entrada: isla, fecha, estado, la consulta y — si la hay — la
   * respuesta con su crédito (creditedTo releva a answeredBy).
   */
  _renderQuestions() {
    const questions = sortQuestionsByDateDesc(this.questions ?? []);
    if (questions.length === 0) {
      return html`<p class="empty">Aún no has hecho consultas.</p>`;
    }
    return html`<ul class="wizqs">
      ${questions.map((q) => {
        const credit = q.creditedTo ?? q.answeredBy?.name ?? '';
        return html`<li class="wizq">
          <div class="wmeta">
            <span class="wisle">🏝️ ${q.islandName !== '' ? q.islandName : q.islandId}</span>
            <span class="wstatus ${q.status}">${QUESTION_BADGES[q.status]}</span>
            <span class="when">${formatQuestionDate(q.createdAt)}</span>
          </div>
          <p class="wtext">${q.text}</p>
          ${q.answer
            ? html`<div class="wizanswer">
                <p class="wtext">${q.answer}</p>
                <p class="wby">${credit ? `— respondida por ${credit}` : '— respuesta del brujo'}</p>
              </div>`
            : null}
        </li>`;
      })}
    </ul>`;
  }
}

if (!customElements.get('player-card')) {
  customElements.define('player-card', PlayerCard);
}
