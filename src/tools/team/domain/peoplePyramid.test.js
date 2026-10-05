import { describe, expect, it } from 'vitest';
import { peoplePyramid, NOTION_LEVELS } from './peoplePyramid.js';

const roles = [
  { id: 'cto', label: 'CTO', reportsToRoleId: null, layer: 0 },
  { id: 'em', label: 'Engineering Manager', reportsToRoleId: 'cto', layer: 1 },
  { id: 'eng', label: 'Engineer', reportsToRoleId: 'em', layer: 2 },
];
const p = (personId, name, extra = {}) => ({ personId, name, orgRole: null, orgBranch: 'engineering', notion: null, ...extra });

describe('peoplePyramid — con Notion: una capa por Level, de la base a la cima', () => {
  const people = [
    p('a', 'Ana', { notion: { level: 'IC', role: 'Backend Engineer' } }),
    p('b', 'Bea', { notion: { level: 'C-level', role: 'CTO' } }),
    p('c', 'Carla', { notion: { level: 'Manager', role: 'EM' } }),
    p('d', 'Dani', { notion: { level: 'IC', role: 'QA' } }),
  ];

  it('la base es C-level y la cima IC, y solo salen las capas con alguien', () => {
    const { source, bands } = peoplePyramid(people, roles);
    expect(source).toBe('notion');
    expect(bands.map((b) => b.label)).toEqual(['C-level', 'Manager', 'IC']);
    expect(bands.at(-1).people.map((x) => x.name)).toEqual(['Ana', 'Dani']);
  });

  it('cada persona lleva su rol (el de Notion) y su departamento', () => {
    const ana = peoplePyramid(people, roles).bands.at(-1).people[0];
    expect(ana).toEqual({ personId: 'a', name: 'Ana', title: 'Backend Engineer', branch: 'engineering' });
  });

  it('quien no tiene Level conocido va a una capa propia, arriba del todo', () => {
    const { bands } = peoplePyramid([...people, p('e', 'Eva', { notion: { level: 'Becaria' } })], roles);
    expect(bands.at(-1)).toMatchObject({ key: 'sin-nivel', label: 'Sin nivel en Notion' });
  });

  it('el orden de los Level es el del directorio', () => {
    expect(NOTION_LEVELS).toEqual(['C-level', 'Head of', 'Manager', 'Lead', 'Team lead', 'IC']);
  });
});

describe('peoplePyramid — sin Notion (la demo): la capa sale del rol', () => {
  it('capas por la capa canónica de su rol, con el rol como título', () => {
    const people = [p('a', 'Ana', { orgRole: 'eng' }), p('b', 'Bea', { orgRole: 'cto' })];
    const { source, bands } = peoplePyramid(people, roles);
    expect(source).toBe('roles');
    expect(bands.map((b) => b.label)).toEqual(['CTO', 'Engineer']);
    expect(bands[0].people[0].title).toBe('CTO');
  });

  it('sin rol, a su capa propia', () => {
    const { bands } = peoplePyramid([p('a', 'Ana')], roles);
    expect(bands).toEqual([{ key: 'sin-rol', label: 'Sin rol', people: [{ personId: 'a', name: 'Ana', title: '', branch: 'engineering' }] }]);
  });
});
