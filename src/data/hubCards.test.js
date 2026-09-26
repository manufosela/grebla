/**
 * Guard del catálogo de tarjetas (RMR-TSK-0572).
 *
 * Ahora que las tarjetas viven en un módulo y no dentro de su página, nada obliga
 * a que estén bien formadas: un `href` mal escrito en `TOOL_ID` no rompe el
 * build, solo hace que esa tarjeta deje de filtrarse por su política — y se le
 * aparece a quien no debería sin que nadie se entere.
 */
import { describe, it, expect } from 'vitest';
import { HUB_TOOLS, TOOL_ID, ADMIN_CARDS } from './hubCards.js';
import { GROUP_IDS } from '../lib/hubGroups.js';

describe('las tarjetas del inicio', () => {
  it('hay unas cuantas', () => {
    expect(HUB_TOOLS.length).toBeGreaterThan(10);
  });

  it('todas tienen nombre, destino, grupo y descripción', () => {
    const rotas = HUB_TOOLS
      .filter((t) => !t.name || !t.href || !t.group || !t.description)
      .map((t) => t.name ?? t.href ?? '(sin nombre)');
    expect(rotas).toEqual([]);
  });

  it('cada una va a un destino distinto: dos tarjetas al mismo sitio son una repetida', () => {
    const hrefs = HUB_TOOLS.map((t) => t.href);
    expect(hrefs.length).toBe(new Set(hrefs).size);
  });

  it('el grupo es uno de los que existen', () => {
    // Un grupo mal escrito no rompe nada —la tarjeta cae en el de cola—, pero
    // acaba en «Otras herramientas» sin que nadie entienda por que.
    const fuera = HUB_TOOLS.filter((t) => !GROUP_IDS.includes(t.group)).map((t) => t.name);
    expect(fuera).toEqual([]);
  });

  it('ninguna se queda en el grupo de cola: el de cola es para despistes, no un destino', () => {
    const enCola = HUB_TOOLS.filter((t) => t.group === 'otras').map((t) => t.name);
    expect(enCola).toEqual([]);
  });
});

describe('el mapa de políticas', () => {
  it('no apunta a destinos que no existen: un href mal escrito deja la tarjeta sin filtrar', () => {
    const hrefs = new Set(HUB_TOOLS.map((t) => t.href));
    const huérfanos = Object.keys(TOOL_ID).filter((href) => !hrefs.has(href));
    expect(huérfanos).toEqual([]);
  });

  it('cubre todas las tarjetas que no son personales ni enlaces internos', () => {
    // Las que no tienen política se ven siempre (o se rigen por el rol, como
    // «Equipo»): lo peligroso es creer que una está gobernada cuando no lo está,
    // así que al menos se deja constancia de cuáles son.
    const sinPolitica = HUB_TOOLS.filter((t) => !TOOL_ID[t.href]).map((t) => t.name);
    expect(sinPolitica).toEqual(['Mi espacio']);
  });
});

describe('las tarjetas del panel', () => {
  it('todas tienen id, nombre, icono, destino y descripción', () => {
    const rotas = ADMIN_CARDS
      .filter((c) => !c.id || !c.name || !c.icon || !c.href || !c.description)
      .map((c) => c.id ?? '(sin id)');
    expect(rotas).toEqual([]);
  });

  it('el id es único: es la clave con la que se decide quién ve cada tarjeta', () => {
    const ids = ADMIN_CARDS.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('llevan a una ruta de la propia aplicación', () => {
    const fuera = ADMIN_CARDS.filter((c) => !c.href.startsWith('/')).map((c) => c.id);
    expect(fuera).toEqual([]);
  });
});
