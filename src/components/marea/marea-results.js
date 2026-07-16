/**
 * <marea-results> — vista «Resultados» de Marea (RMR-TSK-0237). Lee el agregado
 * ANÓNIMO de la semana (/pulseAggregates/{weekIso}, lo calcula la Cloud Function)
 * y lo muestra en tres ámbitos: toda ingeniería, por gremio y por squad (label).
 * Solo medias y recuentos; nunca datos individuales, y solo grupos con >=3.
 */
import { LitElement, html, css } from 'lit';
import { getPulseAggregate, currentWeekKey } from '../../lib/pulse.js';
import { pulseReading } from '../../tools/pulse/domain/pulse.js';

const SCOPES = [
  ['general', 'Toda ingeniería'],
  ['guilds', 'Por gremio'],
  ['squads', 'Por squad'],
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
  static properties = {
    _agg: { state: true },
    _scope: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

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
    .refresh { margin-top: 1.2rem; }
    .refresh button { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
  `;

  constructor() {
    super();
    this._agg = null;
    this._scope = 'general';
    this._loading = false;
    this._error = '';
    this._loaded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._loaded) { this._loaded = true; this._load(); }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._agg = await getPulseAggregate(currentWeekKey());
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los resultados.';
    } finally {
      this._loading = false;
    }
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
      </div>`;
  }

  /** @param {{id:string,count:number,means:Record<string,number>}} group */
  _renderSegCard(group) {
    const read = pulseReading(group.means.energia, group.means.animo);
    return html`
      <div class="segcard">
        <div class="seg-h"><span class="seg-name">${group.id}</span><span class="seg-part">${group.count} pers.</span></div>
        <div class="seg-read"><span class="rdot" style="background:${readingColor(read.name)}"></span>${read.name}</div>
        <div class="mini">${BARS.map((b) => this._renderMiniBar(group.means, b))}</div>
      </div>`;
  }

  _renderGroups(list, emptyMsg) {
    if (!list?.length) return html`<p class="empty">${emptyMsg}</p>`;
    return html`<div class="segs">${list.map((g) => this._renderSegCard(g))}</div>`;
  }

  _renderScope() {
    if (this._scope === 'guilds') return this._renderGroups(this._agg?.guilds, 'Aún no hay gremios con 3 o más respuestas esta semana.');
    if (this._scope === 'squads') return this._renderGroups(this._agg?.labels, 'Aún no hay squads con 3 o más respuestas esta semana.');
    return this._renderGeneral();
  }

  render() {
    if (this._loading && !this._agg) return html`<p class="empty">Cargando resultados…</p>`;
    const respondents = this._agg?.respondents ?? 0;
    const total = this._agg?.totalPeople;
    return html`
      <div class="meta">
        <span class="parts"><b>${respondents}</b>${total ? html` de <b>${total}</b>` : ''} han marcado su marea</span>
        <span class="privacy">Visible para toda la tripulación · siempre anónimo · nunca por persona · mínimo ${this._agg?.minCount ?? 3} por grupo.</span>
      </div>
      <div class="scopebar" role="tablist" aria-label="Ámbito de los resultados">
        ${SCOPES.map(([id, label]) => html`
          <button role="tab" aria-selected=${this._scope === id} @click=${() => { this._scope = id; }}>${label}</button>`)}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : this._renderScope()}
      <div class="refresh"><button @click=${() => this._load()} ?disabled=${this._loading}>${this._loading ? 'Actualizando…' : 'Actualizar'}</button></div>
    `;
  }
}

if (!customElements.get('marea-results')) {
  customElements.define('marea-results', MareaResults);
}
