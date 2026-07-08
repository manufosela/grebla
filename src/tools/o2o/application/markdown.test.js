import { describe, it, expect } from 'vitest';
import { parseQuestionsMarkdown } from './markdown.js';

describe('parseQuestionsMarkdown', () => {
  it('parsea títulos como grupos y viñetas como preguntas', () => {
    const md = `# Cómo trabajan hoy
- ¿Cómo es un día normal?
- ¿Qué te da energía?

## Objetivos
* ¿Dónde quieres crecer?`;
    const { groups } = parseQuestionsMarkdown(md);
    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe('Cómo trabajan hoy');
    expect(groups[0].questions.map((q) => q.text)).toEqual(['¿Cómo es un día normal?', '¿Qué te da energía?']);
    expect(groups[1].title).toBe('Objetivos');
    expect(groups[1].questions).toHaveLength(1);
  });

  it('texto antes del primer título va a intro', () => {
    const md = `No hace falta que lo rellenes.
# Bloque
- pregunta`;
    const { intro, groups } = parseQuestionsMarkdown(md);
    expect(intro).toBe('No hace falta que lo rellenes.');
    expect(groups).toHaveLength(1);
  });

  it('viñetas sin título previo caen en un grupo «General»', () => {
    const { groups } = parseQuestionsMarkdown('- suelta');
    expect(groups[0].title).toBe('General');
    expect(groups[0].questions[0].text).toBe('suelta');
  });

  it('ids de pregunta únicos y estables', () => {
    const { groups } = parseQuestionsMarkdown('# A\n- 1\n- 2\n# B\n- 3');
    const ids = groups.flatMap((g) => g.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(3);
  });

  it('entrada vacía → sin grupos', () => {
    expect(parseQuestionsMarkdown('').groups).toEqual([]);
  });
});
