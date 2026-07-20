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
  const fake = { squads: { create: async (n) => n, rename: async (id, n) => `${id}:${n}` } };
  it('exigen nombre no vacío', async () => {
    await expect(async () => addSquad(fake, '   ')).rejects.toThrow(/obligatorio/i);
    await expect(async () => renameSquad(fake, 's1', '')).rejects.toThrow(/obligatorio/i);
  });
  it('recortan el nombre al crear', async () => {
    await expect(addSquad(fake, '  Squad Pagos  ')).resolves.toBe('Squad Pagos');
  });
});
