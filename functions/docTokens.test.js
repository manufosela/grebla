import { describe, it, expect } from 'vitest';
import { DOC_TOKEN_TTL_MS, isDocToken, tokenFromPath, tokenIsLive, viewerHeaders, downloadFileName, downloadHeaders } from './docTokens.js';

const TOKEN = 'a'.repeat(48);

describe('tokenFromPath', () => {
  it('acepta la raíz del token con y sin el nombre de la función, y su index.html', () => {
    expect(tokenFromPath(`/serveDoc/${TOKEN}/`)).toBe(TOKEN);
    expect(tokenFromPath(`/${TOKEN}/`)).toBe(TOKEN);
    expect(tokenFromPath(`/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromPath(`/serveDoc/${TOKEN}/index.html`)).toBe(TOKEN);
  });

  it('cualquier otro fichero, nivel o token mal formado es nada', () => {
    expect(tokenFromPath(`/${TOKEN}/otro.html`)).toBe('');
    expect(tokenFromPath(`/${TOKEN}/img/a.png`)).toBe('');
    expect(tokenFromPath('/serveDoc/')).toBe('');
    expect(tokenFromPath('/serveDoc/../docs/x.html')).toBe('');
    expect(tokenFromPath(`/${'A'.repeat(48)}/`)).toBe('');
    expect(tokenFromPath(`/${'a'.repeat(47)}/`)).toBe('');
    expect(tokenFromPath(null)).toBe('');
  });
});

describe('isDocToken', () => {
  it('48 hexadecimales en minúscula, ni más ni menos', () => {
    expect(isDocToken(TOKEN)).toBe(true);
    expect(isDocToken(`${TOKEN}0`)).toBe(false);
    expect(isDocToken('')).toBe(false);
  });
});

describe('tokenIsLive', () => {
  const now = 1_000_000;
  it('vivo si no ha caducado y apunta a docs/', () => {
    expect(tokenIsLive({ path: 'docs/a.html', expiresAt: now + 1 }, now)).toBe(true);
  });
  it('muerto si caducó, si la ruta no es de docs/ o si no hay registro', () => {
    expect(tokenIsLive({ path: 'docs/a.html', expiresAt: now }, now)).toBe(false);
    expect(tokenIsLive({ path: 'people/x.json', expiresAt: now + 1 }, now)).toBe(false);
    expect(tokenIsLive({ path: 'docs/a.html', expiresAt: 'mañana' }, now)).toBe(false);
    expect(tokenIsLive(undefined, now)).toBe(false);
  });
  it('la vida por defecto son cuatro horas', () => {
    expect(DOC_TOKEN_TTL_MS).toBe(4 * 3_600_000);
  });
});

describe('viewerHeaders', () => {
  it('HTML sin caché, sin sniffing y sin referer', () => {
    const h = viewerHeaders();
    expect(h['Content-Type']).toMatch(/^text\/html/);
    expect(h['Cache-Control']).toContain('no-store');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('no-referrer');
  });
});

/** Descargar es el mismo documento y el mismo token, pero el navegador lo guarda. */
describe('descarga (RMR-TSK-0546)', () => {
  it('el nombre sale del fichero que hay en Storage', () => {
    expect(downloadFileName('docs/onboarding/Como trabajamos.html')).toBe('Como-trabajamos.html');
    expect(downloadFileName('docs/guia.html')).toBe('guia.html');
  });

  it('un nombre con comillas o saltos de línea NO puede colar otra cabecera', () => {
    const sucio = downloadFileName('docs/mal"; X-Colada: 1\r\nOtra: 2.html');
    expect(sucio).not.toMatch(/["\r\n]/);
    expect(downloadFileName('docs/../../secreto.html')).toBe('secreto.html');
  });

  it('sin nombre utilizable, uno por defecto: nunca una cabecera vacía', () => {
    expect(downloadFileName('docs/....')).toBe('documento.html');
    expect(downloadFileName(null)).toBe('documento.html');
  });

  it('las cabeceras de descarga son las del visor más el attachment', () => {
    const h = downloadHeaders('docs/onboarding/guia.html');
    expect(h['Content-Disposition']).toBe('attachment; filename="guia.html"');
    expect(h['Cache-Control']).toContain('no-store');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
  });
});
