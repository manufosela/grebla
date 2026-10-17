import { describe, it, expect } from 'vitest';
import { disciplinesForGuilds } from './guildDisciplines.js';

/**
 * Gremios y disciplinas eran dos listas que se marcaban por separado y podían
 * contradecirse (RMR-TSK-0759). Ahora solo se eligen gremios: la disciplina del
 * framework sale del gremio, con lo que no hay nada que pueda no casar.
 */
const CATALOG = [
  { name: 'Backend PHP', disciplineId: 'backend' },
  { name: 'Backend Python', disciplineId: 'backend' },
  { name: 'iOS', disciplineId: 'mobile' },
  { name: 'QA', disciplineId: null },
];

describe('disciplinesForGuilds', () => {
  it('cada gremio aporta su disciplina, sin repetir y en el orden en que aparecen', () => {
    expect(disciplinesForGuilds(['iOS', 'Backend PHP', 'Backend Python'], CATALOG)).toEqual(['mobile', 'backend']);
  });

  it('un gremio sin disciplina (QA) o fuera del catálogo no aporta ninguna', () => {
    expect(disciplinesForGuilds(['QA', 'Inventado'], CATALOG)).toEqual([]);
    expect(disciplinesForGuilds(null, CATALOG)).toEqual([]);
  });
});
