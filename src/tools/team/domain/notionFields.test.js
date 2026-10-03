import { describe, expect, it } from 'vitest';
import { NOTION_FIELDS, withoutNotionFields, isNotionField } from './notionFields.js';

describe('campos que vienen de Notion (RMR-TSK-0588)', () => {
  it('son los mismos que bloquean las reglas', () => {
    expect([...NOTION_FIELDS].toSorted()).toEqual(
      ['email', 'external', 'name', 'notion', 'orgBranch', 'pendingEmail', 'reportsToPersonId', 'startDate']);
  });

  it('con Notion conectado, el parche pierde esos campos y conserva lo propio de GREBLA', () => {
    const patch = { name: 'Ana', startDate: '2024-01-01', external: true, githubLogin: 'ana', guilds: ['QA'] };
    expect(withoutNotionFields(patch, true)).toEqual({ githubLogin: 'ana', guilds: ['QA'] });
  });

  it('sin Notion (la demo), el parche queda intacto', () => {
    const patch = { name: 'Ana', githubLogin: 'ana' };
    expect(withoutNotionFields(patch, false)).toBe(patch);
  });

  it('isNotionField dice si un campo concreto lo manda Notion', () => {
    expect(isNotionField('reportsToPersonId')).toBe(true);
    expect(isNotionField('levelId')).toBe(false);
  });
});
