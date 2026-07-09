import { describe, it, expect } from 'vitest';
import { createMemoryLabelRepository } from '../../infrastructure/memory/labelRepository.js';
import { addLabel, updateLabelMeta, listLabels } from './labels.js';

const persistenceWith = (repo) => ({ labels: repo });

describe('addLabel con metadatos opcionales', () => {
  it('crea con subLabel y color', async () => {
    const p = persistenceWith(createMemoryLabelRepository());
    const id = await addLabel(p, 'Frontend', { subLabel: 'UI y accesibilidad', color: '#2a9d8f' });
    const [label] = await listLabels(p);
    expect(label.id).toBe(id);
    expect(label).toMatchObject({ name: 'Frontend', subLabel: 'UI y accesibilidad', color: '#2a9d8f' });
  });

  it('sin metadatos (o en blanco) no añade claves vacías', async () => {
    const p = persistenceWith(createMemoryLabelRepository());
    await addLabel(p, 'Backend', { subLabel: '  ', color: '' });
    const [label] = await listLabels(p);
    expect(label.subLabel).toBeUndefined();
    expect(label.color).toBeUndefined();
  });

  it('sigue exigiendo nombre', () => {
    const p = persistenceWith(createMemoryLabelRepository());
    expect(() => addLabel(p, '   ')).toThrow(/obligatorio/);
  });
});

describe('updateLabelMeta', () => {
  it('actualiza subLabel/color sin tocar el nombre', async () => {
    const p = persistenceWith(createMemoryLabelRepository([{ id: 'x', name: 'Data' }]));
    await updateLabelMeta(p, 'x', { subLabel: 'Pipelines', color: '#e76f51' });
    const [label] = await listLabels(p);
    expect(label).toMatchObject({ name: 'Data', subLabel: 'Pipelines', color: '#e76f51' });
  });

  it('cadena vacía limpia el metadato', async () => {
    const p = persistenceWith(createMemoryLabelRepository([{ id: 'x', name: 'Data', subLabel: 'old', color: '#000000' }]));
    await updateLabelMeta(p, 'x', { subLabel: '', color: '' });
    const [label] = await listLabels(p);
    expect(label.subLabel).toBe('');
    expect(label.color).toBe('');
  });
});
