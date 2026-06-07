/**
 * <role-result>
 * Componente presentacional del perfil calculado. Recibe el perfil ya calculado
 * y, opcionalmente, la brecha contra un rol objetivo. Emite `target-changed`
 * cuando el usuario elige un rol objetivo distinto.
 *
 * Propiedades (asignadas como propiedades JS, no atributos):
 *  - profile: import('../lib/scoring.js').Profile
 *  - roles:   import('../data/roles.js').Role[]
 *  - targetRole: string|null
 *  - gap: import('../lib/scoring.js').DimensionGap[]|null
 */
import { LitElement, html, css, svg } from 'lit';

export class RoleResult extends LitElement {
  static properties = {
    profile: { attribute: false },
    roles: { attribute: false },
    targetRole: { attribute: false },
    gap: { attribute: false },
  };

  static styles = css`
    :host {
      display: block;
      font-family: var(--rm-font, system-ui, sans-serif);
      color: var(--rm-text, #111827);
    }
    .empty {
      padding: 2rem;
      text-align: center;
      color: var(--rm-muted, #6b7280);
      border: 1px dashed var(--rm-border, #d1d5db);
      border-radius: var(--rm-radius, 12px);
    }
    .dominant {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
      border-left: 6px solid var(--dominant-color, #3b82f6);
    }
    .dominant .role {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0;
    }
    .dominant .tagline {
      margin: 0.4rem 0 0;
      color: var(--rm-muted, #4b5563);
    }
    .dominant .pct {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      color: var(--dominant-color, #3b82f6);
    }
    .dominant .runners {
      margin: 0.5rem 0 0;
      font-size: 0.82rem;
      color: var(--rm-muted, #6b7280);
    }
    .dominant .runner { font-weight: 600; font-variant-numeric: tabular-nums; }
    h3 {
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rm-muted, #6b7280);
      margin: 1.75rem 0 0.75rem;
    }
    .bars {
      display: grid;
      gap: 0.5rem;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 11ch 1fr 5ch;
      align-items: center;
      gap: 0.6rem;
    }
    .bar-label {
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar-track {
      height: 12px;
      background: var(--rm-track, #f3f4f6);
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease;
    }
    .bar-val {
      font-size: 0.8rem;
      font-variant-numeric: tabular-nums;
      text-align: right;
      color: var(--rm-muted, #6b7280);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(240px, 1.2fr);
      gap: 1.5rem;
      align-items: center;
    }
    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; }
    }
    .radar { width: 100%; height: auto; }
    .radar-grid { fill: none; stroke: var(--rm-border, #e5e7eb); }
    .radar-axis { stroke: var(--rm-border, #e5e7eb); }
    .radar-user { fill: color-mix(in srgb, var(--rm-accent, #3b82f6) 22%, transparent); stroke: var(--rm-accent, #3b82f6); stroke-width: 2; }
    .radar-ideal { fill: color-mix(in srgb, var(--rm-warning, #f59e0b) 14%, transparent); stroke: var(--rm-warning, #f59e0b); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .radar-label { font-size: 7px; fill: var(--rm-muted, #6b7280); }
    .legend { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin-top: 0.5rem; }
    .legend .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; margin-right: 0.35rem; }
    .target {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin: 1.75rem 0 0.5rem;
    }
    select {
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      font-size: 0.9rem;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .gap-pos { color: var(--rm-danger, #dc2626); font-weight: 600; }
    .gap-neg { color: var(--rm-success, #16a34a); font-weight: 600; }
  `;

  constructor() {
    super();
    /** @type {import('../lib/scoring.js').Profile|null} */
    this.profile = null;
    /** @type {import('../data/roles.js').Role[]} */
    this.roles = [];
    /** @type {string|null} */
    this.targetRole = null;
    /** @type {import('../lib/scoring.js').DimensionGap[]|null} */
    this.gap = null;
  }

  _onTargetChange(event) {
    const value = event.target.value || null;
    this.dispatchEvent(
      new CustomEvent('target-changed', { detail: { targetRole: value }, bubbles: true, composed: true }),
    );
  }

  render() {
    const profile = this.profile;
    if (!profile || !profile.dominant) {
      return html`<div class="empty">Responde el cuestionario para ver tu perfil.</div>`;
    }
    const dominant = profile.dominant;
    return html`
      <div class="dominant" style=${`--dominant-color:${dominant.color}`}>
        <p class="role">${dominant.label}</p>
        <p class="tagline">${dominant.tagline}</p>
        <p class="pct">${Math.round(dominant.affinity)}% de afinidad · ${Math.round(profile.completion)}% completado</p>
        ${this._renderRunnersUp(profile.affinities)}
      </div>

      <h3>Afinidad por rol</h3>
      <div class="bars">
        ${profile.affinities.map(
          (a) => html`
            <div class="bar-row">
              <span class="bar-label" title=${a.label}>${a.label}</span>
              <span class="bar-track">
                <span class="bar-fill" style=${`width:${a.affinity}%;background:${a.color}`}></span>
              </span>
              <span class="bar-val">${Math.round(a.affinity)}%</span>
            </div>
          `,
        )}
      </div>

      <h3>Mapa de competencias por dimensión</h3>
      <div class="grid">
        ${this._renderRadar(profile.byDimension)}
        ${this._renderDimensionBars(profile.byDimension)}
      </div>

      ${this._renderTarget()}
    `;
  }

  /** Los 2 roles más próximos al dominante (con afinidad > 0). */
  _renderRunnersUp(affinities) {
    const runners = (affinities || []).slice(1, 3).filter((a) => a.affinity > 0);
    if (runners.length === 0) return null;
    return html`
      <p class="runners">
        También cerca:
        ${runners.map(
          (a, i) => html`${i > 0 ? html` · ` : ''}<span class="runner" style=${`color:${a.color}`}>${a.label} ${Math.round(a.affinity)}%</span>`,
        )}
      </p>
    `;
  }

  /** @param {import('../lib/scoring.js').DimensionLevel[]} dims */
  _renderRadar(dims) {
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const n = dims.length;
    if (n === 0) return null;

    const pointAt = (value, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (value / 100) * radius;
      return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
    };
    const ringPoints = (value) =>
      dims.map((_, i) => pointAt(value, i).join(',')).join(' ');

    const userPoints = dims.map((d, i) => pointAt(d.level, i).join(',')).join(' ');
    const idealPoints = this.gap
      ? this.gap.map((g, i) => pointAt(g.ideal, i).join(',')).join(' ')
      : null;

    return svg`
      <svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Mapa de competencias">
        ${[25, 50, 75, 100].map(
          (ring) => svg`<polygon class="radar-grid" points=${ringPoints(ring)} />`,
        )}
        ${dims.map((_, i) => {
          const [x, y] = pointAt(100, i);
          return svg`<line class="radar-axis" x1=${center} y1=${center} x2=${x} y2=${y} />`;
        })}
        ${idealPoints ? svg`<polygon class="radar-ideal" points=${idealPoints} />` : null}
        <polygon class="radar-user" points=${userPoints} />
        ${dims.map((d, i) => {
          const [x, y] = pointAt(118, i);
          return svg`<text class="radar-label" x=${x} y=${y} text-anchor="middle" dominant-baseline="middle">${d.label}</text>`;
        })}
      </svg>
    `;
  }

  /** @param {import('../lib/scoring.js').DimensionLevel[]} dims */
  _renderDimensionBars(dims) {
    return html`
      <div class="bars">
        ${dims.map(
          (d) => html`
            <div class="bar-row">
              <span class="bar-label" title=${d.label}>${d.label}</span>
              <span class="bar-track">
                <span class="bar-fill" style=${`width:${d.level}%;background:var(--rm-accent,#3b82f6)`}></span>
              </span>
              <span class="bar-val">${Math.round(d.level)}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  _renderTarget() {
    return html`
      <div class="target">
        <label for="target">Compara tu perfil con el de un rol objetivo:</label>
        <select id="target" @change=${this._onTargetChange} .value=${this.targetRole ?? ''}>
          <option value="">— Sin comparación —</option>
          ${this.roles.map(
            (r) => html`<option value=${r.key} ?selected=${r.key === this.targetRole}>${r.label}</option>`,
          )}
        </select>
      </div>
      ${this.gap && this.targetRole ? this._renderGapTable() : null}
      <div class="legend">
        <span><span class="swatch" style="background:var(--rm-accent,#3b82f6)"></span>Tu perfil</span>
        ${this.targetRole
          ? html`<span><span class="swatch" style="background:var(--rm-warning,#f59e0b)"></span>Perfil objetivo</span>`
          : null}
      </div>
    `;
  }

  _renderGapTable() {
    const gap = this.gap ?? [];
    return html`
      <table>
        <thead>
          <tr>
            <th>Dimensión</th>
            <th class="num">Tú</th>
            <th class="num">Objetivo</th>
            <th class="num">Brecha</th>
          </tr>
        </thead>
        <tbody>
          ${gap.map(
            (g) => html`
              <tr>
                <td>${g.label}</td>
                <td class="num">${Math.round(g.user)}</td>
                <td class="num">${Math.round(g.ideal)}</td>
                <td class="num ${g.gap > 0 ? 'gap-pos' : 'gap-neg'}">
                  ${g.gap > 0 ? '+' : ''}${Math.round(g.gap)}
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }
}

if (!customElements.get('role-result')) {
  customElements.define('role-result', RoleResult);
}
