import { describe, it, expect } from 'vitest';
import { createMemoryPersistence } from '../../infrastructure/memory/index.js';
import {
  listCatalog, addCatalog, renameCatalog, removeCatalog, promoteCatalog,
} from './catalog.js';

describe('fachada de catálogos (dispatch por kind + cascada + promote)', () => {
  it('list/add/remove despachan al catálogo correcto', async () => {
    const p = createMemoryPersistence({ labels: [{ id: 'l1', name: 'Platform' }] });
    expect((await listCatalog(p, 'labels')).map((l) => l.name)).toEqual(['Platform']);
    const id = await addCatalog(p, 'guilds', 'Python');
    expect((await listCatalog(p, 'guilds')).find((g) => g.id === id).name).toBe('Python');
    await removeCatalog(p, 'guilds', id);
    expect(await listCatalog(p, 'guilds')).toHaveLength(0);
  });

  it('renombrar un label cascadea el nombre en las personas', async () => {
    const p = createMemoryPersistence({
      labels: [{ id: 'l1', name: 'Platform' }],
      people: [
        { id: 'p1', name: 'Ana', labels: ['Platform'], ownerLeaderUid: 'lead1' },
        { id: 'p2', name: 'Leo', labels: ['Otro'], ownerLeaderUid: 'lead1' },
      ],
    });
    await renameCatalog(p, 'labels', 'l1', 'Plataforma');
    expect((await listCatalog(p, 'labels'))[0].name).toBe('Plataforma');
    const people = await p.people.list();
    expect(people.find((x) => x.id === 'p1').labels).toEqual(['Plataforma']);
    expect(people.find((x) => x.id === 'p2').labels).toEqual(['Otro']);
  });

  it('renombrar un área NO cascadea (se referencia por areaId)', async () => {
    const p = createMemoryPersistence({ areas: [{ id: 'a1', name: 'Front' }] });
    await renameCatalog(p, 'areas', 'a1', 'Frontend');
    expect((await listCatalog(p, 'areas'))[0].name).toBe('Frontend');
  });

  it('promover un personal lo hace global (quita ownerLeaderUid)', async () => {
    const p = createMemoryPersistence({ guilds: [{ id: 'g1', name: 'Mine', ownerLeaderUid: 'lead1' }] });
    await promoteCatalog(p, 'guilds', 'g1');
    expect((await listCatalog(p, 'guilds')).find((x) => x.id === 'g1').ownerLeaderUid).toBeUndefined();
  });
});
