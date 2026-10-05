/**
 * Identidad › Colores (RMR-TSK-0599): el editor solo se ofrece cuando se sabe
 * qué colores hay guardados; si no se pueden leer, se dice y no se ofrece.
 */
import { describe, it, expect } from 'vitest';
import { SuperadminPanel } from './superadmin-panel.js';

const { _renderBrandColors } = SuperadminPanel.prototype;
const textOf = (tpl) => JSON.stringify(tpl?.strings ?? []);

describe('Identidad › Colores', () => {
  it('mientras se leen los colores, no hay editor', () => {
    expect(textOf(_renderBrandColors.call({ _brandError: '', _brandColors: undefined }))).toContain('Leyendo los colores');
  });

  it('si no se pueden leer, se dice y no se ofrece el editor', () => {
    const tpl = _renderBrandColors.call({ _brandError: 'No se pudieron leer los colores: x', _brandColors: undefined });
    expect(textOf(tpl)).not.toContain('brand-colors-editor');
    expect(tpl.values).toContain('No se pudieron leer los colores: x');
  });

  it('leídos (propios o ninguno), el editor', () => {
    expect(textOf(_renderBrandColors.call({ _brandError: '', _brandColors: null, readOnly: false }))).toContain('brand-colors-editor');
  });
});
