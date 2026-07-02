import { describe, it, expect } from 'vitest';
import {
  ENGINEERING_FRAMEWORK,
  seedFramework,
  normalizeFramework,
  serializeFramework,
  composeTitle,
  getLevel,
  expectationsForLevel,
  addendumsForDisciplines,
  aspirationalLevels,
} from './framework.js';

describe('career — framework de carrera (helpers puros)', () => {
  it('seedFramework devuelve una copia profunda del framework (fallback)', () => {
    const seed = seedFramework();
    expect(seed).toEqual(ENGINEERING_FRAMEWORK);
    expect(seed).not.toBe(ENGINEERING_FRAMEWORK);
    seed.tracks[0].name = 'cambiado';
    expect(ENGINEERING_FRAMEWORK.tracks[0].name).not.toBe('cambiado');
  });

  it('normalizeFramework(null|undefined) usa la semilla (documento inexistente)', () => {
    expect(normalizeFramework(null)).toEqual(ENGINEERING_FRAMEWORK);
    expect(normalizeFramework(undefined)).toEqual(ENGINEERING_FRAMEWORK);
  });

  it('normalizeFramework ordena cada catálogo por `order` y descarta ids vacíos', () => {
    const fw = normalizeFramework({
      name: 'Ingeniería',
      tracks: [
        { id: 'b', name: 'B', order: 2, description: '' },
        { id: 'a', name: 'A', order: 1, description: '' },
        { id: '', name: 'descartado', order: 3 },
      ],
      levels: [
        { id: 'x', code: 'X', title: 'X', trackId: 'a', order: 5, description: '', typicalProfile: '', branchesFrom: 'y' },
        { id: 'y', code: 'Y', title: 'Y', trackId: 'a', order: 1, description: '', typicalProfile: '', branchesFrom: '' },
      ],
      disciplines: [{ id: 'd', name: 'D', order: 1, description: '' }],
      dimensions: [{ id: 'm', name: 'M', order: 1, description: '' }],
    });
    expect(fw.id).toBe('engineering');
    expect(fw.name).toBe('Ingeniería');
    expect(fw.tracks.map((t) => t.id)).toEqual(['a', 'b']); // ordenado y sin el vacío
    expect(fw.levels.map((l) => l.id)).toEqual(['y', 'x']); // ordenado por order
    expect(fw.levels[0].branchesFrom).toBeNull(); // '' → null
    expect(fw.levels[1].branchesFrom).toBe('y');
  });

  it('normalizeFramework sanea tipos: order no numérico → 0, campos ausentes → string vacía', () => {
    const fw = normalizeFramework({
      tracks: [{ id: 't', name: 'T', order: 'x', description: 5 }],
      levels: [{ id: 'l', trackId: 't', order: undefined }],
      disciplines: [],
      dimensions: [],
    });
    expect(fw.tracks[0].order).toBe(0);
    expect(fw.tracks[0].description).toBe('5');
    expect(fw.levels[0]).toMatchObject({ id: 'l', code: '', title: '', order: 0, typicalProfile: '', branchesFrom: null });
    expect(fw.name).toBe(ENGINEERING_FRAMEWORK.name); // sin name en data → nombre de la semilla
  });

  it('serializeFramework es Firestore-safe (sin undefined) y respeta branchesFrom null', () => {
    const serialized = serializeFramework({
      id: 'engineering',
      name: 'Mi framework',
      tracks: [{ id: 'ic', name: 'IC', order: 1, description: 'desc' }, { id: '', name: 'x', order: 2, description: '' }],
      levels: [
        { id: 'l1', code: 'L1', title: 'Eng', trackId: 'ic', order: 1, description: 'd', typicalProfile: '2+', branchesFrom: undefined },
      ],
      disciplines: [],
      dimensions: [],
    });
    expect(serialized.name).toBe('Mi framework');
    expect(serialized.tracks).toEqual([{ id: 'ic', name: 'IC', order: 1, description: 'desc' }]); // descarta id vacío
    expect(serialized.levels[0].branchesFrom).toBeNull();
    expect('id' in serialized).toBe(false); // el id es el del documento
    // ningún valor undefined en el objeto serializado
    expect(JSON.stringify(serialized)).not.toContain('undefined');
  });

  it('la semilla incluye la matriz de expectativas y los addendums del documento', () => {
    const seed = seedFramework();
    expect(seed.expectations.length).toBeGreaterThan(0);
    expect(seed.addendums.length).toBeGreaterThan(0);
    // cada expectativa referencia un nivel y una dimensión con texto
    expect(seed.expectations.every((e) => e.levelId && e.dimensionId && e.text)).toBe(true);
  });

  it('normalizeFramework normaliza expectations y descarta celdas incompletas', () => {
    const fw = normalizeFramework({
      levels: [{ id: 'l1', code: 'L1', title: 'Eng', trackId: 't', order: 1 }],
      dimensions: [{ id: 'tech', name: 'Tech', order: 1, description: '' }],
      tracks: [{ id: 't', name: 'T', order: 1, description: '' }],
      disciplines: [],
      expectations: [
        { levelId: 'l1', dimensionId: 'tech', text: '  Escribe código sólido  ' }, // se conserva y se trimea
        { levelId: 'l1', dimensionId: 'tech', text: '   ' }, // texto vacío tras trim → descartada
        { levelId: '', dimensionId: 'tech', text: 'sin nivel' }, // sin levelId → descartada
        { levelId: 'l1', dimensionId: '', text: 'sin dimensión' }, // sin dimensionId → descartada
      ],
    });
    expect(fw.expectations).toEqual([{ levelId: 'l1', dimensionId: 'tech', text: 'Escribe código sólido' }]);
  });

  it('normalizeFramework normaliza addendums y descarta los incompletos', () => {
    const fw = normalizeFramework({
      tracks: [], levels: [], dimensions: [], disciplines: [],
      addendums: [
        { disciplineId: 'backend', dimensionId: 'tech', text: 'APIs y datos' },
        { disciplineId: 'backend', dimensionId: 'tech', text: '' }, // vacío → descartado
        { disciplineId: '', dimensionId: 'tech', text: 'sin disciplina' }, // descartado
        { disciplineId: 'backend', dimensionId: '', text: 'sin dimensión' }, // descartado
      ],
    });
    expect(fw.addendums).toEqual([{ disciplineId: 'backend', dimensionId: 'tech', text: 'APIs y datos' }]);
  });

  it('normalizeFramework sin expectations/addendums en data → arrays vacíos', () => {
    const fw = normalizeFramework({ tracks: [], levels: [], disciplines: [], dimensions: [] });
    expect(fw.expectations).toEqual([]);
    expect(fw.addendums).toEqual([]);
  });

  it('serializeFramework es Firestore-safe con expectations y addendums (trim + descarta vacíos)', () => {
    const serialized = serializeFramework({
      id: 'engineering',
      name: 'FW',
      tracks: [], levels: [], disciplines: [], dimensions: [],
      expectations: [
        { levelId: 'l1', dimensionId: 'tech', text: '  cumple  ' },
        { levelId: 'l1', dimensionId: 'product', text: '   ' }, // vacío → fuera
      ],
      addendums: [
        { disciplineId: 'web', dimensionId: 'tech', text: 'Core Web Vitals' },
        { disciplineId: 'web', dimensionId: 'reliability', text: '' }, // vacío → fuera
      ],
    });
    expect(serialized.expectations).toEqual([{ levelId: 'l1', dimensionId: 'tech', text: 'cumple' }]);
    expect(serialized.addendums).toEqual([{ disciplineId: 'web', dimensionId: 'tech', text: 'Core Web Vitals' }]);
    expect(JSON.stringify(serialized)).not.toContain('undefined');
  });

  it('expectations y addendums: round-trip normalize→serialize→normalize es estable', () => {
    const base = normalizeFramework({
      tracks: [{ id: 't', name: 'T', order: 1, description: '' }],
      levels: [{ id: 'l1', code: 'L1', title: 'Eng', trackId: 't', order: 1 }],
      disciplines: [{ id: 'backend', name: 'Backend', order: 1, description: '' }],
      dimensions: [{ id: 'tech', name: 'Tech', order: 1, description: '' }],
      expectations: [{ levelId: 'l1', dimensionId: 'tech', text: 'cumple' }],
      addendums: [{ disciplineId: 'backend', dimensionId: 'tech', text: 'APIs' }],
    });
    const round = normalizeFramework(serializeFramework(base));
    expect(round.expectations).toEqual(base.expectations);
    expect(round.addendums).toEqual(base.addendums);
    expect(round).toEqual(base);
  });

  it('normalize→serialize→normalize es estable (idempotente)', () => {
    const base = normalizeFramework(serializeFramework(seedFramework()));
    const round = normalizeFramework(serializeFramework(base));
    expect(round).toEqual(base);
  });

  describe('composeTitle — título compuesto de una persona', () => {
    const fw = seedFramework(); // usa l3 = "Senior Engineer II" y disciplinas backend/web

    it('con nivel + disciplinas → "título · disciplinas" (en orden del framework)', () => {
      // web (order 3) va después de backend (order 1) aunque se pase primero: orden del framework
      expect(composeTitle(fw, 'l3', ['web', 'backend'])).toBe('Senior Engineer II · Backend, Web / Frontend');
    });

    it('solo nivel → título del nivel', () => {
      expect(composeTitle(fw, 'l3', [])).toBe('Senior Engineer II');
      expect(composeTitle(fw, 'l3', null)).toBe('Senior Engineer II');
    });

    it('solo disciplinas → nombres separados por coma', () => {
      expect(composeTitle(fw, null, ['backend', 'web'])).toBe('Backend, Web / Frontend');
      expect(composeTitle(fw, '', ['backend'])).toBe('Backend');
    });

    it('sin nada o ids desconocidos → cadena vacía', () => {
      expect(composeTitle(fw, null, [])).toBe('');
      expect(composeTitle(fw, undefined, undefined)).toBe('');
      expect(composeTitle(fw, 'noexiste', ['tampoco'])).toBe('');
      expect(composeTitle(null, 'l3', ['backend'])).toBe('');
    });
  });

  describe('getLevel — nivel por id', () => {
    const fw = seedFramework();

    it('devuelve el objeto nivel cuando existe', () => {
      expect(getLevel(fw, 'l3')).toMatchObject({ id: 'l3', code: 'L3', title: 'Senior Engineer II', trackId: 'ic' });
    });

    it('devuelve null para id inexistente, vacío o framework nulo', () => {
      expect(getLevel(fw, 'noexiste')).toBeNull();
      expect(getLevel(fw, null)).toBeNull();
      expect(getLevel(fw, '')).toBeNull();
      expect(getLevel(null, 'l3')).toBeNull();
    });
  });

  describe('expectationsForLevel — una expectativa por dimensión', () => {
    const fw = {
      ...seedFramework(),
      expectations: [
        { levelId: 'l2', dimensionId: 'reliability', text: 'Vela por la fiabilidad de su área' },
        { levelId: 'l2', dimensionId: 'tech', text: 'Escribe código sólido y mantenible' },
        { levelId: 'l3', dimensionId: 'tech', text: 'otro nivel, se ignora' },
      ],
    };

    it('devuelve una entrada por dimensión, ordenadas por dimension.order', () => {
      const rows = expectationsForLevel(fw, 'l2');
      expect(rows).toHaveLength(fw.dimensions.length); // 6 dimensiones
      expect(rows.map((r) => r.dimension.id)).toEqual(['tech', 'reliability', 'product', 'execution', 'leadership', 'culture']);
    });

    it('rellena el texto de la expectativa del nivel y deja "" donde no hay', () => {
      const rows = expectationsForLevel(fw, 'l2');
      const byDim = Object.fromEntries(rows.map((r) => [r.dimension.id, r.text]));
      expect(byDim.tech).toBe('Escribe código sólido y mantenible');
      expect(byDim.reliability).toBe('Vela por la fiabilidad de su área');
      expect(byDim.product).toBe(''); // sin expectativa definida
    });

    it('sin levelId → todas las dimensiones con texto vacío', () => {
      const rows = expectationsForLevel(fw, null);
      expect(rows).toHaveLength(fw.dimensions.length);
      expect(rows.every((r) => r.text === '')).toBe(true);
    });
  });

  describe('addendumsForDisciplines — foco por disciplina (sección 10)', () => {
    const fw = {
      ...seedFramework(),
      addendums: [
        { disciplineId: 'web', dimensionId: 'reliability', text: 'Core Web Vitals y presupuesto de rendimiento' },
        { disciplineId: 'web', dimensionId: 'tech', text: 'Arquitectura frontend y design systems' },
        { disciplineId: 'backend', dimensionId: 'tech', text: 'Diseño de APIs y modelado de datos' },
        { disciplineId: 'backend', dimensionId: 'tech', text: '   ' }, // sin texto → fuera
        { disciplineId: 'data', dimensionId: 'tech', text: 'Pipelines (no seleccionada)' },
      ],
    };

    it('solo los addendums de las disciplinas indicadas y con texto', () => {
      const rows = addendumsForDisciplines(fw, ['backend', 'web']);
      expect(rows.map((r) => r.text)).not.toContain('Pipelines (no seleccionada)');
      expect(rows).toHaveLength(3);
    });

    it('ordena por discipline.order y luego dimension.order, resolviendo nombres', () => {
      const rows = addendumsForDisciplines(fw, ['web', 'backend']);
      // backend (order 1) antes que web (order 3); dentro de web, tech (1) antes que reliability (2)
      expect(rows.map((r) => [r.discipline.id, r.dimension.id])).toEqual([
        ['backend', 'tech'],
        ['web', 'tech'],
        ['web', 'reliability'],
      ]);
      expect(rows[0]).toMatchObject({ discipline: { id: 'backend', name: 'Backend' }, dimension: { id: 'tech', name: 'Technical Excellence' } });
    });

    it('sin disciplinas o framework nulo → []', () => {
      expect(addendumsForDisciplines(fw, [])).toEqual([]);
      expect(addendumsForDisciplines(fw, null)).toEqual([]);
      expect(addendumsForDisciplines(null, ['web'])).toEqual([]);
    });
  });

  describe('aspirationalLevels — a qué aspirar desde el nivel actual', () => {
    const fw = seedFramework();

    it('desde L2 (IC) salen L3/L4/L5 del mismo track (sin ramas)', () => {
      const rows = aspirationalLevels(fw, 'l2');
      expect(rows.map((r) => r.id)).toEqual(['l3', 'l4', 'l5']);
      expect(rows.every((r) => r.trackId === 'ic')).toBe(true);
      expect(rows[0]).toMatchObject({ code: 'L3', title: 'Senior Engineer II' });
    });

    it('desde L3 (IC): progresión IC (L4,L5) + laterales equivalentes (L3-TL,L3-EM) + rama L4-TL; no L4-EM', () => {
      const rows = aspirationalLevels(fw, 'l3');
      const ids = rows.map((r) => r.id);
      // progresión del track (order>3), luego laterales de otros tracks al mismo
      // order (l3tl, l3em), y por último las ramas branchesFrom l3 (l4tl).
      expect(ids).toEqual(['l4', 'l5', 'l3tl', 'l3em', 'l4tl']);
      expect(ids).not.toContain('l4em'); // order 4, no equivalente ni rama de l3
      expect(rows.map((r) => r.code)).toEqual(['L4', 'L5', 'L3-TL', 'L3-EM', 'L4-TL']);
    });

    it('desde L4 (Staff): progresión (L5) + laterales equivalentes L4-TL/L4-EM', () => {
      const rows = aspirationalLevels(fw, 'l4');
      expect(rows.map((r) => r.id)).toEqual(['l5', 'l4tl', 'l4em']);
      expect(rows.map((r) => r.code)).toEqual(['L5', 'L4-TL', 'L4-EM']);
    });

    it('devuelve el subconjunto de campos esperado', () => {
      const [first] = aspirationalLevels(fw, 'l3');
      expect(Object.keys(first).toSorted()).toEqual(['code', 'description', 'id', 'title', 'trackId', 'typicalProfile']);
    });

    it('nivel inexistente o sin nivel → []', () => {
      expect(aspirationalLevels(fw, 'noexiste')).toEqual([]);
      expect(aspirationalLevels(fw, null)).toEqual([]);
      expect(aspirationalLevels(null, 'l3')).toEqual([]);
    });

    it('desde L5 (Principal): laterales a los peldaños L5 de TL/EM (Distinguished Architect, Director)', () => {
      const rows = aspirationalLevels(fw, 'l5');
      expect(rows.map((r) => r.id)).toEqual(['l5tl', 'l5em']);
      expect(rows.map((r) => r.code)).toEqual(['L5-TL', 'L5-EM']);
    });

    it('un nivel realmente terminal (sin progresión, laterales ni ramas) → []', () => {
      // Framework mínimo de un solo nivel: no hay a dónde escalar ni saltar.
      const solo = { ...seedFramework(), levels: [{ id: 'x', code: 'X', title: 'X', trackId: 't', order: 1, description: '', typicalProfile: '', branchesFrom: null }] };
      expect(aspirationalLevels(solo, 'x')).toEqual([]);
    });
  });
});
