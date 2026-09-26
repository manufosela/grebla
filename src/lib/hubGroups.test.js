import { describe, it, expect } from 'vitest';
import { HUB_GROUPS, GROUP_IDS, FALLBACK_GROUP, groupsWithCards, groupOf } from './hubGroups.js';

describe('los grupos del inicio', () => {
  it('son cinco, por propósito, y en el orden en que se leen', () => {
    expect(GROUP_IDS).toEqual(['tuyo', 'equipo', 'estamos', 'entregamos', 'casa', 'otras']);
  });

  it('cada uno tiene un título que dice para qué sirve', () => {
    for (const id of GROUP_IDS) {
      expect(HUB_GROUPS[id].label).toBeTruthy();
    }
  });

  it('el último es el de cola: ahí caen las que nadie ha colocado', () => {
    expect(FALLBACK_GROUP).toBe('otras');
    expect(GROUP_IDS.at(-1)).toBe(FALLBACK_GROUP);
  });
});

describe('a qué grupo va una tarjeta', () => {
  it('al suyo cuando lo declara', () => {
    expect(groupOf({ group: 'equipo' })).toBe('equipo');
  });

  it('al de cola cuando no lo declara: una herramienta nueva NO desaparece', () => {
    // Es la misma regla que el orden: el código manda sobre qué tarjetas hay, y
    // olvidar el grupo no puede esconder una herramienta.
    expect(groupOf({})).toBe(FALLBACK_GROUP);
    expect(groupOf(null)).toBe(FALLBACK_GROUP);
  });

  it('al de cola cuando declara un grupo que no existe', () => {
    expect(groupOf({ group: 'inventado' })).toBe(FALLBACK_GROUP);
  });
});

describe('qué grupos se pintan', () => {
  it('solo los que tienen algo que enseñar, en su orden', () => {
    const grupos = groupsWithCards(['casa', 'tuyo', 'casa']);
    expect(grupos.map((g) => g.id)).toEqual(['tuyo', 'casa']);
  });

  it('un grupo sin tarjetas visibles NO se pinta: un título sin nada debajo anuncia lo que no está', () => {
    expect(groupsWithCards(['tuyo']).map((g) => g.id)).toEqual(['tuyo']);
  });

  it('sin ninguna tarjeta visible no hay grupos', () => {
    expect(groupsWithCards([])).toEqual([]);
    expect(groupsWithCards(null)).toEqual([]);
  });

  it('ignora grupos que no existen en vez de inventarles un título', () => {
    expect(groupsWithCards(['tuyo', 'fantasma']).map((g) => g.id)).toEqual(['tuyo']);
  });

  it('devuelve el título junto al id, para no tener que buscarlo aparte', () => {
    expect(groupsWithCards(['tuyo'])[0].label).toBe(HUB_GROUPS.tuyo.label);
  });
});
