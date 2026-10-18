import { describe, it, expect } from 'vitest';
import { newDocLink, groupDocLinks, DOC_LINK_GROUPS } from './docLinks.js';

/** Enlaces de Documentación (RMR-TSK-0778): Notion, la wiki de TRIBBU y wikis abiertas. */
describe('newDocLink', () => {
  it('limpia y valida un enlace', () => {
    expect(newDocLink({ group: 'tribbu', title: ' TRIBBU Wiki ', url: 'https://www.notion.so/abc', description: ' Raíz ', order: 2 }))
      .toEqual({ group: 'tribbu', title: 'TRIBBU Wiki', url: 'https://www.notion.so/abc', description: 'Raíz', order: 2 });
  });

  it('solo https, con título y un grupo conocido', () => {
    const base = { group: 'abiertas', title: 'SRE', url: 'https://sre.google/books/' };
    expect(() => newDocLink({ ...base, url: 'http://sre.google' })).toThrow(/https/);
    expect(() => newDocLink({ ...base, url: 'javascript:alert(1)' })).toThrow(/https/);
    expect(() => newDocLink({ ...base, title: ' ' })).toThrow(/título/);
    expect(() => newDocLink({ ...base, group: 'otro' })).toThrow(/grupo/);
  });
});

describe('groupDocLinks', () => {
  it('agrupa en el orden de los grupos y ordena dentro por orden y título', () => {
    const links = [
      { id: 'a', group: 'abiertas', title: 'Zeta', order: 1 },
      { id: 'b', group: 'tribbu', title: 'Wiki', order: 2 },
      { id: 'c', group: 'tribbu', title: 'Notion', order: 1 },
    ];
    const grupos = groupDocLinks(links);
    expect(grupos.map((g) => g.id)).toEqual(['tribbu', 'abiertas']);
    expect(grupos[0].links.map((l) => l.id)).toEqual(['c', 'b']);
  });

  it('los grupos tienen rótulo', () => {
    expect(DOC_LINK_GROUPS.map((g) => g.id)).toEqual(['tribbu', 'notion', 'abiertas']);
  });
});
