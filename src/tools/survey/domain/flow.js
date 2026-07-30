/**
 * Motor de flujo de la encuesta (RMR-TSK-0337). Dominio puro (sin Firebase).
 *
 * Una encuesta es un grafo dirigido: cada pregunta puede definir `next` (id de la
 * siguiente, `END` para terminar, o ausente = la siguiente en orden) y `rules`
 * `[{ op, value, goto }]` que desvían según la respuesta. `op` es un operador de
 * comparación (=, ≠, >, ≥, <, ≤); las reglas se evalúan EN ORDEN y gana la
 * primera que se cumple. Sin `next` ni `rules`, el flujo es lineal (retrocompat).
 *
 * Compatibilidad: las reglas antiguas `{ equals, goto }` se leen como `op:'eq'`.
 */

export const END = '__end__';

/** Operadores de condición disponibles (el orden es el del selector del editor). */
export const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
const OP_SYMBOL = { eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };

/** Operador de una regla (compat: sin `op` → igualdad). */
export const ruleOp = (rule) => rule?.op ?? 'eq';
/** Valor comparado por una regla (compat: la forma antigua usaba `equals`). */
export const ruleValue = (rule) => (rule && 'op' in rule ? rule.value : rule?.equals);

/** Etiqueta legible de una regla para el lienzo (p. ej. «> 8», «≤ 5», «Ventas»). */
export function ruleLabel(rule) {
  const op = ruleOp(rule);
  const value = ruleValue(rule);
  return op === 'eq' ? String(value) : `${OP_SYMBOL[op] ?? op} ${value}`;
}

/**
 * ¿Se cumple la condición (`op` `value`) para `answer`? Las comparaciones de
 * orden (>, ≥, <, ≤) solo aplican a números; con no-números devuelven `false`.
 */
export function ruleMatches(op, answer, value) {
  switch (op) {
    case 'eq': return answer === value;
    case 'neq': return answer !== value;
    case 'gt': return typeof answer === 'number' && typeof value === 'number' && answer > value;
    case 'gte': return typeof answer === 'number' && typeof value === 'number' && answer >= value;
    case 'lt': return typeof answer === 'number' && typeof value === 'number' && answer < value;
    case 'lte': return typeof answer === 'number' && typeof value === 'number' && answer <= value;
    default: return false;
  }
}

/** Id de la primera pregunta (o null si no hay ninguna). */
export function firstQuestionId(questions) {
  return questions?.[0]?.id ?? null;
}

/** ¿La encuesta usa saltos (alguna pregunta con `next` o `rules`)? */
export function hasBranching(questions) {
  return (questions ?? []).some((q) => q?.next || (Array.isArray(q?.rules) && q.rules.length > 0));
}

/**
 * Id de la pregunta siguiente a `question` dada `answer`: gana la primera regla
 * cuya condición (`op` `value`) se cumple; si ninguna, `next`; si no, la
 * siguiente en orden; y `END` si no hay más.
 */
export function resolveNext(question, answer, questions) {
  const rules = Array.isArray(question?.rules) ? question.rules : [];
  for (const rule of rules) {
    if (rule && ruleMatches(ruleOp(rule), answer, ruleValue(rule))) return rule.goto || END;
  }
  if (question?.next) return question.next;
  const list = questions ?? [];
  const idx = list.findIndex((q) => q.id === question?.id);
  if (idx < 0 || idx + 1 >= list.length) return END;
  return list[idx + 1].id;
}

/** Destinos posibles (aristas) de una pregunta: sus gotos, y su next o el orden. */
function outEdges(question, i, list) {
  const edges = [];
  for (const rule of (Array.isArray(question?.rules) ? question.rules : [])) {
    if (rule?.goto && rule.goto !== END) edges.push(rule.goto);
  }
  if (question?.next) {
    if (question.next !== END) edges.push(question.next);
  } else if (i + 1 < list.length) {
    edges.push(list[i + 1].id);
  }
  return edges;
}

/** ¿El grafo de saltos tiene algún ciclo (una ruta que vuelve a una pregunta ya visitada)? */
function hasCycle(list) {
  const indexById = new Map(list.map((q, i) => [q.id, i]));
  const state = new Map(list.map((q) => [q.id, 'white'])); // white | gray | black
  const visit = (id) => {
    state.set(id, 'gray');
    for (const target of outEdges(list[indexById.get(id)], indexById.get(id), list)) {
      if (!indexById.has(target)) continue;
      const color = state.get(target);
      if (color === 'gray') return true;
      if (color === 'white' && visit(target)) return true;
    }
    state.set(id, 'black');
    return false;
  };
  return list.some((q) => state.get(q.id) === 'white' && visit(q.id));
}

/**
 * Errores de un flujo: cada `next` y cada `goto` debe apuntar a un id de pregunta
 * existente o a `END`, y el grafo no puede tener ciclos (atraparían al que
 * responde). Devuelve la lista (vacía = válido).
 */
export function flowErrors(questions) {
  const list = questions ?? [];
  const ids = new Set(list.map((q) => q.id));
  const isValidTarget = (target) => target === END || ids.has(target);
  const errors = [];
  list.forEach((q, i) => {
    if (q?.next && !isValidTarget(q.next)) {
      errors.push(`El salto por defecto de la pregunta ${i + 1} apunta a un destino que no existe.`);
    }
    (Array.isArray(q?.rules) ? q.rules : []).forEach((rule, j) => {
      if (!rule || rule.goto == null || !isValidTarget(rule.goto)) {
        errors.push(`La regla ${j + 1} de la pregunta ${i + 1} apunta a un destino que no existe.`);
        return;
      }
      const op = ruleOp(rule);
      const value = ruleValue(rule);
      if (value == null || value === '') {
        errors.push(`La regla ${j + 1} de la pregunta ${i + 1} no tiene valor de comparación.`);
      } else if (op !== 'eq' && op !== 'neq' && !Number.isFinite(value)) {
        errors.push(`La regla ${j + 1} de la pregunta ${i + 1} compara con «mayor/menor» pero el valor no es numérico.`);
      }
    });
  });
  if (!errors.length && hasCycle(list)) {
    errors.push('El flujo tiene un bucle: alguna ruta vuelve a una pregunta anterior. Revisa los saltos.');
  }
  return errors;
}
