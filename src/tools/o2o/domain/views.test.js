/**
 * Tests de qué ve cada quien en O2O (RMR-TSK-0497).
 *
 * El que importa es el tercero: quien administra la herramienta entra a cambiar
 * las preguntas y NO puede acabar leyendo lo que se habló en un O2O. Si algún
 * día alguien añade una sección a la lista, esta prueba la deja fuera del modo
 * administración hasta que alguien decida lo contrario a conciencia.
 */
import { describe, it, expect } from 'vitest';
import { o2oViews, isAdminOnly, O2O_VIEWS } from './views.js';

const ids = (vistas) => vistas.map((v) => v.id);

describe('o2oViews', () => {
  it('quien lleva equipo ve la herramienta entera', () => {
    expect(ids(o2oViews({ leads: true }))).toEqual(ids(O2O_VIEWS));
  });

  it('quien gobierna la instancia, también', () => {
    expect(ids(o2oViews({ governs: true }))).toEqual(ids(O2O_VIEWS));
  });

  it('quien solo gestiona la herramienta ve las preguntas, y nada más', () => {
    expect(ids(o2oViews({ managesTool: true }))).toEqual(['preparar']);
  });

  it('lo que se habló en un O2O no está en el modo administración', () => {
    const vistas = ids(o2oViews({ managesTool: true }));
    for (const prohibida of ['registrar', 'resumen', 'acciones', 'evolucion']) {
      expect(vistas).not.toContain(prohibida);
    }
  });

  it('quien no es nada no ve ninguna sección', () => {
    expect(o2oViews({})).toEqual([]);
    expect(o2oViews()).toEqual([]);
  });
});

describe('isAdminOnly', () => {
  it('solo gestionar la herramienta es el modo administración', () => {
    expect(isAdminOnly({ managesTool: true })).toBe(true);
  });

  it('llevar equipo o gobernar NO lo es: esos entran a usarla', () => {
    expect(isAdminOnly({ managesTool: true, leads: true })).toBe(false);
    expect(isAdminOnly({ managesTool: true, governs: true })).toBe(false);
  });

  it('sin permiso no hay modo alguno', () => {
    expect(isAdminOnly({})).toBe(false);
  });
});
