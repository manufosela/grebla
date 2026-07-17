/**
 * Dominio puro de las señales de equipo de Marea (RMR-TSK-0239): a partir de las
 * medias semanales AGREGADAS (anónimas) de varias semanas, deriva señales del
 * equipo redactadas SIN señalar a nadie, útiles para la Weekly y los O2O. Sin
 * Firestore ni DOM. Nunca toca datos individuales: solo trabaja con agregados.
 *
 * `weeks`: [{ weekIso, means: {energia,animo,carga,rumbo,tripulacion,reconocimiento},
 *            respondents, totalPeople }] de MÁS ANTIGUA a MÁS RECIENTE.
 */
import { netTrend } from './evolution.js';

/** Prioridad de orden de las señales (primero lo que pide atención). */
const LEVEL_ORDER = { warn: 0, good: 1, info: 2 };

/** Serie de una dimensión (valores finitos) de más antigua a más reciente. */
function seriesOf(weeks, dim) {
  return weeks.map((w) => w?.means?.[dim]).filter((n) => Number.isFinite(n));
}

/** ¿Los últimos `k` valores cumplen el predicado? (sin datos → false) */
function lastK(series, k, pred) {
  if (series.length < k) return false;
  return series.slice(-k).every(pred);
}

/**
 * Señales del equipo a partir de las semanas agregadas.
 * @param {Array<{weekIso?:string, means?:Record<string,number>, respondents?:number, totalPeople?:number}>} [weeks]
 * @returns {Array<{ key: string, level: 'warn'|'good'|'info', text: string }>}
 */
export function teamSignals(weeks = []) {
  const signals = [];
  if (!weeks.length) return signals;
  const latest = weeks.at(-1) ?? {};
  const carga = seriesOf(weeks, 'carga');
  const animo = seriesOf(weeks, 'animo');
  const reconocimiento = seriesOf(weeks, 'reconocimiento');
  const rumbo = seriesOf(weeks, 'rumbo');
  const energia = seriesOf(weeks, 'energia');

  // Carga al alza sostenida (3 semanas crecientes o +12 en 3 semanas).
  if (carga.length >= 3) {
    const [a, b, c] = carga.slice(-3);
    if ((a < b && b < c) || c - a >= 12) {
      signals.push({ key: 'carga-alza', level: 'warn', text: 'La carga del equipo viene subiendo estas semanas. Buen tema para la Weekly: revisar prioridades o quitar lastre antes de que pese.' });
    }
  }
  // Ánimo a la baja (−12 o más en 3 semanas).
  if (animo.length >= 3 && animo.at(-1) - animo.at(-3) <= -12) {
    signals.push({ key: 'animo-baja', level: 'warn', text: 'El ánimo del equipo viene bajando. Merece la pena abrir espacio para escuchar qué está pesando, sin buscar culpables.' });
  }
  // Reconocimiento bajo sostenido (últimas 2 semanas < 45).
  if (lastK(reconocimiento, 2, (v) => v < 45)) {
    signals.push({ key: 'reconocimiento-bajo', level: 'warn', text: 'El reconocimiento lleva un par de semanas bajo. Quizá toca celebrar avances y agradecer en voz alta lo que se está logrando.' });
  }
  // Rumbo poco claro sostenido (últimas 2 semanas < 45).
  if (lastK(rumbo, 2, (v) => v < 45)) {
    signals.push({ key: 'rumbo-bajo', level: 'warn', text: 'El rumbo se percibe poco claro últimamente. Recordar el objetivo y el porqué del trimestre suele ayudar a recolocar la brújula.' });
  }
  // Buen momento (energía y ánimo altos y el ánimo no baja).
  if ((latest.means?.energia ?? 0) >= 60 && (latest.means?.animo ?? 0) >= 60 && netTrend(animo).dir !== 'down') {
    signals.push({ key: 'buen-momento', level: 'good', text: 'El equipo navega con viento a favor. Buen momento para consolidar hábitos y reconocer lo que está funcionando.' });
  }
  // Participación baja (menos del 40% de las personas han respondido).
  if (latest.totalPeople && latest.respondents / latest.totalPeople < 0.4) {
    signals.push({ key: 'participacion-baja', level: 'info', text: 'Esta semana han respondido pocas personas: la señal es menos representativa. Recordar la marea (sin presionar) da una foto más fiel.' });
  }

  return signals.sort((s1, s2) => LEVEL_ORDER[s1.level] - LEVEL_ORDER[s2.level]);
}
