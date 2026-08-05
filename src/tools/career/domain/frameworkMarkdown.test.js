import { describe, it, expect } from 'vitest';
import { frameworkToMarkdown } from './frameworkMarkdown.js';

const FW = {
  name: 'Engineering',
  tracks: [
    { id: 'ic', name: 'Individual Contributor (IC)' },
    { id: 'tl', name: 'Technical Leadership' },
  ],
  dimensions: [
    { id: 'tech', name: 'Technical Excellence', description: 'Craft.' },
    { id: 'exec', name: 'Execution', description: '' },
  ],
  levels: [
    { id: 'l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 2, publicLabel: 'Mid', typicalProfile: '2–5 años', description: 'Trabaja con independencia.' },
    { id: 'l0', code: 'L0', title: 'Junior Engineer', trackId: 'ic', order: 1, publicLabel: 'Junior', typicalProfile: '0-2 años', description: 'Aprende el oficio.' },
    { id: 'l3tl', code: 'L3-TL', title: 'Tech Lead', trackId: 'tl', order: 3, description: '' },
  ],
  expectations: [
    { levelId: 'l0', dimensionId: 'tech', text: 'Escribe código funcional.' },
    { levelId: 'l1', dimensionId: 'tech', text: 'Escribe código limpio.' },
    { levelId: 'l1', dimensionId: 'exec', text: 'Entrega con autonomía.' },
  ],
};

describe('frameworkToMarkdown', () => {
  it('exporta el framework completo: dimensiones, tracks y niveles ORDENADOS con sus expectativas', () => {
    const md = frameworkToMarkdown(FW, { generatedAt: '2026-08-05' });
    expect(md).toContain('# Framework de carrera — Engineering');
    expect(md).toContain('2026-08-05');
    expect(md).toContain('- **Technical Excellence** — Craft.');
    // L0 antes que L1 (por order, no por posición en el array)
    expect(md.indexOf('### L0 · Junior Engineer')).toBeLessThan(md.indexOf('### L1 · Engineer'));
    expect(md).toContain('(etiqueta pública: Junior)');
    expect(md).toContain('*Perfil típico: 2–5 años*');
    expect(md).toContain('- **Technical Excellence:** Escribe código limpio.');
    expect(md).toContain('## Track Technical Leadership');
  });

  it('los huecos se marcan POR DIMENSIÓN, nunca se omiten (también los parciales)', () => {
    const md = frameworkToMarkdown(FW, { generatedAt: '2026-08-05' });
    // Nivel sin nada: todas sus dimensiones marcadas.
    expect(md).toContain('### L3-TL · Tech Lead');
    // L0 tiene tech pero NO exec: el hueco parcial debe verse.
    const l0Block = md.slice(md.indexOf('### L0'), md.indexOf('### L1'));
    expect(l0Block).toContain('- **Technical Excellence:** Escribe código funcional.');
    expect(l0Block).toContain('- **Execution:** _(sin expectativa definida todavía)_');
  });

  it('levelId concreto: solo ese nivel (con sus dimensiones y su track)', () => {
    const md = frameworkToMarkdown(FW, { levelId: 'l0', generatedAt: '2026-08-05' });
    expect(md).toContain('### L0 · Junior Engineer');
    expect(md).not.toContain('### L1 · Engineer');
    expect(md).not.toContain('Technical Leadership');
    expect(md).toContain('Escribe código funcional.');
  });

  it('levelId desconocido lanza (sin fallbacks silenciosos)', () => {
    expect(() => frameworkToMarkdown(FW, { levelId: 'nope', generatedAt: '2026-08-05' })).toThrow(/nivel/i);
  });
});
