import { describe, it, expect } from 'vitest';
import { areaOf, intermediateBranches, rootRoles, childrenOf, intraLayerDepth, layerOf, pyramidLayers, roleChain, superiorCandidatesFor, wouldCycle, assertValidReportsTo, roleDepth, orgRoleRows, branchColor, layerColor } from './orgRoles.js';

/** @type {import('./orgRoles.js').OrgRole[]} */
const roles = [
  { id: 'cto', label: 'CTO', branch: 'engineering', reportsToRoleId: null },
  { id: 'head-eng', label: 'Head of Engineering', branch: 'engineering', reportsToRoleId: 'cto' },
  { id: 'em', label: 'Engineering Manager', branch: 'engineering', reportsToRoleId: 'head-eng' },
  { id: 'engineer', label: 'Engineer', branch: 'engineering', reportsToRoleId: 'em' },
  { id: 'cpo', label: 'CPO', branch: 'product', reportsToRoleId: null },
  { id: 'pm', label: 'Product Manager', branch: 'product', reportsToRoleId: 'cpo' },
  { id: 'head-data', label: 'Head of Data', branch: 'data', reportsToRoleId: null },
  { id: 'generico', label: 'Genérico', branch: 'generico', reportsToRoleId: null },
];

describe('rootRoles', () => {
  it('devuelve una cima por rama (y el genérico)', () => {
    expect(rootRoles(roles).map((r) => r.id).sort()).toEqual(['cpo', 'cto', 'generico', 'head-data']);
  });
});

describe('childrenOf', () => {
  it('lista los roles que reportan a uno dado', () => {
    expect(childrenOf(roles, 'cto').map((r) => r.id)).toEqual(['head-eng']);
    expect(childrenOf(roles, 'head-data')).toEqual([]); // Head of Data sin managers debajo
  });
});

describe('roleChain', () => {
  it('sube desde un rol hasta su cima', () => {
    expect(roleChain(roles, 'engineer').map((r) => r.id)).toEqual(['engineer', 'em', 'head-eng', 'cto']);
  });
  it('una cima es su propia cadena', () => {
    expect(roleChain(roles, 'cpo').map((r) => r.id)).toEqual(['cpo']);
  });
});

describe('roleDepth', () => {
  it('0 en la cima, crece hacia abajo', () => {
    expect(roleDepth(roles, 'cto')).toBe(0);
    expect(roleDepth(roles, 'engineer')).toBe(3);
  });
});

describe('wouldCycle', () => {
  it('detecta autodependencia', () => {
    expect(wouldCycle(roles, 'em', 'em')).toBe(true);
  });
  it('detecta ciclo indirecto (poner un ancestro a depender de un descendiente)', () => {
    // cto pasaría a depender de engineer, que ya cuelga de cto → ciclo.
    expect(wouldCycle(roles, 'cto', 'engineer')).toBe(true);
  });
  it('permite reasignaciones válidas', () => {
    expect(wouldCycle(roles, 'em', 'cto')).toBe(false); // saltar un nivel: válido
    expect(wouldCycle(roles, 'head-data', null)).toBe(false);
  });
  it('INVERTIR jerarquía es válido: Head deja de colgar de CTO y CTO cuelga de Head', () => {
    // 1) Head pasa a cima (parent null) — trivialmente sin ciclo.
    expect(wouldCycle(roles, 'head-eng', null)).toBe(false);
    // 2) sobre ese estado, CTO cuelga de Head → sin ciclo.
    const inverted = roles.map((r) => (r.id === 'head-eng' ? { ...r, reportsToRoleId: null } : r));
    expect(wouldCycle(inverted, 'cto', 'head-eng')).toBe(false);
  });
});

describe('assertValidReportsTo', () => {
  it('no lanza en una reasignación válida', () => {
    expect(() => assertValidReportsTo(roles, 'em', 'cto')).not.toThrow();
  });
  it('lanza en autodependencia', () => {
    expect(() => assertValidReportsTo(roles, 'em', 'em')).toThrow(/sí mismo/);
  });
  it('lanza si el superior no existe', () => {
    expect(() => assertValidReportsTo(roles, 'em', 'inexistente')).toThrow(/no existe/);
  });
  it('lanza si crea ciclo', () => {
    expect(() => assertValidReportsTo(roles, 'cto', 'engineer')).toThrow(/ciclo/);
  });
});

describe('orgRoleRows — orden por DEPENDENCIAS (no por rama)', () => {
  it('cada árbol contiguo en post-orden: hojas arriba, la base al final del bloque', () => {
    const rows = orgRoleRows(roles);
    expect(rows.map((r) => r.role.id)).toEqual([
      'engineer', 'em', 'head-eng', 'cto', 'pm', 'cpo', 'head-data', 'generico',
    ]);
  });

  it('una dependencia que CRUZA de rama mantiene la cadena junta (head-eng→cpo: cpo debajo)', () => {
    // El caso reportado: Head of Engineering (engineering) depende de CPO (product).
    const crossed = roles.map((r) => (r.id === 'head-eng' ? { ...r, reportsToRoleId: 'cpo' } : r));
    const ids = orgRoleRows(crossed).map((r) => r.role.id);
    // El árbol de cpo sale contiguo, con TODA la cadena de head-eng dentro y cpo al final (la base).
    expect(ids).toEqual(['cto', 'engineer', 'em', 'head-eng', 'pm', 'cpo', 'head-data', 'generico']);
    // Y cpo va justo después (debajo) de sus dependientes head-eng/pm, no en otro bloque.
    expect(ids.indexOf('cpo')).toBeGreaterThan(ids.indexOf('head-eng'));
    expect(ids.indexOf('cpo')).toBe(ids.indexOf('pm') + 1);
  });

  it('marca firstOfTree solo en la primera fila de cada árbol', () => {
    const rows = orgRoleRows(roles);
    expect(rows.filter((r) => r.firstOfTree).map((r) => r.role.id)).toEqual([
      'engineer', 'pm', 'head-data', 'generico',
    ]);
  });

  it('los roles en un ciclo preexistente (huérfanos de cima) salen igualmente al final', () => {
    const cyc = [
      ...roles,
      { id: 'a', label: 'A', branch: 'generico', reportsToRoleId: 'b' },
      { id: 'b', label: 'B', branch: 'generico', reportsToRoleId: 'a' },
    ];
    const ids = orgRoleRows(cyc).map((r) => r.role.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});

describe('branchColor — color estable por rama (var override + fallback determinista)', () => {
  it('canónicas: var(--rm-branch-<id>, color de marca)', () => {
    expect(branchColor('engineering')).toBe('var(--rm-branch-engineering, #2a9d8f)');
    expect(branchColor('product')).toBe('var(--rm-branch-product, #e76f51)');
    expect(branchColor('data')).toBe('var(--rm-branch-data, #457b9d)');
  });

  it('rama creada: fallback HSL determinista (mismo id → mismo color)', () => {
    const c1 = branchColor('directiva');
    expect(c1).toMatch(/^var\(--rm-branch-directiva, hsl\(\d+ 55% 58%\)\)$/);
    expect(branchColor('directiva')).toBe(c1); // estable
    expect(branchColor('operaciones')).not.toBe(c1); // ids distintos, colores distintos
  });

  it('tolera id vacío cayendo al genérico', () => {
    expect(branchColor('')).toBe('var(--rm-branch-generico, #6b7280)');
  });
});

describe('layerColor — color por capa de la pirámide (RMR-BUG-0072)', () => {
  it('la base (0) es el acento y cada capa tiene tono propio, cíclico', () => {
    expect(layerColor(0)).toBe('#2a9d8f');
    expect(layerColor(1)).not.toBe(layerColor(0));
    expect(layerColor(2)).not.toBe(layerColor(1));
    expect(layerColor(6)).toBe(layerColor(0)); // ciclo de 6
  });
  it('tolera profundidades inválidas cayendo a la base', () => {
    expect(layerColor(-1)).toBe(layerColor(0));
    expect(layerColor(undefined)).toBe(layerColor(0));
  });
});

describe('superiorCandidatesFor — el superior sale del organigrama de roles (RMR-TSK-0361)', () => {
  const roles = [
    { id: 'cto', label: 'CTO', branch: 'engineering', reportsToRoleId: null },
    { id: 'head', label: 'Head', branch: 'engineering', reportsToRoleId: 'cto' },
    { id: 'em', label: 'EM', branch: 'engineering', reportsToRoleId: 'head' },
    { id: 'engineer', label: 'Engineer', branch: 'engineering', reportsToRoleId: 'em' },
  ];
  const people = [
    { id: 'p-cto', name: 'C', orgRole: 'cto' },
    { id: 'p-head1', name: 'H1', orgRole: 'head' },
    { id: 'p-head2', name: 'H2', orgRole: 'head' },
    { id: 'p-em', name: 'M', orgRole: 'em' },
    { id: 'p-eng', name: 'E', orgRole: 'engineer' },
  ];

  it('un manager (em) solo puede reportar a los heads, no a otros managers', () => {
    const { candidates, superiorRole } = superiorCandidatesFor(people[3], people, roles);
    expect(candidates.map((c) => c.id)).toEqual(['p-head1', 'p-head2']);
    expect(superiorRole.id).toBe('head');
  });

  it('un head reporta al cto; el cto (cima) no tiene candidatos', () => {
    expect(superiorCandidatesFor(people[1], people, roles).candidates.map((c) => c.id)).toEqual(['p-cto']);
    const top = superiorCandidatesFor(people[0], people, roles);
    expect(top.candidates).toEqual([]);
    expect(top.superiorRole).toBe(null);
  });

  it('sin rol (o rol desconocido) → todas las demás personas (no derivable, no bloquea)', () => {
    const nobody = { id: 'x', name: 'X', orgRole: null };
    const { candidates, superiorRole } = superiorCandidatesFor(nobody, people, roles);
    expect(candidates).toHaveLength(5);
    expect(superiorRole).toBe(null);
  });

  it('nunca se ofrece a sí misma, y rol superior sin personas → lista vacía con el rol', () => {
    const soloHead = [{ id: 'p-em', name: 'M', orgRole: 'em' }];
    const out = superiorCandidatesFor(soloHead[0], soloHead, roles);
    expect(out.candidates).toEqual([]);
    expect(out.superiorRole.id).toBe('head');
  });
});

describe('capas canónicas (RMR-TSK-0434) — el rango sale del rol, no de la cadena', () => {
  // Data joven: el Head sostiene ICs directamente (sin capa de EMs).
  const roles = [
    { id: 'cto', label: 'CTO', branch: 'engineering', reportsToRoleId: null },
    { id: 'head', label: 'Head', branch: 'engineering', reportsToRoleId: 'cto' },
    { id: 'em', label: 'EM', branch: 'engineering', reportsToRoleId: 'head' },
    { id: 'engineer', label: 'Engineer', branch: 'engineering', reportsToRoleId: 'em' },
    { id: 'head-data', label: 'Head of Data', branch: 'data', reportsToRoleId: 'cto', layer: 1 },
    { id: 'data-eng', label: 'Data Engineer', branch: 'data', reportsToRoleId: 'head-data', layer: 3 },
  ];

  it('layerOf: la capa declarada manda; sin declarar, la profundidad de cadena', () => {
    expect(layerOf(roles, roles.find((r) => r.id === 'data-eng'))).toBe(3);
    expect(layerOf(roles, roles.find((r) => r.id === 'engineer'))).toBe(3);
    expect(layerOf(roles, roles.find((r) => r.id === 'em'))).toBe(2);
    expect(layerOf(roles, roles.find((r) => r.id === 'cto'))).toBe(0);
  });

  it('pyramidLayers agrupa por capa: los ICs de Data bajan con el resto de ICs', () => {
    const layers = pyramidLayers(roles);
    const ids = layers.map((l) => l.roles.map((r) => r.id));
    expect(ids).toEqual([['cto'], ['head', 'head-data'], ['em'], ['engineer', 'data-eng']]);
    expect(layers.map((l) => l.layer)).toEqual([0, 1, 2, 3]);
  });

  it('una capa declarada inválida (negativa, no numérica) cae al fallback', () => {
    const raros = [{ id: 'x', label: 'X', branch: 'data', reportsToRoleId: null, layer: -2 },
      { id: 'y', label: 'Y', branch: 'data', reportsToRoleId: 'x', layer: 'tres' }];
    expect(layerOf(raros, raros[0])).toBe(0);
    expect(layerOf(raros, raros[1])).toBe(1);
  });

});

describe('apilado intra-capa (RMR-TSK-0434): depender de alguien de TU capa se ve', () => {
  const roles = [
    { id: 'ceo', label: 'CEO', branch: 'executive', reportsToRoleId: null, layer: null },
    { id: 'coceo', label: 'coCEO', branch: 'executive', reportsToRoleId: 'ceo', layer: 0 },
    { id: 'cpo', label: 'CPO', branch: 'product', reportsToRoleId: 'coceo', layer: 1 },
  ];

  it('intraLayerDepth: ancestros DENTRO de la misma capa', () => {
    expect(intraLayerDepth(roles, roles.find((r) => r.id === 'ceo'))).toBe(0);
    expect(intraLayerDepth(roles, roles.find((r) => r.id === 'coceo'))).toBe(1);
    expect(intraLayerDepth(roles, roles.find((r) => r.id === 'cpo'))).toBe(0);
  });

  it('pyramidLayers devuelve subfilas: quien depende de alguien de su capa, encima', () => {
    const base = pyramidLayers(roles).find((l) => l.layer === 0);
    expect(base.subrows.map((row) => row.map((r) => r.id))).toEqual([['coceo'], ['ceo']]);
    const capa1 = pyramidLayers(roles).find((l) => l.layer === 1);
    expect(capa1.subrows).toEqual([[roles[2]]]);
  });

  it('un ciclo accidental dentro de la capa termina sin colgarse', () => {
    const raros = [
      { id: 'a', label: 'A', branch: 'x', reportsToRoleId: 'b', layer: 0 },
      { id: 'b', label: 'B', branch: 'x', reportsToRoleId: 'a', layer: 0 },
    ];
    const base = pyramidLayers(raros).find((l) => l.layer === 0);
    expect(base.subrows.flat().map((r) => r.id).toSorted()).toEqual(['a', 'b']);
  });
});

describe('areaOf — «Por ramas» agrupa por ÁREA, no por la categoría del rol', () => {
  // Catálogo real: los EMs tienen rama «engineering-manager» (su categoría),
  // pero cuelgan del Head of Tech y sostienen a ingenieros de «engineering».
  const roles = [
    { id: 'ceo', label: 'CEO', branch: 'executive', reportsToRoleId: null },
    { id: 'cpo', label: 'CPO', branch: 'product', reportsToRoleId: 'ceo' },
    { id: 'cpeople', label: 'CPeople', branch: 'people', reportsToRoleId: 'ceo' },
    { id: 'pm', label: 'PM', branch: 'product', reportsToRoleId: 'cpo' },
    { id: 'head-tech', label: 'Head of Tech', branch: 'engineering', reportsToRoleId: 'cpo' },
    { id: 'em-back', label: 'EM Back', branch: 'engineering-manager', reportsToRoleId: 'head-tech' },
    { id: 'back', label: 'Back', branch: 'engineering', reportsToRoleId: 'em-back' },
    { id: 'qa', label: 'QA', branch: 'engineering', reportsToRoleId: 'head-tech' },
    { id: 'head-data', label: 'Head of Data', branch: 'data', reportsToRoleId: 'cpo' },
    { id: 'data-eng', label: 'Data Eng', branch: 'data', reportsToRoleId: 'head-data' },
  ];
  const area = (id) => areaOf(roles, roles.find((r) => r.id === id));

  it('una rama formada SOLO por mandos intermedios no es un área: se absorbe en la de su superior', () => {
    expect(intermediateBranches(roles)).toEqual(new Set(['engineering-manager']));
    expect(area('em-back')).toBe('engineering');
  });

  it('las áreas de verdad conservan su columna, tengan hojas o árbol', () => {
    expect(area('head-tech')).toBe('engineering');
    expect(area('back')).toBe('engineering');
    expect(area('head-data')).toBe('data');
    expect(area('pm')).toBe('product');
    expect(area('cpeople')).toBe('people'); // hoja sin hijos: área propia
    expect(area('ceo')).toBe('executive');
  });

  it('dos ramas intermedias encadenadas se absorben hacia arriba; una cima intermedia se queda en la suya', () => {
    const raros = [
      { id: 'top', label: 'Top', branch: 'dir', reportsToRoleId: null },
      { id: 'mid1', label: 'M1', branch: 'capa-a', reportsToRoleId: 'top' },
      { id: 'mid2', label: 'M2', branch: 'capa-b', reportsToRoleId: 'mid1' },
      { id: 'leaf', label: 'L', branch: 'dir', reportsToRoleId: 'mid2' },
      { id: 'solo', label: 'S', branch: 'sola', reportsToRoleId: null },
      { id: 'solo-hijo', label: 'SH', branch: 'otra', reportsToRoleId: 'solo' },
    ];
    const a = (id) => areaOf(raros, raros.find((r) => r.id === id));
    expect(a('mid2')).toBe('dir');
    expect(a('mid1')).toBe('dir');
    expect(a('solo')).toBe('sola'); // cima: aunque su rama sea intermedia, no hay superior
  });
});
