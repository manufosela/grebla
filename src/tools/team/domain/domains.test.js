/**
 * Tests del catálogo de dominios y subdominios (ADR «De squads a dominios y
 * subdominios»).
 *
 * Lo que más importa aquí es el `key`: es la clave del contrato con el portal, y
 * el bug que motivó todo esto fue derivarla del nombre. Los tests fijan que sea
 * estable, única y que los «Core» de distintos dominios no colisionen.
 */
import { describe, it, expect } from 'vitest';
import {
  suggestKey, coreKeyFor, validateKey, subdomainLabel, groupByDomain,
  domainsWithoutSubdomain, CORE_NAME,
} from './domains.js';

describe('suggestKey: propone, no impone', () => {
  it('convierte un nombre en una clave legible', () => {
    expect(suggestKey('TRIBBU-APP')).toBe('tribbu-app');
    expect(suggestKey('Internal Products')).toBe('internal-products');
  });

  it('quita acentos y signos, sin dejar guiones sueltos en los bordes', () => {
    expect(suggestKey('  Diseño & Investigación!  ')).toBe('diseno-investigacion');
  });

  it('nombres distintos en mayúsculas dan la misma clave', () => {
    // «CAEs» y «CAES» son la misma entidad escrita de dos formas: exactamente el
    // caso que hoy parte una serie en dos.
    expect(suggestKey('CAEs')).toBe(suggestKey('CAES'));
  });
});

describe('coreKeyFor: los Core no colisionan entre dominios', () => {
  it('cada Core lleva su dominio delante', () => {
    expect(coreKeyFor('plataforma')).toBe('plataforma-core');
    expect(coreKeyFor('tribbu-app')).toBe('tribbu-app-core');
  });

  it('tres dominios sin dividir dan tres claves distintas', () => {
    // Con la clave derivada del nombre, los tres publicarían a «core» y se
    // machacarían las métricas entre sí.
    const claves = ['tribbu-app', 'plataforma', 'internal-products'].map(coreKeyFor);
    expect(new Set(claves).size).toBe(3);
  });
});

describe('validateKey: forma y unicidad, con el motivo dicho', () => {
  const existentes = [{ id: 'a', key: 'caes' }, { id: 'b', key: 'trust' }];

  it('acepta una clave bien formada y libre', () => {
    expect(validateKey('matcher', existentes)).toEqual({ ok: true });
  });

  it('rechaza vacías y explica por qué', () => {
    expect(validateKey('   ', existentes)).toEqual({ ok: false, reason: 'La clave no puede estar vacía.' });
  });

  it('rechaza lo que no es una clave legible', () => {
    for (const mala of ['CAES', 'con espacio', 'guion--doble', '-borde', 'borde-', 'acentuada-ñ']) {
      const out = validateKey(mala, existentes);
      expect(out.ok, `«${mala}» no debería valer`).toBe(false);
    }
  });

  it('rechaza una clave ya en uso, nombrándola', () => {
    expect(validateKey('trust', existentes)).toEqual({ ok: false, reason: 'La clave «trust» ya está en uso.' });
  });

  it('al editar, una entidad no choca consigo misma', () => {
    expect(validateKey('trust', existentes, 'b')).toEqual({ ok: true });
  });
});

describe('subdomainLabel: siempre con su dominio delante', () => {
  const domains = [
    { id: '1', key: 'plataforma', name: 'Plataforma' },
    { id: '2', key: 'tribbu-app', name: 'TRIBBU-APP' },
  ];

  it('los dos «Core» se distinguen', () => {
    const uno = { id: 'a', key: 'plataforma-core', name: CORE_NAME, domainKey: 'plataforma' };
    const otro = { id: 'b', key: 'tribbu-app-core', name: CORE_NAME, domainKey: 'tribbu-app' };
    expect(subdomainLabel(uno, domains)).toBe('Plataforma › Core');
    expect(subdomainLabel(otro, domains)).toBe('TRIBBU-APP › Core');
  });

  it('un subdominio sin dominio conocido se muestra solo, sin inventar el prefijo', () => {
    const huerfano = { id: 'c', key: 'suelto', name: 'Suelto', domainKey: 'no-existe' };
    expect(subdomainLabel(huerfano, domains)).toBe('Suelto');
  });
});

describe('groupByDomain: el catálogo, y lo que no encaja a la vista', () => {
  const domains = [
    { id: '2', key: 'tribbu-app', name: 'TRIBBU-APP' },
    { id: '1', key: 'plataforma', name: 'Plataforma' },
  ];
  const subdomains = [
    { id: 'c', key: 'trust', name: 'Trust', domainKey: 'tribbu-app' },
    { id: 'a', key: 'caes', name: 'CAES', domainKey: 'tribbu-app' },
    { id: 'z', key: 'suelto', name: 'Suelto', domainKey: 'ya-no-existe' },
  ];

  it('agrupa y ordena por nombre, dominios y subdominios', () => {
    const { tree } = groupByDomain(domains, subdomains);
    expect(tree.map((r) => r.domain.name)).toEqual(['Plataforma', 'TRIBBU-APP']);
    expect(tree[1].subdomains.map((s) => s.name)).toEqual(['CAES', 'Trust']);
  });

  it('un subdominio huérfano NO se descarta: se devuelve aparte para poder verlo', () => {
    // Esconderlo es como no tenerlo, y así es como se acaba con dos listas que
    // no coinciden sin que nadie lo note.
    const { tree, orphans } = groupByDomain(domains, subdomains);
    expect(orphans.map((s) => s.key)).toEqual(['suelto']);
    expect(tree.flatMap((r) => r.subdomains).map((s) => s.key)).not.toContain('suelto');
  });

  it('aguanta un catálogo vacío', () => {
    expect(groupByDomain()).toEqual({ tree: [], orphans: [] });
  });
});

describe('domainsWithoutSubdomain: quién necesita su Core', () => {
  it('señala los dominios que aún no se han dividido', () => {
    const domains = [
      { id: '1', key: 'tribbu-app', name: 'TRIBBU-APP' },
      { id: '2', key: 'plataforma', name: 'Plataforma' },
      { id: '3', key: 'internal-products', name: 'Internal Products' },
    ];
    const subdomains = [{ id: 'a', key: 'caes', name: 'CAES', domainKey: 'tribbu-app' }];
    expect(domainsWithoutSubdomain(domains, subdomains).map((d) => d.key))
      .toEqual(['plataforma', 'internal-products']);
  });

  it('con todos divididos, no falta ninguno', () => {
    const domains = [{ id: '1', key: 'plataforma', name: 'Plataforma' }];
    const subdomains = [{ id: 'a', key: 'plataforma-core', name: CORE_NAME, domainKey: 'plataforma' }];
    expect(domainsWithoutSubdomain(domains, subdomains)).toEqual([]);
  });
});
