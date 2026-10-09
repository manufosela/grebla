import { describe, it, expect } from 'vitest';
import { mergeO2OPeople } from './picker.js';

describe('mergeO2OPeople', () => {
  it('une la lista manual y la rama sin repetir a nadie', () => {
    const manual = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const branch = [{ id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    expect(mergeO2OPeople(manual, branch).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
