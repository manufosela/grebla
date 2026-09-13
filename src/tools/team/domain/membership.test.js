/**
 * Tests de la pertenencia de una persona (ADR de dominios, F4).
 *
 * Lo que se defiende: la pertenencia se guarda por `key` del dominio, para que
 * renombrarlo no obligue a tocar 19 fichas; y lo que apunta a un dominio que ya
 * no existe no cuenta como pertenencia, en vez de arrastrarse como si la ficha
 * estuviera al día.
 */
import { describe, it, expect } from 'vitest';
import { domainsOf, membershipLabel, toggleDomain, domainKeysFromSquads } from './membership.js';

const DOMAINS = [
  { id: 'd1', key: 'tribbu-app', name: 'TRIBBU-APP' },
  { id: 'd2', key: 'plataforma', name: 'Plataforma' },
  { id: 'd3', key: 'internal-products', name: 'Internal Products' },
];

describe('domainsOf: a qué pertenece', () => {
  it('resuelve las claves contra el catálogo', () => {
    expect(domainsOf({ domainKeys: ['tribbu-app'] }, DOMAINS).map((d) => d.name)).toEqual(['TRIBBU-APP']);
  });

  it('una persona puede estar en varios: los recursos fluyen', () => {
    const dos = domainsOf({ domainKeys: ['tribbu-app', 'plataforma'] }, DOMAINS);
    expect(dos.map((d) => d.key)).toEqual(['tribbu-app', 'plataforma']);
  });

  it('una clave de un dominio borrado NO cuenta', () => {
    // Arrastrarla haría creer que la ficha está al día cuando apunta a nada.
    expect(domainsOf({ domainKeys: ['ya-no-existe'] }, DOMAINS)).toEqual([]);
  });

  it('sin pertenencia, ninguno, y sin romperse', () => {
    expect(domainsOf({}, DOMAINS)).toEqual([]);
    expect(domainsOf(null, DOMAINS)).toEqual([]);
    expect(domainsOf({ domainKeys: ['tribbu-app'] })).toEqual([]);
  });

  it('renombrar el dominio no rompe la pertenencia: se guarda la clave', () => {
    const renombrado = [{ id: 'd1', key: 'tribbu-app', name: 'TRIBBU App (nuevo nombre)' }];
    expect(domainsOf({ domainKeys: ['tribbu-app'] }, renombrado)).toHaveLength(1);
  });
});

describe('membershipLabel: cómo se escribe', () => {
  it('con el nombre del dominio', () => {
    expect(membershipLabel({ domainKeys: ['plataforma'] }, DOMAINS)).toBe('Plataforma');
  });

  it('varios, separados', () => {
    expect(membershipLabel({ domainKeys: ['tribbu-app', 'plataforma'] }, DOMAINS))
      .toBe('TRIBBU-APP, Plataforma');
  });

  it('sin ninguno lo DICE, en vez de dejarlo en blanco', () => {
    // Un hueco parece un olvido; «Sin dominio» es información.
    expect(membershipLabel({}, DOMAINS)).toBe('Sin dominio');
  });
});

describe('toggleDomain: marcar y desmarcar', () => {
  it('añade sin repetir y deja la lista ordenada', () => {
    expect(toggleDomain(['plataforma'], 'tribbu-app', true)).toEqual(['plataforma', 'tribbu-app']);
    expect(toggleDomain(['tribbu-app'], 'tribbu-app', true)).toEqual(['tribbu-app']);
  });

  it('quita el que se desmarca', () => {
    expect(toggleDomain(['tribbu-app', 'plataforma'], 'tribbu-app', false)).toEqual(['plataforma']);
  });

  it('no devuelve la misma lista, para que el guardado sea explícito', () => {
    const antes = ['plataforma'];
    expect(toggleDomain(antes, 'tribbu-app', true)).not.toBe(antes);
  });
});

describe('domainKeysFromSquads: solo para migrar lo que ya había', () => {
  // Cada squad era o un subdominio de un producto o el producto entero. El
  // mapeo se escribe a mano: es una decisión de modelo, no una transformación
  // del nombre — derivar claves de nombres es el bug que este ADR corrige.
  const MAPEO = {
    's-caes': 'tribbu-app', 's-trust': 'tribbu-app', 's-core': 'tribbu-app', 's-matcher': 'tribbu-app',
    's-plataforma': 'plataforma', 's-internal': 'internal-products',
  };

  it('quien estaba en un subdominio pasa a su producto', () => {
    expect(domainKeysFromSquads(['s-caes'], MAPEO)).toEqual(['tribbu-app']);
    expect(domainKeysFromSquads(['s-matcher'], MAPEO)).toEqual(['tribbu-app']);
  });

  it('dos squads del mismo producto dan UN dominio, no dos', () => {
    expect(domainKeysFromSquads(['s-caes', 's-trust'], MAPEO)).toEqual(['tribbu-app']);
  });

  it('quien estaba en dos productos se queda en los dos', () => {
    expect(domainKeysFromSquads(['s-caes', 's-plataforma'], MAPEO)).toEqual(['plataforma', 'tribbu-app']);
  });

  it('un squad fuera del mapeo no inventa dominio', () => {
    expect(domainKeysFromSquads(['s-desconocido'], MAPEO)).toEqual([]);
  });

  it('sin squads, sin dominios', () => {
    expect(domainKeysFromSquads([], MAPEO)).toEqual([]);
    expect(domainKeysFromSquads(undefined, MAPEO)).toEqual([]);
  });
});
