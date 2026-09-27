import { describe, it, expect } from 'vitest';
import { PORTAL_SAMPLE } from '../data/portalSample.js';
import { readPortalMetrics } from './portalMetrics.js';
import {
  deliverySummary, repoRowFor, sparkPoints, currentWeek, ROW_STATES,
} from './deliverySummary.js';

const metrics = () => readPortalMetrics(PORTAL_SAMPLE);
const fila = (label) => deliverySummary(metrics()).find((f) => f.label === label);

describe('la foto de entrega', () => {
  it('mira la ÚLTIMA semana, que es la que la gente lee', () => {
    expect(currentWeek(metrics()).periodStart).toBe('2026-09-21');
  });

  it('los despliegues salen como el número que son', () => {
    expect(fila('Despliegues por semana')).toMatchObject({
      state: ROW_STATES.valor, value: '10',
    });
  });

  it('la tasa de fallo de despliegue lleva su denominador a la vista', () => {
    // 1 de 9 con señal: el porcentaje solo se entiende con la base al lado.
    expect(fila('Fallo de despliegue')).toMatchObject({
      state: ROW_STATES.valor, value: '11.1 %', note: '1 de 9 con señal',
    });
  });

  it('y explica que NO es el fallo en producción', () => {
    // Sin esa frase, «fallo de despliegue» se lee como «rompimos producción»
    // cuando significa lo contrario: el despliegue no llegó a ejecutarse.
    expect(fila('Fallo de despliegue').help).toMatch(/no llegaron a ejecutarse/i);
    expect(fila('Fallo de despliegue').help).toMatch(/versión anterior/i);
  });
});

describe('los huecos se dicen, y no se pueden rellenar', () => {
  it('los cuatro DORA salen SIEMPRE, incluidos los que no se pueden medir', () => {
    // Quitar el hueco invita a que alguien lo rellene con la métrica de al lado.
    const labels = deliverySummary(metrics()).map((f) => f.label);
    expect(labels).toContain('Fallo en producción');
    expect(labels).toContain('Tiempo de restauración');
  });

  it('el que no tiene fuente dice POR QUÉ, no solo que falta', () => {
    for (const label of ['Fallo en producción', 'Tiempo de restauración']) {
      expect(fila(label)).toMatchObject({
        state: ROW_STATES.sinFuente, value: null, note: 'falta registro de incidentes',
      });
    }
  });

  it('«sin fuente» y «sin dato esta semana» son estados distintos', () => {
    // No hay fuente de incidentes NUNCA; no hubo señal de despliegue ESA semana.
    // Fundirlos haría creer que lo segundo también es irreparable.
    const sinFuente = fila('Fallo en producción').state;
    const conPocaBase = fila('Fallo de despliegue').state;
    expect(sinFuente).toBe(ROW_STATES.sinFuente);
    expect(conPocaBase).not.toBe(ROW_STATES.sinFuente);
  });

  it('ninguna fila sin fuente trae valor: no hay nada que enseñar', () => {
    for (const f of deliverySummary(metrics())) {
      if (f.state === ROW_STATES.sinFuente) expect(f.value).toBeNull();
    }
  });
});

describe('cuando la base es poca', () => {
  it('se dice el recuento en vez del porcentaje', () => {
    // La semana del 14-sep: 0 fallos sobre UN despliegue con señal.
    const soloUna = { ...PORTAL_SAMPLE, global: { ...PORTAL_SAMPLE.global, series: [PORTAL_SAMPLE.global.series[1]] } };
    const f = deliverySummary(readPortalMetrics(soloUna)).find((r) => r.label === 'Fallo de despliegue');
    expect(f).toMatchObject({ state: ROW_STATES.recuento, value: '0 de 1' });
    expect(f.value).not.toContain('%');
  });

  it('y sin ninguna señal no se enseña ni recuento', () => {
    const sinSenal = { ...PORTAL_SAMPLE, global: { ...PORTAL_SAMPLE.global, series: [PORTAL_SAMPLE.global.series[0]] } };
    const f = deliverySummary(readPortalMetrics(sinSenal)).find((r) => r.label === 'Fallo de despliegue');
    expect(f.state).toBe(ROW_STATES.sinDato);
    expect(f.value).toBeNull();
  });
});

describe('el detalle por repo', () => {
  it('un repo que mergea sin revisar no tiene lead time', () => {
    const data = repoRowFor(metrics().repos.find((r) => r.repo === 'hoop-carpool/data-team'));
    expect(data.mergedPRs).toBe(23);
    expect(data.reviewedPRs).toBe(0);
    // Ausencia, no cero: un «0 h» diría «entregan al instante».
    expect(data.leadTimeMedianH).toBeNull();
    expect(data.leadTimeP85H).toBeNull();
  });

  it('y uno que sí revisa trae las horas CRUDAS, sin elegir unidad', () => {
    // Decir «6,1 d» o «146,8 h» es presentación. El dominio no elige unidades.
    const api = repoRowFor(metrics().repos.find((r) => r.repo === 'hoop-carpool/hoop-api'));
    expect(api.leadTimeMedianH).toBe(146.8);
    expect(api.parcial).toBe(true);
  });
});

describe('la sparkline no inventa la línea', () => {
  const serie = (valores) => valores.map((v) => ({ v }));

  it('sin al menos dos medidas no se dibuja nada', () => {
    expect(sparkPoints(serie([5]), 'v')).toBeNull();
    expect(sparkPoints(serie([null, 5, null]), 'v')).toBeNull();
    expect(sparkPoints([], 'v')).toBeNull();
  });

  it('los huecos se saltan, no se dibujan a cero', () => {
    // Un hueco a cero contaría una caída que no pasó.
    const puntos = sparkPoints(serie([10, null, 20]), 'v');
    expect(puntos).toHaveLength(2);
    expect(puntos.map((p) => p.y)).toEqual([0, 1]);
  });

  it('con todo igual la línea va por el medio, no por el suelo', () => {
    // Pegada abajo se leería como «lo más bajo posible», y es «siempre lo mismo».
    const puntos = sparkPoints(serie([7, 7, 7]), 'v');
    expect(puntos.every((p) => p.y === 0.5)).toBe(true);
  });

  it('el eje x reparte los puntos por su posición real en la serie', () => {
    const puntos = sparkPoints(serie([1, null, 3]), 'v');
    expect(puntos.map((p) => p.x)).toEqual([0, 1]);
  });
});
