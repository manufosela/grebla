import { describe, it, expect } from 'vitest';
import { createMemoryO2O } from '../../infrastructure/memory/index.js';
import { getGuide, saveGuide, getForm, saveForm } from './index.js';
import { DEFAULT_GUIDE, DEFAULT_FORM } from '../../data/index.js';

describe('o2o usecases (guía + formulario)', () => {
  it('lee la guía sembrada; null si no existe', async () => {
    const p = createMemoryO2O({ guides: [DEFAULT_GUIDE], forms: [DEFAULT_FORM] });
    expect((await getGuide(p, DEFAULT_GUIDE.id))?.blocks.length).toBeGreaterThan(0);
    expect(await getGuide(p, 'nope')).toBeNull();
  });

  it('saveGuide incrementa la versión y sella updatedAt', async () => {
    const p = createMemoryO2O({ guides: [DEFAULT_GUIDE] });
    await saveGuide(p, DEFAULT_GUIDE.id, DEFAULT_GUIDE);
    const g = await getGuide(p, DEFAULT_GUIDE.id);
    expect(g.version).toBe(DEFAULT_GUIDE.version + 1);
    expect(typeof g.updatedAt).toBe('string');
  });

  it('formulario: lee y guarda incrementando versión', async () => {
    const p = createMemoryO2O({ forms: [DEFAULT_FORM] });
    expect((await getForm(p, DEFAULT_FORM.id))?.sections.length).toBe(5);
    await saveForm(p, DEFAULT_FORM.id, DEFAULT_FORM);
    expect((await getForm(p, DEFAULT_FORM.id)).version).toBe(DEFAULT_FORM.version + 1);
  });
});

describe('contenido inicial O2O', () => {
  it('la guía incluye Apertura…Cierre y bloques con preguntas', () => {
    const ids = DEFAULT_GUIDE.blocks.map((b) => b.id);
    expect(ids[0]).toBe('apertura');
    expect(ids.at(-1)).toBe('cierre');
    expect(DEFAULT_GUIDE.blocks.find((b) => b.id === 'b1').questions).toHaveLength(4);
  });

  it('el formulario previo tiene 13 preguntas en 5 secciones', () => {
    expect(DEFAULT_FORM.sections).toHaveLength(5);
    const total = DEFAULT_FORM.sections.reduce((n, s) => n + s.questions.length, 0);
    expect(total).toBe(13);
  });
});
