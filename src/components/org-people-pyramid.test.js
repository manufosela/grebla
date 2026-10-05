/**
 * <org-people-pyramid> (RMR-TSK-0617, RMR-BUG-0071/0072): cada capa es un
 * recuadro con su etiqueta, la base abajo, y cada persona con su rol y el color
 * de su departamento. Métodos del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect } from 'vitest';
import { OrgPeoplePyramid } from './org-people-pyramid.js';

const { _renderBand, _renderPerson } = OrgPeoplePyramid.prototype;
const textOf = (tpl) => (tpl?.strings ?? []).join('');

describe('<org-people-pyramid>', () => {
  const ctx = {
    _branches: new Map([['engineering', { label: 'Tech', color: '#2a9d8f' }]]),
    _renderPerson,
  };
  const band = { key: 'IC', label: 'IC', people: [{ personId: 'a', name: 'Ana', title: 'Backend Engineer', branch: 'engineering' }] };

  it('la capa es un recuadro con su etiqueta y cuántas personas tiene; la base lo dice', () => {
    const tpl = _renderBand.call(ctx, band, 0, 3);
    expect(textOf(tpl)).toContain('class="band"');
    expect(tpl.values).toContain('Base · IC');
    expect(tpl.values).toContain('1 persona');
  });

  it('la persona lleva su rol y su departamento, con el color del departamento', () => {
    const tpl = _renderPerson.call(ctx, band.people[0]);
    expect(tpl.values).toContain('Ana');
    expect(tpl.values).toContain('Backend Engineer · Tech');
    expect(tpl.values.join(' ')).toContain('#2a9d8f');
  });
});
