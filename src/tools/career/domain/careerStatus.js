/**
 * Estado de carrera de una persona, resumido para el Mapa del equipo
 * (RMR-TSK-0506): su nivel y cómo va frente a las expectativas de ese nivel.
 *
 * La ficha ya muestra esto dimensión a dimensión; aquí se reduce a una línea
 * para que quepa en la foto del equipo, junto a las cuatro dimensiones de
 * GREBLA. Las dos familias se miran juntas o no se miran.
 *
 * Lee LO MISMO que la ficha (RMR-TSK-0731): el historial de expectativas
 * (careerEvidence) y el subnivel efectivo. El nivel actual cumple por defecto
 * y cada «no llega» lo pone una entrada del historial.
 *
 * Función PURA: no toca Firebase.
 *
 * @typedef {import('../data/framework.js').CareerFramework} CareerFramework
 *
 * @typedef {Object} CareerStatus
 * @property {'external'|'no-level'|'unknown-level'|'no-expectations'|'meets'|'gaps'} kind
 * @property {string} levelName  nombre del nivel ('' si no hay ninguno)
 * @property {number} reds       expectativas que no llega (0 si no aplica)
 * @property {number} total      expectativas valorables del nivel (0 si no aplica)
 */
import { getLevel, expectationsForLevel } from '../data/framework.js';
import { expectationState } from './evidence.js';

/**
 * Nombre visible de un nivel: código y título, como en la ficha de la persona.
 * @param {{ code?: string, title?: string }} level
 * @returns {string}
 */
function levelTitle(level) {
  const code = String(level?.code ?? '').trim();
  const title = String(level?.title ?? '').trim();
  if (code && title) return `${code} · ${title}`;
  return code || title;
}

/**
 * @param {CareerFramework|null|undefined} framework
 * @param {{ levelId?: string|null, external?: boolean }|null|undefined} person
 * @param {Array<object>|null|undefined} entries  su historial de expectativas
 * @param {{ label?: string }|null} [subLevel]  el subnivel efectivo («L2-3»), si lo hay
 * @returns {CareerStatus}
 */
export function careerStatus(framework, person, entries, subLevel = null) {
  const base = { levelName: '', reds: 0, total: 0 };
  // Los externos se clasifican por nivel para saber la composición del equipo,
  // pero no tienen plan de carrera: valorarles expectativas no significa nada.
  if (person?.external) return { ...base, kind: 'external' };

  const levelId = person?.levelId ?? '';
  if (!levelId) return { ...base, kind: 'no-level' };

  const level = getLevel(framework, levelId);
  // Nivel que el framework ya no conoce (se renombró o se borró): decirlo, no
  // presentarlo como «sin nivel», que es un caso distinto y se arregla distinto.
  if (!level) return { ...base, kind: 'unknown-level', levelName: levelId };

  // El nivel se nombra como en la ficha: «L2 · Senior Engineer». El código solo
  // no dice nada a quien no se lo sabe, y el título solo se repite entre tracks.
  // Con subnivel, como la cabecera de la ficha: «L2-3 · Senior Engineer».
  const levelName = levelTitle(subLevel?.label ? { ...level, code: subLevel.label } : level);
  // Solo cuentan las dimensiones con expectativa ESCRITA para ese nivel: una
  // celda vacía del framework no es algo que la persona cumpla o deje de
  // cumplir, y meterla en el total diluiría los rojos («1 de 7» cuando solo 3
  // están definidas dice menos de lo que parece).
  const rows = expectationsForLevel(framework, levelId).filter((row) => row.text);
  if (rows.length === 0) return { ...base, kind: 'no-expectations', levelName };

  // El estado de cada expectativa sale de su historial, como en la ficha: el
  // nivel actual cumple mientras nadie diga lo contrario (RMR-TSK-0731).
  const reds = rows.filter((row) => expectationState(entries ?? [], levelId, row.dimension.id, 'meets') === 'misses').length;
  return {
    kind: reds === 0 ? 'meets' : 'gaps',
    levelName,
    reds,
    total: rows.length,
  };
}
