import { describe, it, expect } from 'vitest';
import { PORTAL_SAMPLE } from '../data/portalSample.js';
import {
  readPortalMetrics, isMeasurable, rateDisplay, reposSinSenal,
  SUPPORTED_SCHEMA, MIN_RATE_BASE,
} from './portalMetrics.js';

const leido = () => readPortalMetrics(PORTAL_SAMPLE);
const semana = (start) => leido().series.find((s) => s.periodStart === start);

describe('ausente no es cero', () => {
  it('sin despliegues con señal no hay tasa: null, no 0', () => {
    // La semana del 6-jul tuvo 2 despliegues y ninguno trae estado. Un 0 ahí se
    // leería como «no falló nada».
    const s = semana('2026-07-06');
    expect(s.deploys).toBe(2);
    expect(s.deploysConEstado).toBe(0);
    expect(s.deployFailureRate).toBeNull();
  });

  it('el throughput que no viene tampoco se inventa', () => {
    // Cualquier campo, no solo los de despliegue: la regla es del lector, no de
    // una lista de campos que haya que acordarse de ampliar.
    expect(semana('2026-07-06').throughput).toBeNull();
    expect(semana('2026-09-14').throughput).toBe(116);
  });

  it('un repo que mergea sin revisar no tiene lead time, y eso no es un cero', () => {
    const data = leido().repos.find((r) => r.repo === 'hoop-carpool/data-team');
    const fila = data.series[0];
    expect(fila.mergedPRs).toBe(23);
    expect(fila.reviewedPRs).toBe(0);
    expect(fila.leadTimeMedianH).toBeNull();
    expect(fila.leadTimeP85H).toBeNull();
  });

  it('un cero de verdad sigue siendo cero', () => {
    // No vale tratar todo como ausente: 0 fallos sobre 1 con señal ES un cero.
    expect(semana('2026-09-14').deploysFallidos).toBe(0);
    expect(semana('2026-09-14').deployFailureRate).toBe(0);
  });
});

describe('la semana en curso se dice, no se deduce', () => {
  it('manda `parcial`, y `days` queda de dato', () => {
    const s = semana('2026-09-21');
    expect(s.parcial).toBe(true);
    expect(s.days).toBe(5);
    // Comparar days contra un 7 escrito a mano se rompe con granularidad mensual.
    expect(semana('2026-09-14').parcial).toBe(false);
  });
});

describe('lo que no tiene fuente no se rellena', () => {
  it('changeFailureRate no es medible: falta registro de incidentes', () => {
    const m = leido();
    expect(isMeasurable(m, 'changeFailureRate')).toBe(false);
    expect(isMeasurable(m, 'timeToRestore')).toBe(false);
  });

  it('deployFailureRate SÍ es medible, y son cosas distintas', () => {
    // Uno mide que el despliegue se ejecutara; el otro, que lo desplegado
    // rompiera producción. Confundirlos pinta un fallo evitado como entregado.
    const m = leido();
    expect(isMeasurable(m, 'deployFailureRate')).toBe(true);
    expect(m.noMedible).not.toContain('deployFailureRate');
  });

  it('ninguna métrica calculada puede ocupar el hueco de una de noMedible', () => {
    // Si pudiera satisfacerla, no estaría en la lista.
    const m = leido();
    for (const hueco of m.noMedible) {
      expect(isMeasurable(m, hueco)).toBe(false);
    }
  });
});

describe('una tasa sin base no es una tasa', () => {
  it('con un solo despliegue con señal se dice el recuento, no el porcentaje', () => {
    const s = semana('2026-09-14');
    const d = rateDisplay(s.deployFailureRate, s.deploysConEstado, s.deploysFallidos);
    expect(d.kind).toBe('count');
    expect(d.pct).toBeNull();
    expect(d.fails).toBe(0);
    expect(d.base).toBe(1);
  });

  it('con base suficiente sí se dice el porcentaje', () => {
    const s = semana('2026-09-21');
    const d = rateDisplay(s.deployFailureRate, s.deploysConEstado, s.deploysFallidos);
    expect(d.kind).toBe('rate');
    expect(d.pct).toBeCloseTo(11.1, 1);
    expect(d.base).toBe(9);
  });

  it('sin base no se dice nada', () => {
    const s = semana('2026-07-06');
    expect(rateDisplay(s.deployFailureRate, s.deploysConEstado, s.deploysFallidos).kind).toBe('none');
  });

  it('la forma es siempre la misma: quien la usa no tiene que adivinar', () => {
    const formas = [
      rateDisplay(null, 0, 0), rateDisplay(0, 1, 0), rateDisplay(0.111, 9, 1), rateDisplay(null, 9, 1),
    ];
    for (const f of formas) {
      expect(Object.keys(f).toSorted()).toEqual(['base', 'fails', 'kind', 'pct']);
    }
  });

  it('el umbral de base está declarado, no escondido en un if', () => {
    expect(MIN_RATE_BASE).toBeGreaterThan(1);
    expect(rateDisplay(0, MIN_RATE_BASE, 0).kind).toBe('rate');
    expect(rateDisplay(0, MIN_RATE_BASE - 1, 0).kind).toBe('count');
  });
});

describe('lo que se cuenta pero nunca puede fallar', () => {
  it('se sabe qué repos no traen señal, para poder explicarlo en pantalla', () => {
    // Que la frecuencia suba y la tasa no se mueva parece un misterio y es una
    // explicación.
    expect(reposSinSenal(leido())).toEqual(['hoop-carpool/hoop-api']);
  });

  it('los que ni siquiera entran en la cuenta vienen con su motivo', () => {
    const fuera = leido().cobertura.fueraDeCobertura;
    expect(fuera.map((f) => f.repo)).toContain('hoop-carpool/new-app-ios');
    for (const f of fuera) expect(f.motivo.length).toBeGreaterThan(0);
  });
});

describe('un contrato que cambia se nota', () => {
  it('otra schemaVersion falla en alto en vez de leerse a medias', () => {
    // Leer a medias una forma desconocida produce ceros silenciosos, que es la
    // peor manera de enterarse de un cambio de contrato: no enterarse.
    expect(() => readPortalMetrics({ ...PORTAL_SAMPLE, schemaVersion: 2 })).toThrow(/schemaVersion/);
    expect(() => readPortalMetrics({ ...PORTAL_SAMPLE, schemaVersion: undefined })).toThrow();
  });

  it('una respuesta vacía falla, no devuelve una pantalla de ceros', () => {
    for (const nada of [null, undefined, '', 0]) expect(() => readPortalMetrics(nada)).toThrow();
  });

  it('la versión soportada está declarada', () => {
    expect(SUPPORTED_SCHEMA).toBe(1);
  });
});
