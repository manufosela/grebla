/**
 * <career-progression-chart> — la curva de maduración del sub-nivel (épica
 * RMR-PCS-0037 · F2): SVG puro pintado desde `progressionSeries` (puntos %
 * contra la ruta del siguiente nivel vigente + hitos de promoción). Componente
 * TONTO: recibe la serie ya derivada, no carga nada. Sin puntos no renderiza
 * nada (la vista no inventa gráfica). Altura fija: cero layout shift.
 */
import { LitElement, html, svg, css } from 'lit';
import { SUB_LEVEL_THRESHOLDS } from '../../tools/career/domain/subLevel.js';

/** Geometría fija del lienzo (viewBox: escala con el ancho del contenedor). */
const W = 640;
const H = 170;
const M = Object.freeze({ top: 20, right: 10, bottom: 24, left: 36 });

export class CareerProgressionChart extends LitElement {
  static properties = {
    points: { attribute: false },
    milestones: { attribute: false },
  };

  static styles = css`
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; }
    .axis { stroke: var(--rm-border, #d1d5db); stroke-width: 1; }
    .grid { stroke: var(--rm-border, #e5e7eb); stroke-width: 1; stroke-dasharray: 3 3; }
    .curve { stroke: var(--rm-accent, #2a9d8f); stroke-width: 2; fill: none; }
    .dot { fill: var(--rm-accent, #2a9d8f); }
    .milestone { stroke: var(--rm-navy, #1e3a5f); stroke-width: 1.5; stroke-dasharray: 5 3; }
    .mlabel { fill: var(--rm-navy, #1e3a5f); font-size: 11px; font-weight: 700; }
    .tick { fill: var(--rm-muted, #5b6b7d); font-size: 10px; font-variant-numeric: tabular-nums; }
    @media (prefers-color-scheme: dark) {
      .milestone { stroke: var(--rm-navy, #93b4d6); }
      .mlabel { fill: var(--rm-navy, #93b4d6); }
    }
  `;

  constructor() {
    super();
    /** @type {Array<{ at: string, pct: number, sub: 1|2|3, levelCode: string }>} */
    this.points = [];
    /** @type {Array<{ at: string, fromCode: string|null, toCode: string, note: string|null }>} */
    this.milestones = [];
  }

  /** Escala temporal: fecha ISO → x en el lienzo (serie de un punto: centrado). */
  _xScale() {
    const ts = this.points.map((p) => Date.parse(p.at));
    const [min, max] = [Math.min(...ts), Math.max(...ts)];
    const span = max - min;
    const width = W - M.left - M.right;
    if (span === 0) return () => M.left + width / 2;
    return (at) => M.left + ((Date.parse(at) - min) / span) * width;
  }

  _y(pct) {
    return M.top + (1 - pct / 100) * (H - M.top - M.bottom);
  }

  render() {
    const points = Array.isArray(this.points) ? this.points : [];
    if (points.length === 0) return null;
    const x = this._xScale();
    const fmt = new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' });
    const first = points.at(0);
    const last = points.at(-1);
    // Curva en escalón (step-after): el % vale hasta el siguiente evento.
    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.at).toFixed(1)},${this._y(points[i - 1]?.pct ?? p.pct).toFixed(1)} L${x(p.at).toFixed(1)},${this._y(p.pct).toFixed(1)}`)
      .join(' ');
    const inRange = (m) => Date.parse(m.at) >= Date.parse(first.at) && Date.parse(m.at) <= Date.parse(last.at);
    const label = `Curva de progresión del sub-nivel: ${points.length} eventos desde ${first.at.slice(0, 10)}, ` +
      `de ${first.levelCode}.${first.sub} a ${last.levelCode}.${last.sub} (${last.pct}% hacia el siguiente nivel).`;
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${label}>
        ${[0, SUB_LEVEL_THRESHOLDS.consolidating, SUB_LEVEL_THRESHOLDS.atTheGates, 100].map(
          (pct) => svg`
            <line class=${pct === 0 ? 'axis' : 'grid'} x1=${M.left} x2=${W - M.right} y1=${this._y(pct)} y2=${this._y(pct)}></line>
            <text class="tick" x=${M.left - 6} y=${this._y(pct) + 3} text-anchor="end">${pct}%</text>
          `,
        )}
        ${(this.milestones ?? []).filter(inRange).map(
          (m) => svg`
            <line class="milestone" x1=${x(m.at)} x2=${x(m.at)} y1=${M.top - 4} y2=${H - M.bottom}>
              <title>${m.fromCode ? `${m.fromCode} → ` : ''}${m.toCode} · ${m.at.slice(0, 10)}${m.note ? ` — ${m.note}` : ''}</title>
            </line>
            <text class="mlabel" x=${x(m.at) + 3} y=${M.top - 7}>${m.toCode}</text>
          `,
        )}
        <path class="curve" d=${path}></path>
        ${points.map(
          (p) => svg`
            <circle class="dot" cx=${x(p.at)} cy=${this._y(p.pct)} r="3.2">
              <title>${p.at.slice(0, 10)} · ${p.levelCode}.${p.sub} · ${p.pct}%</title>
            </circle>
          `,
        )}
        <text class="tick" x=${M.left} y=${H - 8}>${fmt.format(new Date(first.at))}</text>
        <text class="tick" x=${W - M.right} y=${H - 8} text-anchor="end">${fmt.format(new Date(last.at))}</text>
      </svg>
    `;
  }
}

customElements.define('career-progression-chart', CareerProgressionChart);
