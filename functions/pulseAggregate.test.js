/**
 * Tests del agregado anónimo de Marea (RMR-TSK-0236): medias por ámbito, umbral
 * de privacidad y «una marea por persona (la última)». Puro, sin firebase.
 */
import { describe, it, expect } from 'vitest';
import { computePulseAggregate, departmentOf, normalizeWord } from './pulseAggregate.js';

const P = (uid, day, vals) => ({ uid, day, ...vals });
const full = { energia: 60, animo: 60, carga: 50, rumbo: 50, tripulacion: 50, reconocimiento: 50 };

const people = {
  u1: { guilds: ['Backend'], labels: ['Pagos'] },
  u2: { guilds: ['Backend'], labels: ['Onboarding'] },
  u3: { guilds: ['Frontend'], labels: ['Pagos'] },
  u4: { guilds: ['Backend'], labels: ['Pagos'] },
};

describe('computePulseAggregate', () => {
  it('promedia por dimensión en general', () => {
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', { ...full, energia: 40 }),
      P('u2', '2026-07-13', { ...full, energia: 80 }),
      P('u3', '2026-07-13', { ...full, energia: 60 }),
    ], people, { minCount: 3 });
    expect(agg.respondents).toBe(3);
    expect(agg.general.means.energia).toBe(60); // (40+80+60)/3
  });

  it('cuenta UNA marea por persona: la del día más reciente', () => {
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', { ...full, energia: 10 }),
      P('u1', '2026-07-16', { ...full, energia: 90 }), // más reciente → gana
      P('u2', '2026-07-14', { ...full, energia: 50 }),
      P('u3', '2026-07-14', { ...full, energia: 50 }),
    ], people, { minCount: 3 });
    expect(agg.respondents).toBe(3); // 3 personas, no 4 registros
    expect(agg.general.means.energia).toBe(63); // (90+50+50)/3 = 63.3 → 63
  });

  it('oculta las medias de un grupo con menos del umbral', () => {
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', full), // Backend+Pagos
      P('u2', '2026-07-13', full), // Backend+Onboarding
      P('u4', '2026-07-13', full), // Backend+Pagos
    ], people, { minCount: 3 });
    const backend = agg.guilds.find((g) => g.id === 'Backend');
    expect(backend.count).toBe(3);
    expect(backend.means).not.toBeNull();
    // Pagos solo tiene 2 (u1, u4) → no aparece
    expect(agg.labels.find((l) => l.id === 'Pagos')).toBeUndefined();
    // Onboarding tiene 1 → tampoco
    expect(agg.labels.length).toBe(0);
  });

  it('la general se oculta si hay menos del umbral (protege el anonimato)', () => {
    const agg = computePulseAggregate('2026-W29', [P('u1', '2026-07-13', full), P('u2', '2026-07-13', full)], people, { minCount: 3 });
    expect(agg.respondents).toBe(2);
    expect(agg.general.means).toBeNull();
  });

  it('una persona en varios grupos cuenta en cada uno', () => {
    // 3 personas en Pagos (u1,u3,u4) y 3 en Backend (u1,u2,u4)
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', full), P('u2', '2026-07-13', full),
      P('u3', '2026-07-13', full), P('u4', '2026-07-13', full),
    ], people, { minCount: 3 });
    expect(agg.guilds.find((g) => g.id === 'Backend').count).toBe(3);
    expect(agg.labels.find((l) => l.id === 'Pagos').count).toBe(3);
  });

  it('nube de palabras: solo cuenta las de opt-in (shareWord), normalizadas y por frecuencia', () => {
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', { ...full, palabra: 'Remando', shareWord: true }),
      P('u2', '2026-07-13', { ...full, palabra: '  remando ', shareWord: true }), // misma tras normalizar
      P('u3', '2026-07-13', { ...full, palabra: 'en calma', shareWord: true }),
      P('u4', '2026-07-13', { ...full, palabra: 'privada', shareWord: false }), // no opt-in → fuera
    ], people, { minCount: 3 });
    expect(agg.general.words).toEqual([
      { text: 'remando', count: 2 },
      { text: 'en calma', count: 1 },
    ]);
    expect(agg.general.words.some((w) => w.text === 'privada')).toBe(false);
  });

  it('nube de palabras: se oculta si el ámbito no llega al umbral (anonimato)', () => {
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', { ...full, palabra: 'sola', shareWord: true }),
      P('u2', '2026-07-13', { ...full, palabra: 'otra', shareWord: true }),
    ], people, { minCount: 3 });
    expect(agg.general.means).toBeNull();
    expect(agg.general.words).toEqual([]); // 2 < 3 → ni medias ni nube
  });

  it('normalizeWord: minúsculas, trim y espacios colapsados', () => {
    expect(normalizeWord('  A   TOPE  ')).toBe('a tope');
    expect(normalizeWord(null)).toBe('');
  });
});

describe('departmentOf', () => {
  const heads = new Set(['head1', 'head2']);

  it('sube por reportsTo hasta encontrar el Head del que cuelga', () => {
    // dirección → jefe de departamento → manager: la persona pertenece al
    // departamento del Head, aunque su manager esté dos saltos por debajo.
    const reportsTo = { em1: 'mando1', mando1: 'head1' };
    expect(departmentOf('em1', reportsTo, heads)).toBe('head1');
  });

  it('un manager que ya es Head es su propio departamento', () => {
    expect(departmentOf('head1', {}, heads)).toBe('head1');
  });

  it('devuelve null si no cuelga de ningún Head', () => {
    expect(departmentOf('suelto', { suelto: null }, heads)).toBeNull();
    expect(departmentOf(null, {}, heads)).toBeNull();
  });

  it('no se cuelga ante un ciclo en reportsTo', () => {
    expect(departmentOf('a', { a: 'b', b: 'a' }, heads)).toBeNull();
  });
});

describe('computePulseAggregate — corte por departamento (RMR-TSK-0296)', () => {
  const byDept = {
    u1: { guilds: [], labels: [], department: 'Tecnología' },
    u2: { guilds: [], labels: [], department: 'Tecnología' },
    u3: { guilds: [], labels: [], department: 'Tecnología' },
    u4: { guilds: [], labels: [], department: 'Ventas' },
  };

  it('agrupa las mareas por departamento', () => {
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', { ...full, energia: 40 }),
      P('u2', '2026-07-13', { ...full, energia: 80 }),
      P('u3', '2026-07-13', { ...full, energia: 60 }),
    ], byDept, { minCount: 3 });
    expect(agg.departments).toEqual([
      expect.objectContaining({ id: 'Tecnología', count: 3 }),
    ]);
    expect(agg.departments[0].means.energia).toBe(60);
  });

  it('hereda el umbral: un departamento pequeño NO se publica', () => {
    // Es el primer corte de la marea que sigue la línea de mando, así que el
    // mínimo importa más que nunca: un departamento de 1 sería mirar a alguien.
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', full),
      P('u2', '2026-07-13', full),
      P('u3', '2026-07-13', full),
      P('u4', '2026-07-13', full), // Ventas: solo 1 → no se publica
    ], byDept, { minCount: 3 });
    expect(agg.departments.map((d) => d.id)).toEqual(['Tecnología']);
  });

  it('quien no cuelga de ningún departamento cuenta en general pero no lo ensucia', () => {
    const agg = computePulseAggregate('2026-W29', [
      P('u1', '2026-07-13', full),
      P('u2', '2026-07-13', full),
      P('u3', '2026-07-13', full),
      P('sinDepto', '2026-07-13', full),
    ], byDept, { minCount: 3 });
    expect(agg.respondents).toBe(4);
    expect(agg.departments.map((d) => d.id)).toEqual(['Tecnología']);
  });
});
