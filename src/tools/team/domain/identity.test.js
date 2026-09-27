import { describe, it, expect } from 'vitest';
import { orgRoleOf, resolvePerson } from './identity.js';

/** @type {import('./superior.js').LeaderLike[]} */
const leaders = [
  { uid: 'mgr-uid', displayName: 'Nico', email: 'nico@x', reportsTo: 'head-uid' },
];
const heads = [
  { uid: 'head-uid', displayName: 'Ismael', email: 'is@x' },
];

// Fichas: la de un manager (Nico) y su head (Ismael), ya con uid vinculado, más
// un engineer que reporta a Nico.
const nicoFicha = { id: 'p-nico', uid: 'mgr-uid' };
const ismaelFicha = { id: 'p-ismael', uid: 'head-uid' };
const engFicha = { id: 'p-eng', uid: null, ownerLeaderUid: 'mgr-uid' };
const people = [nicoFicha, ismaelFicha, engFicha];

describe('orgRoleOf', () => {
  it('prioriza el orgRole explícito de la ficha (persona-céntrico)', () => {
    expect(orgRoleOf({ id: 'x', orgRole: 'manager', uid: null }, { leaders, heads })).toBe('manager');
    expect(orgRoleOf({ id: 'x', orgRole: 'head', uid: null }, { leaders, heads })).toBe('head');
  });

  it('un manager definido en la ficha lo es AUNQUE no tenga uid (sin login)', () => {
    expect(orgRoleOf({ id: 'x', orgRole: 'manager', uid: null }, {})).toBe('manager');
  });

  it('cae al modelo antiguo (uid→leaders) cuando la ficha no trae orgRole', () => {
    expect(orgRoleOf({ id: 'p-nico', uid: 'mgr-uid' }, { leaders, heads })).toBe('manager');
    expect(orgRoleOf({ id: 'p-eng', uid: null }, { leaders, heads })).toBe('engineer');
  });

  it('ignora un orgRole inválido y cae al fallback', () => {
    expect(orgRoleOf({ id: 'x', orgRole: 'jefe', uid: 'mgr-uid' }, { leaders, heads })).toBe('manager');
  });
});

describe('resolvePerson — modelo nuevo (por personId)', () => {
  it('engineer con reportsToPersonId apunta a su manager por personId', () => {
    const eng = { id: 'p-eng', orgRole: 'engineer', reportsToPersonId: 'p-nico' };
    const r = resolvePerson(eng, { people });
    expect(r).toMatchObject({
      personId: 'p-eng', orgRole: 'engineer', superiorKind: 'manager',
      superiorPersonId: 'p-nico', emptyLabel: 'Sin manager', canTransfer: true,
    });
  });

  it('manager con reportsToPersonId apunta a su head por personId', () => {
    const mgr = { id: 'p-nico', orgRole: 'manager', reportsToPersonId: 'p-ismael' };
    const r = resolvePerson(mgr, { people });
    expect(r).toMatchObject({
      orgRole: 'manager', superiorKind: 'head', superiorPersonId: 'p-ismael', emptyLabel: 'Sin head',
    });
  });

  it('head no tiene superior asignable ni transferencia', () => {
    const head = { id: 'p-ismael', orgRole: 'head' };
    const r = resolvePerson(head, { people });
    expect(r).toMatchObject({
      orgRole: 'head', superiorKind: 'none', superiorPersonId: null,
      emptyLabel: 'Sin superior', canTransfer: false,
    });
  });

  it('el orgRole manda aunque la persona no tenga uid (jerarquía sin login)', () => {
    const mgr = { id: 'p-nolog', orgRole: 'manager', uid: null, reportsToPersonId: 'p-ismael' };
    const r = resolvePerson(mgr, { people });
    expect(r.orgRole).toBe('manager');
    expect(r.superiorPersonId).toBe('p-ismael');
  });
});

describe('resolvePerson — fallback (dato pre-migración, por uid)', () => {
  it('engineer sin orgRole: superior = su ownerLeaderUid traducido a personId', () => {
    const r = resolvePerson(engFicha, { people, leaders, heads });
    expect(r).toMatchObject({
      orgRole: 'engineer', superiorKind: 'manager',
      superiorPersonId: 'p-nico', superiorUidLegacy: 'mgr-uid',
    });
  });

  it('manager sin orgRole: superior = reportsTo (uid) traducido a personId de su head', () => {
    const r = resolvePerson(nicoFicha, { people, leaders, heads });
    expect(r).toMatchObject({
      orgRole: 'manager', superiorKind: 'head',
      superiorPersonId: 'p-ismael', superiorUidLegacy: 'head-uid',
    });
  });

  it('engineer sin manager: superiorPersonId null con la etiqueta «Sin manager»', () => {
    const huerfano = { id: 'p-huerfano', uid: null };
    const r = resolvePerson(huerfano, { people, leaders, heads });
    expect(r).toMatchObject({ orgRole: 'engineer', superiorPersonId: null, emptyLabel: 'Sin manager' });
  });

  it('manager sin ficha del head cargada: superiorPersonId null pero superiorUidLegacy conservado', () => {
    const r = resolvePerson(nicoFicha, { people: [nicoFicha, engFicha], leaders, heads });
    expect(r.superiorPersonId).toBeNull();
    expect(r.superiorUidLegacy).toBe('head-uid');
  });

  describe('el respaldo para pintar un nombre cuando el jefe no está en el roster (RMR-BUG-0091)', () => {
    const conModeloNuevo = {
      id: 'p-nueva', uid: null, reportsToPersonId: 'p-jefe-fuera', ownerLeaderUid: 'mgr-uid',
    };

    it('con el modelo nuevo se expone el dueño sincronizado', () => {
      // Este es el caso que el fix original no cubría: su fallback era
      // `superiorUidLegacy`, que en esta rama vale SIEMPRE null, así que no
      // rescataba nada y la celda seguía diciendo «Sin manager».
      const r = resolvePerson(conModeloNuevo, { people, leaders, heads });
      expect(r.superiorPersonId).toBe('p-jefe-fuera');
      expect(r.superiorUidLegacy).toBeNull();
      expect(r.ownerUidFallback).toBe('mgr-uid');
    });

    it('y el respaldo NO se disfraza de dato legacy', () => {
      // Meterlo en `superiorUidLegacy` habría arreglado la celda mintiendo en
      // otro sitio: ahí no hay dato pre-migración que conservar.
      const r = resolvePerson(conModeloNuevo, { people, leaders, heads });
      expect(r.superiorUidLegacy).toBeNull();
    });

    it('sin dueño no se inventa: null, y la celda dirá su etiqueta de vacío', () => {
      const sinDueno = { id: 'p-x', uid: null, reportsToPersonId: 'p-jefe-fuera' };
      expect(resolvePerson(sinDueno, { people, leaders, heads }).ownerUidFallback).toBeNull();
    });

    it('el campo sale SIEMPRE, salga por la rama que salga', () => {
      // Quien pinta no deberia tener que saber por que rama salio el resultado.
      const casos = [
        conModeloNuevo,
        { id: 'p-huerfano', uid: null },
        nicoFicha,
      ];
      for (const persona of casos) {
        const r = resolvePerson(persona, { people, leaders, heads });
        expect(r).toHaveProperty('ownerUidFallback');
      }
    });
  });
});
