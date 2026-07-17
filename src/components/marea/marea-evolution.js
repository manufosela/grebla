/**
 * <marea-evolution> — «Mi evolución» de Marea (RMR-TSK-0241): la trayectoria
 * PRIVADA de la propia persona semana a semana. Lee su histórico (getMyPulseHistory;
 * las reglas restringen /pulse/{uid} a su dueño), lo agrupa por semana ISO y pinta,
 * por cada dimensión, una sparkline y una lectura de tendencia (mejora / estable /
 * empeora). Nadie más la ve: no hay agregado ni exposición al manager.
 */
import { LitElement, html, css } from 'lit';
import { getMyPulseHistory } from '../../lib/pulse.js';
import { pulseReading } from '../../tools/pulse/domain/pulse.js';
import { weeklyMeans, netTrend, trendSentiment } from '../../tools/pulse/domain/evolution.js';
import { sparkline } from './sparkline.js';

/** Dimensiones mostradas. `warnHigh`: un valor alto es señal de atención (carga). */
const DIMS = [
  { key: 'energia', name: 'Energía', warnHigh: false },
  { key: 'animo', name: 'Ánimo', warnHigh: false },
  { key: 'carga', name: 'Carga', warnHigh: true },
  { key: 'rumbo', name: 'Rumbo', warnHigh: false },
  { key: 'tripulacion', name: 'Tripulación', warnHigh: false },
  { key: 'reconocimiento', name: 'Reconocimiento', warnHigh: false },
];

/** Etiqueta y clase del chip de tendencia a partir del sentimiento puro. */
const SENTIMENT = {
  better: { label: 'Mejora', cls: 'up' },
  worse: { label: 'Empeora', cls: 'down' },
  steady: { label: 'Estable', cls: 'flat' },
};

/** Flecha según la dirección numérica de la tendencia. */
const ARROW = { up: '↑', down: '↓', flat: '→' };

const SPARK_W = 132;
const SPARK_H = 30;

export class MareaEvolution extends LitElement {
  static properties = {
    uid: { attribute: false },
    _weeks: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--gr-teal, #2a9d8f); --coral: var(--gr-coral, #f2887a); --navy: var(--gr-navy, #1e3a5f); }
    .intro { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.1rem; }
    .intro .weeks { font-size: 0.88rem; } .intro .weeks b { font-variant-numeric: tabular-nums; }
    .privacy { font-size: 0.7rem; color: var(--rm-muted, #5b6b7d); border-left: 2px solid var(--rm-border, #dde7ec); padding-left: 0.55rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; padding: 1rem 0; max-width: 60ch; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .reading { font-size: 1rem; font-weight: 700; color: var(--rm-accent-700, var(--teal)); margin: 0 0 1.1rem; }
    .reading span { font-weight: 400; color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; }

    .rows { display: grid; gap: 0.65rem; }
    .row {
      display: grid; grid-template-columns: 8rem ${SPARK_W}px auto 1fr; align-items: center; gap: 0.8rem;
      padding: 0.6rem 0.8rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; background: var(--rm-surface, #fff);
    }
    @media (max-width: 560px) {
      .row { grid-template-columns: 1fr auto; row-gap: 0.5rem; }
      .row .spark { grid-column: 1 / -1; }
    }
    .name { font-weight: 600; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    .spark { display: block; }
    .val { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 1.05rem; color: var(--rm-text, #1e3a5f); }
    .val small { font-weight: 400; color: var(--rm-muted, #5b6b7d); font-size: 0.7rem; }
    .chip { justify-self: start; display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; }
    .chip.up { color: #0c1420; background: color-mix(in srgb, var(--teal) 35%, transparent); }
    .chip.down { color: var(--rm-danger, #b91c1c); background: color-mix(in srgb, var(--coral) 30%, transparent); }
    .chip.flat { color: var(--rm-muted, #5b6b7d); background: var(--rm-surface-hover, #eef3f5); }
    .refresh { margin-top: 1.2rem; }
    .refresh button { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
  `;

  constructor() {
    super();
    this.uid = null;
    this._weeks = [];
    this._loading = false;
    this._error = '';
    this._loaded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._loaded && this.uid) { this._loaded = true; this._load(); }
  }

  updated(changed) {
    // El uid puede llegar después de montar (lo inyecta el glue tras resolver auth).
    if (changed.has('uid') && this.uid && !this._loaded) { this._loaded = true; this._load(); }
  }

  async _load() {
    if (!this.uid) return;
    this._loading = true;
    this._error = '';
    try {
      const history = await getMyPulseHistory(this.uid, 90);
      this._weeks = weeklyMeans(history);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar tu evolución.';
    } finally {
      this._loading = false;
    }
  }

  /** Sparkline (helper compartido): values (0..100) de más antigua a más reciente. */
  _spark(values, warn) {
    const stroke = warn ? 'var(--coral)' : 'var(--teal)';
    return sparkline(values, { width: SPARK_W, height: SPARK_H, stroke });
  }

  _renderRow(dim) {
    const values = this._weeks.map((w) => w.means[dim.key]);
    const trend = netTrend(values);
    const sentiment = SENTIMENT[trendSentiment(trend.dir, dim.warnHigh)];
    const latest = values.at(-1) ?? 0;
    const arrow = ARROW[trend.dir];
    return html`
      <div class="row">
        <span class="name">${dim.name}</span>
        <span class="spark">${this._spark(values, dim.warnHigh)}</span>
        <span class="val">${latest}<small>/100</small></span>
        <span class="chip ${sentiment.cls}">${arrow} ${sentiment.label}</span>
      </div>`;
  }

  render() {
    if (this._loading && !this._weeks.length) return html`<p class="empty">Cargando tu evolución…</p>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    const n = this._weeks.length;
    if (n === 0) {
      return html`<p class="empty">Aún no has registrado ninguna marea. En cuanto marques la tuya unas semanas, aquí verás tu trayectoria (energía, ánimo y las cuatro anclas) y si estás estable, mejorando o empeorando.</p>`;
    }
    const latest = this._weeks.at(-1).means;
    const read = pulseReading(latest.energia, latest.animo);
    return html`
      <div class="intro">
        <span class="weeks"><b>${n}</b> ${n === 1 ? 'semana registrada' : 'semanas registradas'}</span>
        <span class="privacy">Es tuya y privada: solo la ves tú. Nadie más —tampoco tu manager— tiene acceso a tu evolución.</span>
      </div>
      <p class="reading">Tu última semana: ${read.name} <span>· ${read.sub}</span></p>
      ${n === 1
        ? html`<p class="empty">Con una sola semana aún no hay tendencia: la trayectoria gana sentido a partir de la segunda.</p>`
        : null}
      <div class="rows">${DIMS.map((d) => this._renderRow(d))}</div>
      <div class="refresh"><button @click=${() => this._load()} ?disabled=${this._loading}>${this._loading ? 'Actualizando…' : 'Actualizar'}</button></div>
    `;
  }
}

if (!customElements.get('marea-evolution')) {
  customElements.define('marea-evolution', MareaEvolution);
}
