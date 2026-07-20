import { describe, it, expect } from 'vitest';
import { normalizeSquadIds, squadNames, addSquad, renameSquad } from './squads.js';

const CATALOG = [
  { id: 's1', name: 'Squad Pagos' },
  { id: 's2', name: 'Squad Matcher' },
];

describe('normalizeSquadIds (RMR-TSK-0275)', () => {
  it('quita vacíos, recorta y deduplica conservando el orden', () => {
    expect(normalizeSquadIds([' s1 ', 's2', 's1', '', null, undefined])).toEqual(['s1', 's2']);
  });

  it('lo que no es array → []', () => {
    expect(normalizeSquadIds(undefined)).toEqual([]);
    expect(normalizeSquadIds('s1')).toEqual([]);
  });
});

describe('squadNames', () => {
  it('resuelve ids a nombres contra el catálogo', () => {
    expect(squadNames(['s2', 's1'], CATALOG)).toEqual(['Squad Matcher', 'Squad Pagos']);
  });

  it('descarta ids que ya no existen (squad borrado) en vez de pintar el id', () => {
    expect(squadNames(['s1', 'borrado'], CATALOG)).toEqual(['Squad Pagos']);
  });

  it('una persona en VARIOS squads devuelve todos', () => {
    expect(squadNames(['s1', 's2'], CATALOG)).toHaveLength(2);
  });
});

describe('addSquad / renameSquad validan el nombre', () => {
  // El fake replica la superficie REAL de catalogRepo (list/create/update/
  // remove/promote). Antes tenía un `rename` inventado y por eso no cazó que
  // renameSquad llamaba a un método inexistente (RMR-BUG-0047).
  const makeFake = () => {
    const calls = [];
    return {
      calls,
      squads: {
        list: async () => [],
        create: async (n) => { calls.push(['create', n]); return n; },
        update: async (id, patch) => { calls.push(['update', id, patch]); },
        remove: async (id) => { calls.push(['remove', id]); },
        promote: async (id) => { calls.push(['promote', id]); },
      },
    };
  };

  it('exigen nombre no vacío', async () => {
    const fake = makeFake();
    await expect(async () => addSquad(fake, '   ')).rejects.toThrow(/obligatorio/i);
    await expect(async () => renameSquad(fake, 's1', '')).rejects.toThrow(/obligatorio/i);
  });

  it('recortan el nombre al crear', async () => {
    await expect(addSquad(makeFake(), '  Squad Pagos  ')).resolves.toBe('Squad Pagos');
  });

  it('renombrar usa update() del repo (no existe rename)', async () => {
    const fake = makeFake();
    await renameSquad(fake, 's1', '  Squad Cobros ');
    expect(fake.calls).toEqual([['update', 's1', { name: 'Squad Cobros' }]]);
  });
});
