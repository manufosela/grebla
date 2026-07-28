/**
 * Motor de flujo de la encuesta (RMR-TSK-0337). Dominio puro (sin Firebase).
 *
 * Una encuesta es un grafo dirigido: cada pregunta puede definir `next` (id de la
 * siguiente, `END` para terminar, o ausente = la siguiente en orden) y `rules`
 * `[{ equals, goto }]` que desvían según la respuesta. Sin `next` ni `rules`, el
 * flujo es lineal (retrocompatible con las encuestas ya creadas).
 */

export const END = '__end__';

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
 * cuyo `equals` coincide con la respuesta; si ninguna, `next`; si no, la
 * siguiente en orden; y `END` si no hay más.
 */
export function resolveNext(question, answer, questions) {
  const rules = Array.isArray(question?.rules) ? question.rules : [];
  for (const rule of rules) {
    if (rule && rule.equals === answer) return rule.goto || END;
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
      }
    });
  });
  if (!errors.length && hasCycle(list)) {
    errors.push('El flujo tiene un bucle: alguna ruta vuelve a una pregunta anterior. Revisa los saltos.');
  }
  return errors;
}
