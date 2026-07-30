/**
 * Disposición del creador visual de flujos (RMR-TSK-0344). Dominio puro.
 *
 * Deriva las ARISTAS del grafo de la encuesta (salto por defecto + reglas), un
 * AUTO-LAYOUT inicial de las posiciones y la CURVA (path SVG) entre dos puntos.
 * El modelo de grafo vive en `flow.js`; esto es solo la capa de dibujo.
 */
import { END, ruleLabel } from './flow.js';

/**
 * Aristas del grafo: por cada pregunta, sus reglas (etiquetadas con su condición,
 * p. ej. «> 8», «≤ 5», «Ventas») y su salto por defecto (`next`, la siguiente en
 * orden, o `END`). El destino `to` puede ser `END` (nodo final).
 * @returns {Array<{ from: string, to: string, label: string|null }>}
 */
export function flowEdges(questions) {
  const list = questions ?? [];
  const edges = [];
  list.forEach((q, i) => {
    for (const rule of (Array.isArray(q?.rules) ? q.rules : [])) {
      if (rule?.goto) edges.push({ from: q.id, to: rule.goto, label: ruleLabel(rule) });
    }
    if (q?.next) edges.push({ from: q.id, to: q.next, label: null });
    else if (i + 1 < list.length) edges.push({ from: q.id, to: list[i + 1].id, label: null });
    else edges.push({ from: q.id, to: END, label: null });
  });
  return edges;
}

/**
 * Auto-layout inicial: una columna de nodos separada verticalmente, con el nodo
 * `END` al final. Sencillo pero legible; el usuario luego los recoloca.
 * @returns {Record<string, {x:number,y:number}>}
 */
export function autoLayout(questions, { x = 60, y0 = 40, gapY = 130 } = {}) {
  const layout = {};
  const list = questions ?? [];
  list.forEach((q, i) => { layout[q.id] = { x, y: y0 + i * gapY }; });
  layout[END] = { x, y: y0 + list.length * gapY };
  return layout;
}

/**
 * Combina las posiciones guardadas con el auto-layout: usa la guardada si es
 * válida, o la calculada. Así los nodos nuevos (sin posición) también aparecen.
 */
export function resolveLayout(questions, saved) {
  const auto = autoLayout(questions);
  const out = {};
  for (const id of Object.keys(auto)) {
    const pos = saved?.[id];
    out[id] = (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) ? { x: pos.x, y: pos.y } : auto[id];
  }
  return out;
}

/** Curva bezier vertical entre dos puntos (salida por abajo, entrada por arriba). */
export function edgePath(from, to) {
  const dy = Math.max(30, Math.abs(to.y - from.y) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`;
}

/**
 * Curva lateral para una arista condicional: sale y entra por el lado derecho y
 * se abomba hacia fuera, de modo que un salto que cruza varios nodos NO quede
 * oculto tras la columna del salto por defecto. `bulge` la separa de la columna.
 */
export function sideEdgePath(from, to, bulge = 56) {
  const cx = Math.max(from.x, to.x) + bulge;
  return `M ${from.x} ${from.y} C ${cx} ${from.y}, ${cx} ${to.y}, ${to.x} ${to.y}`;
}
