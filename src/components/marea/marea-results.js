/**
 * <marea-results> — vista «Resultados» de Marea (RMR-TSK-0237). Lee el agregado
 * ANÓNIMO de la semana (/pulseAggregates/{weekIso}, lo calcula la Cloud Function)
 * y lo muestra en tres ámbitos: toda ingeniería, por gremio y por squad (label).
 * Solo medias y recuentos; nunca datos individuales, y solo grupos con >=3.
 */
import { LitElement, html, css } from 'lit';
import { skeletonBlock } from '../app-skeleton.js';
import { watchPulseAggregate, getRecentPulseAggregates } from '../../lib/pulse.js';
import { pulseReading, isoWeekKey, parseWeekIso } from '../../tools/pulse/domain/pulse.js';
import { weekRangeLabel } from './weekLabel.js';
import { teamSignals } from '../../tools/pulse/domain/trends.js';
import { sparkline } from './sparkline.js';

const SCOPES = [
  ['general', 'Toda ingeniería'],
  ['departments', 'Por departamento'],
  ['guilds', 'Por gremio'],
  ['squads', 'Por squad'],
  ['trends', 'Tendencias'],
];

/** Dimensiones para la vista de tendencias (mismas 6, con nombre y sentido). */
const TREND_DIMS = [
  { key: 'energia', name: 'Energía', warnHigh: false },
  { key: 'animo', name: 'Ánimo', warnHigh: false },
  { key: 'carga', name: 'Carga', warnHigh: true },
  { key: 'rumbo', name: 'Rumbo', warnHigh: false },
  { key: 'tripulacion', name: 'Tripulación', warnHigh: false },
  { key: 'reconocimiento', name: 'Reconocimiento', warnHigh: false },
];

/** Anclas mostradas como barras. `warnHigh`: la atención es cuando el valor sube. */
const BARS = [
  { key: 'carga', name: 'Carga', warnHigh: true },
  { key: 'rumbo', name: 'Rumbo', warnHigh: false },
  { key: 'tripulacion', name: 'Tripul.', warnHigh: false },
  { key: 'reconocimiento', name: 'Recon.', warnHigh: false },
];

/** Color de la lectura del cuadrante (para el punto de cada grupo). */
function readingColor(name) {
  if (name === 'Viento a favor') return 'var(--gr-teal, #2a9d8f)';
  if (name === 'Mar de fondo') return 'var(--gr-navy, #1e3a5f)';
  if (name === 'Fondeado') return 'var(--gr-coral, #f2887a)';
  return 'var(--rm-muted, #5b6b7d)';
}

export class MareaResults extends LitElement {
  static styles = css`
    :host { display: block; --coral: var(--gr-coral, #f2887a); --teal: var(--gr-teal, #2a9d8f); --navy: var(--gr-navy, #1e3a5f); --amber: #d1902f; }
    .meta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.1rem; }
    .parts { font-size: 0.88rem; } .parts b { font-variant-numeric: tabular-nums; }
    .privacy { font-size: 0.7rem; color: var(--rm-muted, #5b6b7d); border-left: 2px solid var(--rm-border, #dde7ec); padding-left: 0.55rem; }
    .scopebar { display: inline-flex; gap: 0.3rem; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 999px; padding: 0.22rem; margin-bottom: 1.15rem; }
    .scopebar button { border: 0; background: transparent; font: inherit; font-size: 0.78rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); padding: 0.35rem 0.9rem; border-radius: 999px; cursor: pointer; }
    .scopebar button[aria-selected="true"] { background: var(--navy); color: var(--rm-on-accent, #fff); }
    .scopebar button:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }

    .general { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: clamp(1.1rem, 3vw, 2rem); align-items: center; }
    @media (max-width: 640px) { .general { grid-template-columns: 1fr; } }
    .grid { position: relative; aspect-ratio: 1/1; max-width: 260px; border-radius: 16px; border: 1px solid var(--rm-border, #dde7ec);
      background: linear-gradient(to right, color-mix(in srgb, var(--navy) 12%, transparent), color-mix(in srgb, var(--teal) 16%, transparent)) top / 100% 50% no-repeat,
        linear-gradient(to right, color-mix(in srgb, var(--rm-muted, #5b6b7d) 12%, transparent), color-mix(in srgb, var(--coral) 15%, transparent)) bottom / 100% 50% no-repeat; }
    .cross { position: absolute; background: var(--rm-border, #dde7ec); opacity: 0.7; }
    .cross.h { left: 0; right: 0; top: 50%; height: 1px; } .cross.v { top: 0; bottom: 0; left: 50%; width: 1px; }
    .buoy { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: var(--coral); border: 3px solid var(--rm-surface, #fff); box-shadow: 0 3px 12px color-mix(in srgb, var(--coral) 50%, transparent); }
    .team-read { font-size: 1rem; font-weight: 700; color: var(--rm-accent-700, var(--teal)); }
    .team-read span { font-weight: 400; color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; }

    .bars { display: flex; flex-direction: column; gap: 0.8rem; margin-top: 0.8rem; }
    .bar .b-top { display: flex; justify-content: space-between; font-size: 0.8rem; }
    .bar .b-top b { font-variant-numeric: tabular-nums; font-weight: 700; }
    .track { position: relative; height: 9px; border-radius: 999px; background: var(--rm-track, #e9f0f2); margin-top: 0.3rem; overflow: hidden; }
    .track .fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: linear-gradient(90deg, var(--teal), var(--gr-teal-600, #23867a)); }
    .track .fill.warn { background: linear-gradient(90deg, color-mix(in srgb, var(--amber) 75%, var(--coral)), var(--amber)); }

    .segs { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.9rem; }
    .segcard { border: 1px solid var(--rm-border, #dde7ec); border-radius: 14px; padding: 0.85rem 0.95rem; background: var(--rm-surface-hover, #f5fafa); display: flex; flex-direction: column; gap: 0.55rem; }
    .seg-h { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
    .seg-name { font-weight: 700; font-size: 0.9rem; } .seg-part { font-size: 0.72rem; color: var(--rm-muted, #5b6b7d); font-variant-numeric: tabular-nums; }
    .seg-read { display: inline-flex; align-items: center; gap: 0.42rem; font-size: 0.78rem; font-weight: 600; }
    .seg-read .rdot { width: 0.6rem; height: 0.6rem; border-radius: 50%; }
    .mini { display: flex; flex-direction: column; gap: 0.35rem; }
    .mb { display: grid; grid-template-columns: 3.6rem 1fr; align-items: center; gap: 0.5rem; font-size: 0.66rem; color: var(--rm-muted, #5b6b7d); }
    .mb .track { margin-top: 0; height: 6px; }
    .cloudwrap { margin-top: 1.5rem; }
    .cloudwrap h3 { margin: 0 0 0.35rem; font-size: 0.92rem; color: var(--rm-text, #1e3a5f); }
    .cloudwrap .note { font-size: 0.7rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.7rem; border-left: 2px solid var(--rm-border, #dde7ec); padding-left: 0.55rem; }
    .cloud { display: flex; flex-wrap: wrap; gap: 0.35rem 0.8rem; align-items: baseline; }
    .cloud .w { color: var(--rm-text, #1e3a5f); line-height: 1.25; }
    .cloud.compact { gap: 0.15rem 0.5rem; margin-top: 0.5rem; }
    .cloud.compact .w { color: var(--rm-muted, #5b6b7d); }

    .trends { display: grid; gap: 0.55rem; margin-bottom: 1.4rem; }
    .trow { display: grid; grid-template-columns: 8rem 1fr auto; align-items: center; gap: 0.8rem; padding: 0.55rem 0.8rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; background: var(--rm-surface, #fff); }
    @media (max-width: 560px) { .trow { grid-template-columns: 1fr auto; } .trow .tspark { grid-column: 1 / -1; } }
    .tname { font-weight: 600; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    .tspark { display: block; }
    .tval { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 1.02rem; color: var(--rm-text, #1e3a5f); }
    .tval small { font-weight: 400; color: var(--rm-muted, #5b6b7d); font-size: 0.7rem; }
    .note { font-size: 0.72rem; color: var(--rm-muted, #5b6b7d); } .note b { font-variant-numeric: tabular-nums; }
    .signals h3 { margin: 0 0 0.3rem; font-size: 0.92rem; color: var(--rm-text, #1e3a5f); }
    .signals .note { font-size: 0.7rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.7rem; border-left: 2px solid var(--rm-border, #dde7ec); padding-left: 0.55rem; }
    .signal { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.7rem 0.85rem; border-radius: 12px; margin-bottom: 0.5rem; font-size: 0.88rem; line-height: 1.35; background: var(--rm-surface-hover, #f5fafa); border-left: 4px solid var(--rm-border, #dde7ec); color: var(--rm-text, #1e3a5f); }
    .signal .dot { flex: none; width: 0.6rem; height: 0.6rem; border-radius: 50%; margin-top: 0.35rem; background: var(--rm-muted, #5b6b7d); }
    .signal.warn { border-left-color: var(--amber); } .signal.warn .dot { background: var(--amber); }
    .signal.good { border-left-color: var(--teal); } .signal.good .dot { background: var(--teal); }
    .signal.info { border-left-color: var(--rm-border, #dde7ec); }
    .weeknav { display: flex; align-items: center; justify-content: center; gap: 0.9rem; margin: 0.2rem 0 1.3rem; }
    .weeknav .wk { flex: none; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 999px; width: 36px; height: 36px; font-size: 1.3rem; line-height: 1; cursor: pointer; display: inline-grid; place-items: center; }
    .weeknav .wk:disabled { opacity: 0.35; cursor: default; }
    .weeknav .wk:hover:not(:disabled) { border-color: var(--teal); color: var(--teal); }
    .weeknav .wk:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
    .weeknav .wk-head { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; margin: 0; min-width: 10rem; }
    .weeknav .wk-title { font-weight: 800; font-size: 1.55rem; line-height: 1.05; color: var(--rm-text, #1e3a5f); font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
    .weeknav .wk-sub { font-weight: 500; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    .weeknav .wk-range { font-weight: 700; }
  `;

  static properties = {
    _agg: { state: true },
    _weeks: { state: true },
    _scope: { state: true },
    _weekOffset: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  constructor() {
    super();
    this._agg = null;
    this._weeks = [];
    this._weeksLoaded = false;
    this._scope = 'general';
    this._weekOffset = 0; // 0 = semana actual; N = N semanas atrás
    this._loading = false;
    this._error = '';
    this._unsub = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._subscribe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._unsub = null;
  }

  /** Clave ISO de la semana que se está viendo (según el offset). */
  _weekIso() {
    const ms = Date.now() - this._weekOffset * 7 * 24 * 60 * 60 * 1000;
    return isoWeekKey(new Date(ms));
  }

  /** (Re)suscribe EN VIVO al agregado de la semana visible (RMR-TSK-0252). */
  _subscribe() {
    this._unsub?.();
    this._loading = true;
    this._error = '';
    this._agg = null;
    this._unsub = watchPulseAggregate(
      this._weekIso(),
      (agg) => { this._agg = agg; this._loading = false; },
      (err) => { this._error = err instanceof Error ? err.message : 'No se pudieron cargar los resultados.'; this._loading = false; },
    );
  }

  /** Navega a una semana anterior (offset+1) o posterior (offset−1, tope en 0). */
  _shiftWeek(delta) {
    const next = Math.max(0, this._weekOffset + delta);
    if (next === this._weekOffset) return;
    this._weekOffset = next;
    this._subscribe();
  }

  /** ¿La barra merece color de atención? Carga alta o el resto bajo. */
  _warn(value, warnHigh) {
    return warnHigh ? value > 60 : value < 40;
  }

  _renderBar(means, bar) {
    const v = means[bar.key] ?? 0;
    const warn = this._warn(v, bar.warnHigh);
    return html`
      <div class="bar">
        <div class="b-top"><span>${bar.name}</span><b>${v}</b></div>
        <div class="track"><div class="fill ${warn ? 'warn' : ''}" style="width:${v}%"></div></div>
      </div>`;
  }

  _renderMiniBar(means, bar) {
    const v = means[bar.key] ?? 0;
    const warn = this._warn(v, bar.warnHigh);
    return html`<div class="mb"><span>${bar.name}</span><div class="track"><div class="fill ${warn ? 'warn' : ''}" style="width:${v}%"></div></div></div>`;
  }

  /** Una palabra de la nube: tamaño según su frecuencia relativa (anónima). */
  _renderWord(word, max) {
    const size = (0.85 + (word.count / max) * 0.95).toFixed(2);
    const weight = word.count > 1 ? 700 : 500;
    const times = `${word.count}×`;
    return html`<span class="w" style="font-size:${size}rem;font-weight:${weight}" title=${times}>${word.text}</span>`;
  }

  /**
   * Nube de palabras anónima de un ámbito. `compact` para las tarjetas de grupo.
   * @param {Array<{text:string,count:number}>|undefined} words
   */
  _renderWordCloud(words, compact = false) {
    if (!words?.length) return null;
    const max = Math.max(...words.map((w) => w.count));
    const cloud = html`<div class="cloud ${compact ? 'compact' : ''}">${words.map((w) => this._renderWord(w, max))}</div>`;
    if (compact) return cloud;
    return html`
      <div class="cloudwrap">
        <h3>Palabras de la semana</h3>
        <p class="note">Compartidas de forma voluntaria (opt-in) y anónima · nunca por persona.</p>
        ${cloud}
      </div>`;
  }

  _renderGeneral() {
    const g = this._agg?.general;
    if (!g?.means) {
      return html`<p class="empty">Aún no hay suficientes respuestas esta semana (mínimo ${this._agg?.minCount ?? 3}). En cuanto marquen su marea 3 personas, verás la media del equipo.</p>`;
    }
    const read = pulseReading(g.means.energia, g.means.animo);
    return html`
      <div class="general">
        <div>
          <div class="grid">
            <div class="cross h"></div><div class="cross v"></div>
            <div class="buoy" style="left:${g.means.animo}%;top:${100 - g.means.energia}%"></div>
          </div>
          <p class="team-read" style="margin:0.6rem 0 0">${read.name} <span>· ${read.sub}</span></p>
        </div>
        <div class="bars">${BARS.map((b) => this._renderBar(g.means, b))}</div>
      </div>
      ${this._renderWordCloud(g.words)}`;
  }

  /** @param {{id:string,count:number,means:Record<string,number>}} group */
  _renderSegCard(group) {
    const read = pulseReading(group.means.energia, group.means.animo);
    return html`
      <div class="segcard">
        <div class="seg-h"><span class="seg-name">${group.id}</span><span class="seg-part">${group.count} pers.</span></div>
        <div class="seg-read"><span class="rdot" style="background:${readingColor(read.name)}"></span>${read.name}</div>
        <div class="mini">${BARS.map((b) => this._renderMiniBar(group.means, b))}</div>
        ${this._renderWordCloud(group.words, true)}
      </div>`;
  }

  _renderGroups(list, emptyMsg) {
    if (!list?.length) return html`<p class="empty">${emptyMsg}</p>`;
    return html`<div class="segs">${list.map((g) => this._renderSegCard(g))}</div>`;
  }

  _renderScope() {
    // El departamento agrupa a toda la rama de un Head. Sigue el mismo umbral
    // que los demás cortes: si no llega al mínimo, no aparece (RMR-TSK-0296).
    if (this._scope === 'departments') return this._renderGroups(this._agg?.departments, 'Aún no hay departamentos con 3 o más respuestas esta semana.');
    if (this._scope === 'guilds') return this._renderGroups(this._agg?.guilds, 'Aún no hay gremios con 3 o más respuestas esta semana.');
    if (this._scope === 'squads') return this._renderGroups(this._agg?.labels, 'Aún no hay squads con 3 o más respuestas esta semana.');
    if (this._scope === 'trends') return this._renderTrends();
    return this._renderGeneral();
  }

  /** Carga perezosa de los agregados de las últimas semanas (para Tendencias). */
  async _loadTrends() {
    if (this._weeksLoaded) return;
    try {
      const aggs = await getRecentPulseAggregates(8);
      this._weeks = aggs
        .filter((a) => a.general?.means)
        .map((a) => ({ weekIso: a.weekIso, means: a.general.means, respondents: a.respondents, totalPeople: a.totalPeople }));
      this._weeksLoaded = true;
    } catch {
      /* sin histórico las tendencias quedan vacías (estado explicado) */
    }
  }

  _renderTrendRow(weeks, dim) {
    const values = weeks.map((w) => w.means[dim.key]);
    const latest = values.at(-1) ?? 0;
    const stroke = dim.warnHigh ? 'var(--coral)' : 'var(--teal)';
    return html`
      <div class="trow">
        <span class="tname">${dim.name}</span>
        <span class="tspark">${sparkline(values, { width: 160, stroke })}</span>
        <span class="tval">${latest}<small>/100</small></span>
      </div>`;
  }

  _renderSignals(signals) {
    if (!signals.length) {
      return html`<p class="empty">Sin señales destacadas: el equipo se mantiene estable estas semanas.</p>`;
    }
    return html`
      <div class="signals">
        <h3>Señales del equipo</h3>
        <p class="note">Para llevar a la Weekly o a los O2O · siempre del equipo, nunca de una persona.</p>
        ${signals.map((s) => html`<div class="signal ${s.level}"><span class="dot"></span><span>${s.text}</span></div>`)}
      </div>`;
  }

  _renderTrends() {
    const weeks = this._weeks;
    if (weeks.length < 2) {
      return html`<p class="empty">Necesitas al menos dos semanas con datos (mínimo ${this._agg?.minCount ?? 3} respuestas cada una) para ver tendencias. En cuanto se acumulen, aquí verás la evolución del equipo y señales para la Weekly y los O2O.</p>`;
    }
    return html`
      <p class="note" style="margin:0 0 0.9rem">Evolución del equipo en las últimas <b>${weeks.length}</b> semanas con datos (agregado anónimo).</p>
      <div class="trends">${TREND_DIMS.map((d) => this._renderTrendRow(weeks, d))}</div>
      ${this._renderSignals(teamSignals(weeks))}`;
  }

  /** Título de la semana visible + navegación (RMR-TSK-0252, RMR-BUG-0039). */
  _renderWeekNav() {
    const weekIso = this._weekIso();
    const parsed = parseWeekIso(weekIso);
    const isCurrent = this._weekOffset === 0;
    const week = parsed ? `Semana ${parsed.week}` : weekIso;
    // El rango de días da contexto a «Semana 30» (RMR-TSK-0273).
    const range = weekRangeLabel(weekIso);
    let sub = '';
    if (parsed) sub = isCurrent ? `${parsed.year} · esta semana` : String(parsed.year);
    // Se compone en JS (no en la plantilla) para no anidar ternarios.
    const rangeChip = range ? html`<span class="wk-range">${range}</span>` : null;
    let subContent = null;
    if (rangeChip && sub) subContent = html`${rangeChip} · ${sub}`;
    else if (rangeChip) subContent = rangeChip;
    else if (sub) subContent = html`${sub}`;
    return html`
      <div class="weeknav">
        <button class="wk" @click=${() => this._shiftWeek(1)} aria-label="Semana anterior" title="Semana anterior">‹</button>
        <h2 class="wk-head">
          <span class="wk-title">${week}</span>
          ${subContent ? html`<span class="wk-sub">${subContent}</span>` : null}
        </h2>
        <button class="wk" @click=${() => this._shiftWeek(-1)} ?disabled=${isCurrent} aria-label="Semana siguiente" title="Semana siguiente">›</button>
      </div>`;
  }

  _renderBody() {
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (this._scope === 'trends') return this._renderTrends();
    if (this._loading && !this._agg) return skeletonBlock('260px');
    return this._renderScope();
  }

  render() {
    const respondents = this._agg?.respondents ?? 0;
    const total = this._agg?.totalPeople;
    return html`
      <div class="meta">
        <span class="parts"><b>${respondents}</b>${total ? html` de <b>${total}</b>` : ''} han marcado su marea</span>
        <span class="privacy">Visible para toda la tripulación · siempre anónimo · nunca por persona · mínimo ${this._agg?.minCount ?? 3} por grupo.</span>
      </div>
      <div class="scopebar" role="tablist" aria-label="Ámbito de los resultados">
        ${SCOPES.map(([id, label]) => html`
          <button role="tab" aria-selected=${this._scope === id} @click=${() => { this._scope = id; if (id === 'trends') this._loadTrends(); }}>${label}</button>`)}
      </div>
      ${this._scope === 'trends' ? null : this._renderWeekNav()}
      ${this._renderBody()}
    `;
  }
}

if (!customElements.get('marea-results')) {
  customElements.define('marea-results', MareaResults);
}
