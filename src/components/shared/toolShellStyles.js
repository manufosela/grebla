/**
 * Estilos compartidos del «shell» de las herramientas de métricas (pestañas +
 * disclaimer de nivel-equipo): los usan <dora-app> y <lean-app> para no duplicar
 * el mismo CSS. Añádelo a `static styles` (Lit acepta un CSSResult o un array).
 */
import { css } from 'lit';

export const toolShellStyles = css`
  :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
  .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .tab { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280); border-radius: 999px; padding: 0.4rem 1rem; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
  .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
  .tab:hover:not(.active) { color: var(--rm-text, #111827); }
  .loading { padding: 2rem; text-align: center; color: var(--rm-muted, #6b7280); border: 1px dashed var(--rm-border, #d1d5db); border-radius: var(--rm-radius, 12px); }
  .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; }
  .disclaimer {
    display: flex; gap: 0.5rem; align-items: baseline;
    background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f);
    border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-accent, #2a9d8f);
    border-radius: 10px; padding: 0.55rem 0.85rem; margin-bottom: 1rem; font-size: 0.85rem;
  }
  .disclaimer strong { font-weight: 700; }
`;
