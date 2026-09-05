/**
 * Tests del enganche de las unidades LEAN al catálogo de dominios
 * (ADR «De squads a dominios y subdominios», F2).
 *
 * El desajuste que esto corrige es real: hoy `leanTeams` y el catálogo son dos
 * listas distintas que nadie concilia — «The Mario Netas» mide un equipo que no
 * está en el catálogo, y Matcher está en el catálogo sin nadie que lo mida. Al
 * enganchar por `key`, el catálogo manda y el rótulo deja de decidir nada.
 */
import { describe, it, expect } from 'vitest';
import { resolveSubdomain, classifyUnits } from './scope.js';

const SUBDOMAINS = [
  { id: 's1', key: 'tribbu-app-core', name: 'Core', domainKey: 'tribbu-app' },
  { id: 's2', key: 'caes', name: 'CAES', domainKey: 'tribbu-app' },
  { id: 's3', key: 'plataforma-core', name: 'Core', domainKey: 'plataforma' },
];

describe('resolveSubdomain: manda la clave, nunca el rótulo', () => {
  it('«The Mario Netas» mide el Core de TRIBBU-APP si así está enganchado', () => {
    // El nombre informal de Linear puede quedarse como está: lo que dice a qué
    // pertenece es la clave, no cómo lo llamen en el tablero.
    const unit = { id: 'u1', name: 'The Mario Netas', subdomainKey: 'tribbu-app-core' };
    expect(resolveSubdomain(unit, SUBDOMAINS)?.key).toBe('tribbu-app-core');
  });

  it('escrito «CAEs» o «CAES», da igual: resuelve al mismo subdominio', () => {
    const unaGrafia = { id: 'u2', name: 'CAEs', subdomainKey: 'caes' };
    const otraGrafia = { id: 'u3', name: 'CAES', subdomainKey: 'caes' };
    expect(resolveSubdomain(unaGrafia, SUBDOMAINS)).toBe(resolveSubdomain(otraGrafia, SUBDOMAINS));
  });

  it('sin enganche no adivina por el nombre, aunque coincida', () => {
    // Adivinar es exactamente lo que produjo el desajuste: un nombre parecido no
    // es una identidad, y acertar por casualidad esconde el problema.
    expect(resolveSubdomain({ id: 'u4', name: 'CAES' }, SUBDOMAINS)).toBeNull();
  });

  it('una clave que no está en el catálogo no resuelve a nada', () => {
    expect(resolveSubdomain({ id: 'u5', subdomainKey: 'ya-no-existe' }, SUBDOMAINS)).toBeNull();
  });
});

describe('classifyUnits: qué se puede publicar y qué no, con el motivo', () => {
  const units = [
    { id: 'u1', kind: 'squad', name: 'The Mario Netas', subdomainKey: 'tribbu-app-core' },
    { id: 'u2', kind: 'squad', name: 'CAEs', subdomainKey: 'caes' },
    { id: 'u3', kind: 'squad', name: 'Sin enganchar' },
    { id: 'u4', kind: 'squad', name: 'Rota', subdomainKey: 'ya-no-existe' },
    { id: 'tMWx2F7QK2cqoCiqDqi1', name: 'Huérfana sin kind' },
    { id: 'u6', kind: 'chapter', name: 'Backend', subdomainKey: 'caes' },
  ];

  it('publicables: solo los equipos enganchados a un subdominio del catálogo', () => {
    const { publishable } = classifyUnits(units, SUBDOMAINS);
    expect(publishable.map((p) => p.subdomainKey)).toEqual(['tribbu-app-core', 'caes']);
  });

  it('cada descartada dice por qué, y ninguna se pierde por el camino', () => {
    const { publishable, skipped } = classifyUnits(units, SUBDOMAINS);
    expect(publishable.length + skipped.length).toBe(units.length);
    expect(Object.fromEntries(skipped.map((s) => [s.unit.id, s.reason]))).toEqual({
      u3: 'sin-subdominio',
      u4: 'clave-desconocida',
      tMWx2F7QK2cqoCiqDqi1: 'no-es-equipo',
      u6: 'no-es-equipo',
    });
  });

  it('un gremio no se publica como equipo aunque esté enganchado', () => {
    // Los gremios (chapters) cruzan varios subdominios: publicarlos como si
    // fueran uno sumaría el mismo trabajo dos veces.
    const { skipped } = classifyUnits(units, SUBDOMAINS);
    expect(skipped.find((s) => s.unit.id === 'u6').reason).toBe('no-es-equipo');
  });

  it('sin catálogo no se publica nada: medir sin catálogo es el bug de partida', () => {
    const { publishable, skipped } = classifyUnits(units, []);
    expect(publishable).toEqual([]);
    expect(skipped).toHaveLength(units.length);
  });

  it('aguanta que no le pasen nada', () => {
    expect(classifyUnits()).toEqual({ publishable: [], skipped: [] });
  });
});
