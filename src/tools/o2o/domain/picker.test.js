import { describe, it, expect } from 'vitest';
import { pickerGroups, filterPicker, mergeO2OPeople } from './picker.js';

const people = [
  { id: 'a', name: 'Ana Ruiz', squads: ['Matcher'], guilds: ['Backend PHP'] },
  { id: 'b', name: 'Bea Gil', squads: ['Matcher', 'Platform'], guilds: ['iOS'] },
  { id: 'c', name: 'Carlos Peña', squads: [], guilds: ['Backend PHP'] },
];

describe('pickerGroups (RMR-TSK-0662)', () => {
  it('ofrece cada squad y cada gremio presentes, con cuántas personas tiene, por nombre', () => {
    expect(pickerGroups(people)).toEqual([
      { key: 'squad:Matcher', label: 'Squad · Matcher (2)' },
      { key: 'squad:Platform', label: 'Squad · Platform (1)' },
      { key: 'guild:Backend PHP', label: 'Gremio · Backend PHP (2)' },
      { key: 'guild:iOS', label: 'Gremio · iOS (1)' },
    ]);
  });
});

describe('filterPicker', () => {
  it('sin grupo ni texto, todas', () => {
    expect(filterPicker(people, '', '').map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('por squad o por gremio', () => {
    expect(filterPicker(people, 'squad:Platform', '').map((p) => p.id)).toEqual(['b']);
    expect(filterPicker(people, 'guild:Backend PHP', '').map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('el texto busca en el nombre sin importar tildes ni mayúsculas, y se combina con el grupo', () => {
    expect(filterPicker(people, '', 'pena').map((p) => p.id)).toEqual(['c']);
    expect(filterPicker(people, 'guild:Backend PHP', 'ANA').map((p) => p.id)).toEqual(['a']);
  });
});

describe('mergeO2OPeople', () => {
  it('une la lista manual y la rama sin repetir a nadie', () => {
    const manual = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const branch = [{ id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    expect(mergeO2OPeople(manual, branch).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
