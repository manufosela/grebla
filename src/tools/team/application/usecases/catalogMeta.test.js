import { describe, it, expect, vi } from 'vitest';
import { updateCatalogMeta } from './catalog.js';

/** El gremio guarda a qué disciplina del framework pertenece (RMR-TSK-0759). */
describe('updateCatalogMeta en gremios', () => {
  const persistence = () => ({ guilds: { update: vi.fn(async () => {}) } });

  it('guarda la disciplina del gremio', async () => {
    const p = persistence();
    await updateCatalogMeta(p, 'guilds', 'g1', { disciplineId: ' backend ' });
    expect(p.guilds.update).toHaveBeenCalledWith('g1', { disciplineId: 'backend' });
  });

  it('sin disciplina (QA) se guarda null, no un texto vacío', async () => {
    const p = persistence();
    await updateCatalogMeta(p, 'guilds', 'g1', { disciplineId: '' });
    expect(p.guilds.update).toHaveBeenCalledWith('g1', { disciplineId: null });
  });
});
