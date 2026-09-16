import { describe, it, expect } from 'vitest';
import { sanitizeIssue, fetchLinearIssue, LINEAR_REF_RE, DESCRIPTION_MAX } from './linearIssue.js';

const respuesta = (body, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });

const cruda = {
  identifier: 'BB-1234', title: '  Migrar el login a OAuth ', description: 'x'.repeat(DESCRIPTION_MAX + 50),
  url: 'https://linear.app/tribbu/issue/BB-1234/migrar', estimate: 5, priorityLabel: 'High',
  state: { name: 'Backlog', type: 'backlog' }, assignee: { name: 'Ana' },
  labels: { nodes: [{ name: 'Squad A' }, { name: '' }, null] }, project: { name: 'Login' },
  extra: 'no debe salir',
};

describe('LINEAR_REF_RE', () => {
  it('acepta equipo-número y rechaza lo demás', () => {
    for (const ok of ['BB-1', 'ENG-1234', 'A1B-99']) expect(LINEAR_REF_RE.test(ok)).toBe(true);
    for (const mal of ['bb-12', 'BB12', 'BB-', '-12', 'https://linear.app/x', 'BB-12 ', 'B-1']) {
      expect(LINEAR_REF_RE.test(mal)).toBe(false);
    }
  });
});

describe('sanitizeIssue: solo lo que la mesa pinta, acotado', () => {
  it('recorta, limpia y descarta campos que no son suyos', () => {
    const ficha = sanitizeIssue(cruda);
    expect(ficha.title).toBe('Migrar el login a OAuth');
    expect(ficha.description).toHaveLength(DESCRIPTION_MAX);
    expect(ficha.labels).toEqual(['Squad A']);
    expect(ficha.state).toBe('Backlog');
    expect(ficha.assignee).toBe('Ana');
    expect(ficha.project).toBe('Login');
    expect(ficha.priority).toBe('High');
    expect(ficha.estimate).toBe(5);
    expect('extra' in ficha).toBe(false);
  });

  it('solo acepta enlaces de linear.app: una URL ajena no llega a la mesa', () => {
    expect(sanitizeIssue({ ...cruda, url: 'https://evil.example/x' }).url).toBeNull();
  });

  it('sin identificador no hay ficha', () => {
    expect(sanitizeIssue(null)).toBeNull();
    expect(sanitizeIssue({ title: 'sin id' })).toBeNull();
  });
});

describe('fetchLinearIssue', () => {
  it('pregunta por el identificador y devuelve la ficha saneada', async () => {
    let enviado = null;
    const f = async (url, init) => { enviado = { url, init }; return respuesta({ data: { issue: cruda } })(); };
    const ficha = await fetchLinearIssue('BB-1234', 'clave', f);
    expect(ficha.identifier).toBe('BB-1234');
    expect(enviado.url).toBe('https://api.linear.app/graphql');
    expect(enviado.init.headers.Authorization).toBe('clave');
    expect(JSON.parse(enviado.init.body).variables).toEqual({ id: 'BB-1234' });
  });

  it('«no existe» es null, no un fallo', async () => {
    const f = respuesta({ errors: [{ message: 'Entity not found: Issue' }] });
    expect(await fetchLinearIssue('BB-9999', 'clave', f)).toBeNull();
  });

  it('otros errores de la API y los HTTP se propagan con su mensaje', async () => {
    await expect(fetchLinearIssue('BB-1', 'clave', respuesta({ errors: [{ message: 'Rate limited' }] })))
      .rejects.toThrow('Rate limited');
    await expect(fetchLinearIssue('BB-1', 'clave', respuesta({}, false, 401))).rejects.toThrow('401');
  });

  it('no llama a Linear con una referencia que no es una referencia', async () => {
    let llamado = false;
    await expect(fetchLinearIssue('bb-12', 'clave', async () => { llamado = true; })).rejects.toThrow('no válida');
    expect(llamado).toBe(false);
  });
});
