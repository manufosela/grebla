import { LitElement, html, css } from 'lit';

/**
 * <app-skeleton> — placeholder de carga reutilizable (RMR-TSK-0263).
 *
 * Reserva el hueco del contenido que aún carga para que NO haya salto de layout
 * (CLS): la caja ocupa desde el primer pintado el mismo sitio que ocupará el
 * contenido real. Se usa igual en páginas Astro (light DOM) y dentro de otros
 * componentes Lit.
 *
 * Atributos:
 *  - `w`      ancho CSS (def. 100%).
 *  - `h`      alto CSS de cada barra (def. 1rem).
 *  - `radius` radio del borde (def. var(--rm-radius, 8px)).
 *  - `lines`  nº de barras de texto; con >1 pinta varias y la última más corta.
 *  - `gap`    separación entre barras (def. 0.55rem).
 *
 * Ejemplos:
 *   <app-skeleton h="140px"></app-skeleton>              <!-- bloque -->
 *   <app-skeleton lines="3"></app-skeleton>              <!-- 3 líneas de texto -->
 *   <app-skeleton w="60%" h="1.4rem"></app-skeleton>     <!-- una barra -->
 */
export class AppSkeleton extends LitElement {
  static properties = {
    w: { type: String },
    h: { type: String },
    radius: { type: String },
    lines: { type: Number },
    gap: { type: String },
  };

  static styles = css`
    :host { display: block; }
    .stack { display: flex; flex-direction: column; }
    .bar {
      /* Base + brillo que barre: reserva el hueco sin depender de imágenes. */
      background:
        linear-gradient(90deg,
          var(--rm-track, #e9eef1) 0%,
          color-mix(in srgb, var(--rm-track, #e9eef1) 55%, #fff) 50%,
          var(--rm-track, #e9eef1) 100%);
      background-size: 200% 100%;
      animation: sk-shimmer 1.3s ease-in-out infinite;
    }
    @keyframes sk-shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
    /* Accesibilidad: sin animación si el usuario la reduce (queda el hueco fijo). */
    @media (prefers-reduced-motion: reduce) {
      .bar { animation: none; }
    }
  `;

  constructor() {
    super();
    this.w = '100%';
    this.h = '1rem';
    this.radius = 'var(--rm-radius, 8px)';
    this.lines = 1;
    this.gap = '0.55rem';
  }

  render() {
    const count = Math.max(1, Number(this.lines) || 1);
    const bars = Array.from({ length: count }, (_, i) => {
      // Con varias líneas, la última se acorta para leerse como párrafo real.
      const width = count > 1 && i === count - 1 ? '65%' : this.w;
      return html`<span
        class="bar"
        style=${`width:${width};height:${this.h};border-radius:${this.radius}`}
      ></span>`;
    });
    return html`<div
      class="stack"
      style=${`gap:${this.gap}`}
      role="status"
      aria-busy="true"
      aria-label="Cargando…"
    >${bars}</div>`;
  }
}

customElements.define('app-skeleton', AppSkeleton);

// Helpers de forma para los estados de carga de las herramientas (RMR-TSK-0263):
// importar cualquiera registra <app-skeleton> (efecto de carga del módulo).

/** Skeleton de un bloque (gráfica, panel, mapa). @param {string} [h] alto CSS. */
export function skeletonBlock(h = '180px') {
  return html`<app-skeleton h=${h}></app-skeleton>`;
}

/** Skeleton de varias líneas (listas, tablas, resúmenes). @param {number} [n] @param {string} [h] */
export function skeletonLines(n = 4, h = '0.95rem') {
  return html`<app-skeleton lines=${n} h=${h} gap="0.7rem"></app-skeleton>`;
}
