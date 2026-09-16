import { describe, it, expect } from 'vitest';
import { docViewUrl, DOC_VIEW_REGION } from './viewUrl.js';

const token = 'f'.repeat(48);

describe('docViewUrl', () => {
  it('en producción apunta a la función serveDoc del proyecto, en su región', () => {
    expect(docViewUrl({ projectId: 'grebla-app', token })).toBe(
      `https://${DOC_VIEW_REGION}-grebla-app.cloudfunctions.net/serveDoc/${token}/`,
    );
  });

  it('en los E2E apunta al emulador de functions', () => {
    expect(docViewUrl({ projectId: 'demo-grebla', token, emulatorHost: '127.0.0.1' })).toBe(
      `http://127.0.0.1:5001/demo-grebla/${DOC_VIEW_REGION}/serveDoc/${token}/`,
    );
  });

  it('el origen del visor nunca es el de la aplicación', () => {
    const url = new URL(docViewUrl({ projectId: 'grebla-tribbu', token }));
    expect(url.origin).not.toContain('web.app');
    expect(url.origin).toContain('grebla-tribbu');
  });

  it('sin proyecto o con un token que no lo es, no construye nada', () => {
    expect(() => docViewUrl({ projectId: '', token })).toThrow(/proyecto/);
    expect(() => docViewUrl({ projectId: 'grebla-app', token: 'abc' })).toThrow(/Token/);
    expect(() => docViewUrl({ projectId: 'grebla-app', token: `${token}/../x` })).toThrow(/Token/);
  });
});
