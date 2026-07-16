/**
 * Tests de la lógica del editor de mapa de carrera en superadmin-panel
 * (RMR-TSK-0231): alta de casa pre-asignada a una comarca. Se ejercitan los
 * métodos reales del prototipo sobre un `this` mínimo, sin montar el componente
 * Lit (que arrastraría Firebase y un DOM): se verifica la manipulación del
 * modelo, no el render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SuperadminPanel } from './superadmin-panel.js';

const { _addCity, _patchMap } = SuperadminPanel.prototype;

/** `this` mínimo con un mapa de ejemplo (2 comarcas, casas repartidas). */
function makeCtx() {
  return {
    _careerMap: {
      id: 'web', name: 'Isla Web', startPort: null,
      areas: [{ id: 'frontend', name: 'Frontend' }, { id: 'backend', name: 'Backend' }],
      cities: [
        { id: 'react', name: 'React', kind: 'skill', area: 'frontend', x: 30, y: 40, weight: 2, prereqs: [] },
      ],
    },
    _newCity: { id: '', name: '' },
    _mapError: '',
    _mapNotice: '',
    _patchMap,
  };
}

const cityById = (ctx, id) => ctx._careerMap.cities.find((c) => c.id === id);

describe('_addCity: alta de casa pre-asignada a una comarca', () => {
  let ctx;
  beforeEach(() => { ctx = makeCtx(); });

  it('asigna la comarca indicada cuando existe', () => {
    ctx._newCity = { id: 'node', name: 'Node.js' };
    _addCity.call(ctx, 'backend');
    expect(cityById(ctx, 'node').area).toBe('backend');
    expect(ctx._careerMap.cities).toHaveLength(2);
  });

  it('cae a la primera comarca si la indicada no existe', () => {
    ctx._newCity = { id: 'ghost', name: 'Fantasma' };
    _addCity.call(ctx, 'no-existe');
    expect(cityById(ctx, 'ghost').area).toBe('frontend');
  });

  it('no añade nada y marca error si falta id o nombre', () => {
    ctx._newCity = { id: '', name: 'Sin id' };
    _addCity.call(ctx, 'frontend');
    expect(ctx._careerMap.cities).toHaveLength(1);
    expect(ctx._mapError).not.toBe('');
  });

  it('rechaza un id de casa duplicado', () => {
    ctx._newCity = { id: 'react', name: 'React duplicada' };
    _addCity.call(ctx, 'backend');
    expect(ctx._careerMap.cities).toHaveLength(1);
    expect(ctx._mapError).toContain('react');
  });

  it('crea la casa con valores por defecto coherentes', () => {
    ctx._newCity = { id: 'css', name: 'CSS' };
    _addCity.call(ctx, 'frontend');
    const css = cityById(ctx, 'css');
    expect(css).toMatchObject({ kind: 'tech', x: 50, y: 50, weight: 1, prereqs: [] });
  });
});
