import { describe, it, expect } from 'vitest';
import { teamHeading, TEAM_SCOPES } from './teamNaming.js';

describe('el nombre de la herramienta dice a quién estás viendo', () => {
  it('con tu gente se llama «Mi equipo»', () => {
    expect(teamHeading('mine').title).toBe('Mi equipo');
  });

  it('cuando salen todos NO se llama «Mi equipo»: no es tu equipo', () => {
    // Esto era el bug: quien gobierna la instancia abría «Tu equipo» y le salía
    // la organización entera con ese rótulo encima.
    const todos = teamHeading('all');
    expect(todos.title).not.toContain('equipo');
    expect(todos.title).toBe('Toda la organización');
  });

  it('cada alcance dice en una línea qué hay dentro', () => {
    for (const scope of TEAM_SCOPES) {
      const { lead } = teamHeading(scope);
      expect(lead.length).toBeGreaterThan(0);
      expect(lead).not.toContain('\n');
    }
  });

  it('sin alcance resuelto no promete ninguno de los dos', () => {
    // Adivinar acertaría la mitad de las veces; un rótulo verdad en los dos casos
    // acierta siempre.
    for (const nada of [null, undefined, '', 'inventado']) {
      const h = teamHeading(nada);
      expect(h.title).toBe('Equipo');
      expect(h.title).not.toBe('Mi equipo');
      expect(h.title).not.toBe('Toda la organización');
    }
  });

  it('cada casa puede llamarlo como quiera', () => {
    // «Toda la organización» es correcto en general y frío en una casa que se
    // llama a sí misma de otra forma (RMR-TSK-0597).
    expect(teamHeading('all', { everyoneLabel: 'Toda la tribbu' }).title).toBe('Toda la tribbu');
  });

  it('sin configurar, el defecto del producto no desaparece', () => {
    for (const vacio of [undefined, {}, { everyoneLabel: '' }, { everyoneLabel: '  ' }]) {
      expect(teamHeading('all', vacio).title).toBe('Toda la organización');
    }
  });

  it('«Mi equipo» es tuyo, lo llame como lo llame la organización', () => {
    expect(teamHeading('mine', { everyoneLabel: 'Toda la tribbu' }).title).toBe('Mi equipo');
  });

  it('el rótulo propio no se queda pegado al de al lado', () => {
    // Devolver el objeto congelado mutado contaminaría la siguiente llamada.
    teamHeading('all', { everyoneLabel: 'Toda la tribbu' });
    expect(teamHeading('all').title).toBe('Toda la organización');
  });

  it('los rótulos no se pueden mutar desde fuera', () => {
    const h = teamHeading('mine');
    expect(() => { h.title = 'otro'; }).toThrow();
  });
});
