/**
 * Tests del catálogo de formatos de retro (RMR-TSK-0242).
 */
import { describe, it, expect } from 'vitest';
import { RETRO_FORMATS, RETRO_FORMAT_IDS, getFormat, formatColumns, isValidColumn } from './formats.js';

describe('catálogo de formatos', () => {
  it('expone los 3 formatos de salida', () => {
    expect(RETRO_FORMAT_IDS).toEqual(expect.arrayContaining(['ssc', 'pmss', 'barco']));
  });

  it('cada formato tiene id, nombre, kind y columnas con acento', () => {
    for (const id of RETRO_FORMAT_IDS) {
      const f = RETRO_FORMATS[id];
      expect(f.id).toBe(id);
      expect(f.name).toBeTruthy();
      expect(['columns', 'barco']).toContain(f.kind);
      expect(f.columns.length).toBeGreaterThan(0);
      for (const c of f.columns) {
        expect(c.id).toBeTruthy();
        expect(['teal', 'coral', 'navy', 'amber']).toContain(c.accent);
      }
    }
  });

  it('el Barco tiene Viento/Ancla/Rocas/Isla', () => {
    expect(formatColumns('barco').map((c) => c.id)).toEqual(['viento', 'ancla', 'rocas', 'isla']);
    expect(RETRO_FORMATS.barco.kind).toBe('barco');
  });

  it('getFormat devuelve null para un id inexistente', () => {
    expect(getFormat('nope')).toBeNull();
    expect(formatColumns('nope')).toEqual([]);
  });

  it('isValidColumn valida la pertenencia', () => {
    expect(isValidColumn('ssc', 'start')).toBe(true);
    expect(isValidColumn('ssc', 'viento')).toBe(false);
    expect(isValidColumn('barco', 'isla')).toBe(true);
    expect(isValidColumn('no-existe', 'x')).toBe(false);
  });
});
