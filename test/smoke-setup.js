/**
 * Setup para el smoke test de evaluación de módulos (RMR-BUG-0015 guard).
 *
 * Shim MÍNIMO de `customElements` para poder EVALUAR los módulos de componentes
 * Lit en Node (cada uno hace `customElements.define(...)` al cargar): el objetivo
 * es solo evaluar el módulo (detectar TDZ/ciclos), NO montar el componente, así
 * que basta con que `define` no truene. No es un DOM real ni pretende serlo.
 */
if (!globalThis.customElements) {
  globalThis.customElements = {
    define() {},
    get() {
      return undefined;
    },
    whenDefined() {
      return Promise.resolve();
    },
  };
}
