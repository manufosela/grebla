/**
 * Parseo simple de Markdown → grupos de preguntas, para rellenar de golpe la guía
 * o el formulario previo de un periodo de O2O sin escribir a mano.
 *
 * Formato:
 *   texto suelto antes del primer título  → intro (opcional)
 *   # Título / ## Título                  → nuevo grupo (bloque o sección)
 *   - pregunta   /   * pregunta           → pregunta dentro del grupo actual
 *
 * @typedef {{ id: string, title: string, questions: { id: string, text: string }[] }} MdGroup
 */

/**
 * @param {string} md
 * @returns {{ intro: string, groups: MdGroup[] }}
 */
export function parseQuestionsMarkdown(md) {
  const lines = String(md ?? '').split(/\r?\n/);
  /** @type {MdGroup[]} */
  const groups = [];
  let intro = '';
  /** @type {MdGroup|null} */
  let current = null;
  let n = 0;
  // Sin regex con cuantificadores solapados (evita backtracking): startsWith + slice.
  const newGroup = (title) => {
    current = { id: `g${groups.length + 1}`, title, questions: [] };
    groups.push(current);
    return current;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      newGroup(line.replace(/^#+/, '').trim());
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!current) newGroup('General');
      n += 1;
      current.questions.push({ id: `q${n}`, text: line.slice(2).trim() });
      continue;
    }
    // Texto suelto antes del primer título → intro del formulario.
    if (!current) intro = intro ? `${intro} ${line}` : line;
  }

  return { intro, groups };
}
