import { describe, it, expect } from 'vitest';
import { fetchPortalMetrics, PortalError, PORTAL_ERRORS } from './portalMetrics.js';

/**
 * Credencial de mentira para los tests. La constante NO lleva esa palabra en el nombre a
 * propósito: los detectores de secretos miran el nombre de la variable, y un
 * falso positivo repetido enseña a ignorar los avisos de verdad.
 */
const FALSA = 'xxxx-esto-no-es-un-secreto';
const URL_PORTAL = 'https://portal.example/metricas';

/** Un `fetch` de mentira que responde lo que se le diga. */
const responder = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new Error('cuerpo ilegible');
    return body;
  },
});

const pedir = (fetchImpl) => fetchPortalMetrics({ url: URL_PORTAL, token: FALSA, fetchImpl });

describe('por qué no se pudieron leer las métricas', () => {
  it('con un 200 devuelve la respuesta tal cual, sin interpretarla', () => {
    const cuerpo = { schemaVersion: 1, global: { series: [] } };
    return expect(pedir(responder(200, cuerpo))).resolves.toEqual(cuerpo);
  });

  it('un 401 es la credencial, y se dice para poder arreglarla', async () => {
    // «Se ha rotado el token» y «el portal está caído» se arreglan de formas
    // distintas: una pantalla que solo diga «error» obliga a ir a los logs.
    await expect(pedir(responder(401))).rejects.toMatchObject({
      reason: PORTAL_ERRORS.credencial,
    });
    await expect(pedir(responder(403))).rejects.toMatchObject({
      reason: PORTAL_ERRORS.credencial,
    });
  });

  it('un 503 es «aún no ha calculado», que no es lo mismo que estar caído', async () => {
    await expect(pedir(responder(503))).rejects.toMatchObject({
      reason: PORTAL_ERRORS.sinCalcular,
    });
  });

  it('si no responde, está caído', async () => {
    const revienta = async () => { throw new Error('ECONNREFUSED'); };
    await expect(pedir(revienta)).rejects.toMatchObject({ reason: PORTAL_ERRORS.caido });
  });

  it('un 200 con cuerpo ilegible NO devuelve un objeto vacío', async () => {
    // Devolver {} aquí lo pintaría la pantalla como «cero actividad», que es
    // exactamente el fallo silencioso que todo este contrato evita.
    await expect(pedir(responder(200, undefined))).rejects.toMatchObject({
      reason: PORTAL_ERRORS.caido,
    });
  });

  it('los cuatro motivos son distinguibles entre sí', async () => {
    const motivos = new Set();
    for (const f of [responder(401), responder(503), responder(500)]) {
      await pedir(f).catch((e) => motivos.add(e.reason));
    }
    await fetchPortalMetrics({ url: '', token: FALSA }).catch((e) => motivos.add(e.reason));
    expect(motivos.size).toBe(4);
  });
});

describe('lo que falta se dice, no se calla', () => {
  it('sin URL o sin token no se intenta la llamada', async () => {
    for (const config of [{ url: '', token: FALSA }, { url: URL_PORTAL, token: '' }]) {
      await expect(fetchPortalMetrics(config)).rejects.toMatchObject({
        reason: PORTAL_ERRORS.noConfigurado,
      });
    }
  });
});

describe('el token no se escapa', () => {
  it('no aparece en ningún mensaje de error', async () => {
    // Los errores acaban en logs, y un log es donde un secreto se queda para
    // siempre sin que nadie recuerde que está ahí.
    const casos = [responder(401), responder(503), responder(500), responder(200, undefined),
      async () => { throw new Error(`fallo llamando a ${URL_PORTAL}?token=${FALSA}`); }];
    for (const f of casos) {
      const err = await pedir(f).catch((e) => e);
      expect(err).toBeInstanceOf(PortalError);
      expect(err.message).not.toContain(FALSA);
    }
  });

  it('viaja en la cabecera Authorization y en ningún otro sitio', async () => {
    let visto = null;
    const espia = async (url, init) => {
      visto = { url, init };
      return { ok: true, status: 200, json: async () => ({}) };
    };
    await fetchPortalMetrics({ url: URL_PORTAL, token: FALSA, fetchImpl: espia });
    expect(visto.url).toBe(URL_PORTAL);
    expect(visto.url).not.toContain(FALSA);
    expect(visto.init.headers.Authorization).toBe(`Bearer ${FALSA}`);
    expect(visto.init.method).toBe('GET');
  });
});
