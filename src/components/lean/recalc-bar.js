/**
 * Barra de recálculo compartida por las vistas de LEAN (Métricas y Atascos):
 * botón «↻ Recalcular desde Linear» + fecha del último cálculo. Se extrae aquí
 * para no duplicar estilos ni lógica entre componentes.
 */
import { html, css } from 'lit';

export const STAMP_FMT = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

export const recalcBarStyles = css`
  .bar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0 0 1.1rem; }
  .rebtn {
    border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: #fff;
    border-radius: 8px; padding: 0.45rem 0.9rem; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer;
  }
  .rebtn:disabled { opacity: 0.6; cursor: progress; }
  .rebtn:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: 2px; }
  .updated { font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
`;

/** Fecha del último cálculo (la más reciente entre todas las unidades), o null. */
export function lastComputedAt(summary) {
  const units = [...(summary?.squads?.units ?? []), ...(summary?.chapters?.units ?? [])];
  const stamps = units.map((u) => u.metrics?.computedAt).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return stamps.at(-1) ?? null;
}

/** Barra: botón recalcular (si hay `refresh`) + fecha del último cálculo. */
export function renderRecalcBar({ refresh, refreshing, computedAt, onRefresh }) {
  const btnLabel = refreshing ? 'Recalculando…' : '↻ Recalcular desde Linear';
  const button = refresh
    ? html`<button class="rebtn" ?disabled=${refreshing} @click=${onRefresh}>${btnLabel}</button>`
    : null;
  const stamp = computedAt
    ? html`<span class="updated">Actualizado el ${STAMP_FMT.format(new Date(computedAt))}</span>`
    : null;
  return html`<div class="bar">${button}${stamp}</div>`;
}

/**
 * Recalcula desde Linear sobre un host Lit que expone `refresh()`, `_load()` y
 * los estados `_refreshing`/`_error`. Centraliza el manejo de error/estado.
 */
export async function runRecalc(host) {
  if (!host.refresh || host._refreshing) return;
  host._refreshing = true;
  host._error = '';
  try {
    await host.refresh();
    await host._load();
  } catch (err) {
    host._error = err instanceof Error ? err.message : 'No se pudo recalcular desde Linear.';
  } finally {
    host._refreshing = false;
  }
}
