/**
 * El resumen del mapa de carrera de una persona (RMR-TSK-0735): lo que ella ve
 * en Mi espacio y su manager en la ficha. Solo lectura; nadie ve JUGAR a otro.
 * Función PURA.
 */

/**
 * @param {{ areas?: Array<{ id: string, name: string }>, cities: Array<{ id: string, name: string, area?: string }> }|null} island
 * @param {{ currentCity?: string|null, visitedCities?: string[], plannedRoute?: string[] }|null} journey
 * @returns {null|{ current: object|null, visitedCount: number, dominatedByArea: Array<{ area: object, cities: object[] }>, route: string[] }}
 */
export function mapSummary(island, journey) {
  const visited = journey?.visitedCities ?? [];
  const planned = journey?.plannedRoute ?? [];
  if (!island || !journey || (!journey.currentCity && visited.length === 0 && planned.length === 0)) return null;
  const cityById = new Map(island.cities.map((c) => [c.id, c]));
  // Ciudades dominadas agrupadas por comarca (solo comarcas con visitadas).
  const dominatedByArea = (island.areas ?? [])
    .map((area) => ({ area, cities: visited.map((id) => cityById.get(id)).filter((c) => c?.area === area.id) }))
    .filter((group) => group.cities.length > 0);
  return {
    current: journey.currentCity ? (cityById.get(journey.currentCity) ?? null) : null,
    visitedCount: visited.length,
    dominatedByArea,
    route: planned.map((id) => cityById.get(id)?.name ?? id),
  };
}
