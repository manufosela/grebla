/**
 * Mapa del equipo (GREBLA §13): por cada persona activa, su estado ACTUAL en las
 * cuatro dimensiones. Es la "foto del sistema" privada de quien lidera — lectura,
 * no ranking (R3). Reúne la última lectura de seniority, emocional y contribución,
 * y la última por área en conocimiento (con su perfil I/T/π/Comb).
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 */
import { listActivePeople } from './people.js';
import { knowledgeProfileFromAreas } from '../../domain/services/knowledgeProfile.js';

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Array<object>>}
 */
export async function getTeamMap(persistence) {
  const people = await listActivePeople(persistence);
  const rows = [];
  for (const person of people) {
    const [seniority, emotional, contribution, knowledge] = await Promise.all([
      persistence.readings.seniority.latest(person.id),
      persistence.readings.emotional.latest(person.id),
      persistence.readings.contribution.latest(person.id),
      persistence.readings.knowledge.listByPerson(person.id),
    ]);

    // Conocimiento: última lectura por área (asc → la última gana).
    const latestByArea = new Map();
    for (const r of knowledge) latestByArea.set(r.areaId, r);
    const areas = [...latestByArea.entries()].map(([areaId, r]) => ({
      areaId,
      level: r.level,
      toNext: r.toNext ?? false,
    }));

    rows.push({
      id: person.id,
      name: person.name,
      guilds: person.guilds ?? [],
      // Carrera (RMR-TSK-0506): el nivel y si es externa, para resumir en el
      // Mapa cómo va frente a las expectativas de su nivel. La valoración en sí
      // no se lee aquí: vive en su propio subárbol, fuera de este puerto.
      levelId: person.levelId ?? null,
      external: person.external === true,
      seniority: seniority ? { level: seniority.level, toNext: seniority.toNext ?? false } : null,
      emotional: emotional ? { level: emotional.level, toNext: emotional.toNext ?? false } : null,
      knowledge: { areas, profile: knowledgeProfileFromAreas(areas) },
      contribution: contribution?.roles ?? null,
    });
  }
  return rows;
}
