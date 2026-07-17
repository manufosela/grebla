/**
 * Sparkline compartida de Marea (RMR-TSK-0239): una mini-gráfica de línea para una
 * serie de valores 0..100 (de más antiguo a más reciente). La usan «Mi evolución»
 * (marea-evolution) y «Tendencias» (marea-results) para no duplicar el SVG.
 *
 * GOTCHA (aprendido en RMR-TSK-0241): el color de trazo va por `style` (CSS real),
 * NO como atributo de presentación SVG (`stroke="var(--x)"` no resuelve la custom
 * property y la línea sale invisible).
 */
import { html } from 'lit';

/**
 * @param {number[]} values  valores 0..100, de más antiguo a más reciente
 * @param {{ width?: number, height?: number, stroke?: string }} [opts]
 * @returns {import('lit').TemplateResult|null}
 */
export function sparkline(values, opts = {}) {
  const width = opts.width ?? 132;
  const height = opts.height ?? 30;
  const stroke = opts.stroke ?? 'var(--gr-teal, #2a9d8f)';
  const nums = (values ?? []).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const x = (i) => (nums.length === 1 ? width / 2 : (i / (nums.length - 1)) * width);
  const y = (v) => height - (v / 100) * height;
  const last = nums.at(-1);
  const points = nums.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return html`
    <svg width=${width} height=${height} viewBox="0 0 ${width} ${height}" aria-hidden="true" style="display:block">
      <line x1="0" y1=${height / 2} x2=${width} y2=${height / 2} style="stroke:var(--rm-border, #dde7ec)" stroke-width="1" />
      ${nums.length > 1
        ? html`<polyline fill="none" style="stroke:${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points=${points} />`
        : null}
      <circle cx=${x(nums.length - 1)} cy=${y(last)} r="3.2" style="fill:${stroke}" />
    </svg>`;
}
