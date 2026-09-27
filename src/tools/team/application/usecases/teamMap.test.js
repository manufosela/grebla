import { describe, it, expect } from 'vitest';
import { getTeamMap } from './teamMap.js';

/**
 * El Mapa pedía las lecturas PERSONA A PERSONA, esperando a cada una antes de
 * empezar la siguiente (RMR-BUG-0133). Con 40 fichas eso son 40 rondas
 * encadenadas contra Firestore, y por eso «tardaba mil» — y tardaba lo mismo la
 * quinta vez que la primera.
 *
 * Lo que se prueba aquí no es que vaya rápido, que dependería de la red: es que
 * las lecturas **se solapan**. Un test de reloj sería flaky; uno de solapamiento
 * dice exactamente lo que cambió.
 */

/** Persistencia de mentira que ANOTA cuántas lecturas hay vivas a la vez. */
function fakePersistence(people, { onOverlap } = {}) {
  let vivas = 0;
  let maxVivas = 0;
  const lectura = (valor) => async () => {
    vivas += 1;
    maxVivas = Math.max(maxVivas, vivas);
    onOverlap?.(maxVivas);
    // Cede el turno para que otras lecturas puedan empezar si de verdad se
    // lanzaron en paralelo. Sin esto, `async` sin await resolvería en orden.
    await Promise.resolve();
    await Promise.resolve();
    vivas -= 1;
    return valor;
  };
  return {
    maxVivas: () => maxVivas,
    people: { list: async () => people },
    readings: {
      seniority: { latest: lectura({ level: 3, toNext: false }) },
      emotional: { latest: lectura({ level: 4, toNext: true }) },
      contribution: { latest: lectura({ roles: ['CO'] }) },
      knowledge: { listByPerson: lectura([{ areaId: 'a1', level: 2, toNext: false }]) },
    },
  };
}

const gente = (n) => Array.from({ length: n }, (_, i) => ({
  id: `p${i}`, name: `Persona ${i}`, active: true, guilds: [], levelId: 'L1', external: false,
}));

describe('el Mapa no pide las lecturas en fila (RMR-BUG-0133)', () => {
  it('con 20 personas, las lecturas se solapan', async () => {
    // En fila, como estaba, nunca habría más de 4 lecturas vivas —las de UNA
    // persona—. Solapadas, hay muchas más.
    const p = fakePersistence(gente(20));
    await getTeamMap(p);
    expect(p.maxVivas()).toBeGreaterThan(4);
  });

  it('y con una sola persona sigue funcionando igual', async () => {
    const p = fakePersistence(gente(1));
    const filas = await getTeamMap(p);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ id: 'p0', name: 'Persona 0' });
  });
});

describe('lo que el Mapa devuelve no cambia', () => {
  it('una fila por persona, en el MISMO orden que llegan', async () => {
    // Paralelizar no puede reordenar: la tabla se lee de arriba abajo y el
    // orden es el del roster.
    const filas = await getTeamMap(fakePersistence(gente(5)));
    expect(filas.map((f) => f.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
  });

  it('con las cuatro dimensiones y el perfil de conocimiento resueltos', async () => {
    const [fila] = await getTeamMap(fakePersistence(gente(1)));
    expect(fila.seniority).toEqual({ level: 3, toNext: false });
    expect(fila.emotional).toEqual({ level: 4, toNext: true });
    expect(fila.contribution).toEqual(['CO']);
    expect(fila.knowledge.areas).toEqual([{ areaId: 'a1', level: 2, toNext: false }]);
    expect(fila.knowledge.profile).toBeTruthy();
  });

  it('sin lecturas, las dimensiones salen a null y no a cero', async () => {
    // Un cero sería una medida; no haber leído nunca a alguien no lo es.
    const vacia = {
      people: { list: async () => gente(1) },
      readings: {
        seniority: { latest: async () => null },
        emotional: { latest: async () => null },
        contribution: { latest: async () => null },
        knowledge: { listByPerson: async () => [] },
      },
    };
    const [fila] = await getTeamMap(vacia);
    expect(fila.seniority).toBeNull();
    expect(fila.emotional).toBeNull();
    expect(fila.contribution).toBeNull();
    expect(fila.knowledge.areas).toEqual([]);
  });
});
