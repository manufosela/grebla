import { describe, it, expect } from 'vitest';
import {
  VOYAGE_MIN_MS,
  VOYAGE_MAX_MS,
  VOYAGE_REF_DISTANCE,
  VOYAGE_BEND,
  VOYAGE_EDGE,
  voyagePath,
  voyagePointAt,
  voyageAngle,
  voyageTangentAngle,
  voyageDuration,
  voyageHeading,
} from './voyage.js';

describe('voyagePath (trayecto puerto→puerto, MC-19)', () => {
  it('parte del origen y llega al destino', () => {
    const path = voyagePath({ x: 50, y: 76 }, { x: 88, y: 48 });
    expect(voyagePointAt(path, 0)).toEqual({ x: 50, y: 76 });
    expect(voyagePointAt(path, 1)).toEqual({ x: 88, y: 48 });
  });

  it('mide la distancia en línea recta entre los puertos', () => {
    const path = voyagePath({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(path.distance).toBeCloseTo(50);
  });

  it('comba hacia la izquierda de la marcha (rumbo este → control por encima)', () => {
    const path = voyagePath({ x: 20, y: 50 }, { x: 80, y: 50 });
    expect(path.control.x).toBeCloseTo(50);
    // Con +y hacia abajo, «izquierda del rumbo este» es ARRIBA de la pantalla.
    expect(path.control.y).toBeCloseTo(50 - 60 * VOYAGE_BEND);
  });

  it('acota el punto de control al mar visible (la comba no saca el barco del mapa)', () => {
    const path = voyagePath({ x: 5, y: 4 }, { x: 95, y: 4 });
    expect(path.control.y).toBe(VOYAGE_EDGE);
  });

  it('es determinista: mismo par de islas, misma ruta', () => {
    expect(voyagePath({ x: 28, y: 54 }, { x: 70, y: 16 })).toEqual(
      voyagePath({ x: 28, y: 54 }, { x: 70, y: 16 }),
    );
  });

  it('rechaza puertos sin coordenadas finitas y viajes de longitud cero', () => {
    expect(() => voyagePath({ x: NaN, y: 5 }, { x: 1, y: 1 })).toThrow(/inválido/i);
    expect(() => voyagePath({ x: 1, y: 1 }, undefined)).toThrow(/inválido/i);
    expect(() => voyagePath({ x: 7, y: 7 }, { x: 7, y: 7 })).toThrow(/coinciden/i);
  });
});

describe('voyagePointAt (muestreo de la curva)', () => {
  it('a mitad de viaje pasa por la comba (entre la recta y el control)', () => {
    const path = voyagePath({ x: 20, y: 50 }, { x: 80, y: 50 });
    const mid = voyagePointAt(path, 0.5);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeLessThan(50); // combado hacia arriba
    expect(mid.y).toBeGreaterThan(path.control.y); // pero sin llegar al control
  });

  it('acota t fuera de [0, 1] a los extremos del trayecto', () => {
    const path = voyagePath({ x: 10, y: 10 }, { x: 90, y: 60 });
    expect(voyagePointAt(path, -0.5)).toEqual({ x: 10, y: 10 });
    expect(voyagePointAt(path, 1.7)).toEqual({ x: 90, y: 60 });
  });

  it('rechaza un progreso no finito', () => {
    const path = voyagePath({ x: 10, y: 10 }, { x: 90, y: 60 });
    expect(() => voyagePointAt(path, NaN)).toThrow(/inválido/i);
  });
});

describe('voyageAngle (rumbo entre dos puntos, +y abajo)', () => {
  it('apunta a los cuatro rumbos cardinales', () => {
    expect(voyageAngle({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0); // este
    expect(voyageAngle({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2); // sur
    expect(voyageAngle({ x: 0, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(Math.PI); // oeste
    expect(voyageAngle({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(-Math.PI / 2); // norte
  });

  it('sin dirección definida devuelve 0 (determinista, como minimapHeading)', () => {
    expect(voyageAngle({ x: 4, y: 4 }, { x: 4, y: 4 })).toBe(0);
  });

  it('rechaza puntos sin coordenadas finitas', () => {
    expect(() => voyageAngle({ x: 0, y: 0 }, { x: Infinity, y: 0 })).toThrow(/inválido/i);
  });
});

describe('voyageTangentAngle (la proa sigue la curva)', () => {
  it('zarpa apuntando hacia el control y atraca llegando desde él', () => {
    const path = voyagePath({ x: 20, y: 50 }, { x: 80, y: 50 });
    expect(voyageTangentAngle(path, 0)).toBeCloseTo(voyageAngle(path.from, path.control));
    expect(voyageTangentAngle(path, 1)).toBeCloseTo(voyageAngle(path.control, path.to));
  });

  it('a mitad de viaje lleva el rumbo recto origen→destino', () => {
    const path = voyagePath({ x: 10, y: 70 }, { x: 90, y: 20 });
    expect(voyageTangentAngle(path, 0.5)).toBeCloseTo(voyageAngle(path.from, path.to));
  });

  it('acota t y rechaza progresos no finitos', () => {
    const path = voyagePath({ x: 20, y: 50 }, { x: 80, y: 50 });
    expect(voyageTangentAngle(path, -1)).toBeCloseTo(voyageTangentAngle(path, 0));
    expect(() => voyageTangentAngle(path, NaN)).toThrow(/inválido/i);
  });
});

describe('voyageDuration (proporcional a la distancia, con topes)', () => {
  it('nunca baja del mínimo ni pasa del máximo', () => {
    expect(voyageDuration(0)).toBe(VOYAGE_MIN_MS);
    expect(voyageDuration(VOYAGE_REF_DISTANCE)).toBe(VOYAGE_MAX_MS);
    expect(voyageDuration(500)).toBe(VOYAGE_MAX_MS);
  });

  it('crece de forma monótona con la distancia', () => {
    expect(voyageDuration(20)).toBeGreaterThan(voyageDuration(10));
    expect(voyageDuration(45)).toBeCloseTo((VOYAGE_MIN_MS + VOYAGE_MAX_MS) / 2);
  });

  it('rechaza distancias negativas o no finitas', () => {
    expect(() => voyageDuration(-1)).toThrow(/inválida/i);
    expect(() => voyageDuration(NaN)).toThrow(/inválida/i);
  });
});

describe('voyageHeading (orientación del sprite sin poner el mástil boca abajo)', () => {
  it('hacia el este rota sin espejar', () => {
    expect(voyageHeading(0)).toEqual({ rotateDeg: 0, mirrored: false });
    expect(voyageHeading(Math.PI / 4).rotateDeg).toBeCloseTo(45);
    expect(voyageHeading(Math.PI / 4).mirrored).toBe(false);
  });

  it('hacia el oeste espeja y rota el suplementario', () => {
    expect(voyageHeading(Math.PI)).toEqual({ rotateDeg: 0, mirrored: true });
    const heading = voyageHeading((3 * Math.PI) / 4); // 135°: rumbo arriba-izquierda
    expect(heading.mirrored).toBe(true);
    expect(heading.rotateDeg).toBeCloseTo(-45);
  });

  it('los rumbos verticales quedan en el límite sin espejar', () => {
    expect(voyageHeading(Math.PI / 2)).toEqual({ rotateDeg: 90, mirrored: false });
    expect(voyageHeading(-Math.PI / 2)).toEqual({ rotateDeg: -90, mirrored: false });
  });

  it('normaliza ángulos con vueltas de más', () => {
    expect(voyageHeading(2 * Math.PI).rotateDeg).toBeCloseTo(0);
    expect(voyageHeading(2 * Math.PI).mirrored).toBe(false);
  });

  it('rechaza rumbos no finitos', () => {
    expect(() => voyageHeading(NaN)).toThrow(/inválido/i);
  });
});
