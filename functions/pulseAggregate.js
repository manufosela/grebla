/**
 * Agregado ANÓNIMO de Marea (RMR-TSK-0236). Puro (sin firebase): recibe las
 * entradas de una semana y el mapa uid→persona (gremios/labels son NOMBRES), y
 * devuelve las medias por dimensión para toda ingeniería, por gremio y por label
 * (squad). Nunca expone datos individuales: solo medias y recuentos, y solo de
 * grupos con al menos `minCount` respuestas (por defecto 3).
 *
 * Se cuenta UNA marea por persona y semana: la ÚLTIMA que registró (por `day`),
 * de modo que el recuento = personas que han respondido, no nº de registros.
 */

/** Dimensiones que se promedian. */
export const PULSE_DIMS = ['energia', 'animo', 'carga', 'rumbo', 'tripulacion', 'reconocimiento'];

const emptyAcc = () => ({ count: 0, sums: Object.fromEntries(PULSE_DIMS.map((d) => [d, 0])) });

function addToAcc(acc, entry) {
  acc.count += 1;
  for (const d of PULSE_DIMS) acc.sums[d] += Number(entry[d]) || 0;
}

/** Medias redondeadas de un acumulador (o null si no hay datos). */
function meansOf(acc) {
  if (!acc.count) return null;
  return Object.fromEntries(PULSE_DIMS.map((d) => [d, Math.round(acc.sums[d] / acc.count)]));
}

/** Deja una entrada por uid: la de `day` más reciente (YYYY-MM-DD ordena lexicográficamente). */
function latestPerPerson(entries) {
  const byUid = new Map();
  for (const e of entries) {
    if (!e || !e.uid) continue;
    const prev = byUid.get(e.uid);
    if (!prev || String(e.day) > String(prev.day)) byUid.set(e.uid, e);
  }
  return [...byUid.values()];
}

/**
 * @param {string} weekIso
 * @param {Array<Record<string, any>>} entries  entradas de la semana (crudas)
 * @param {Record<string, { guilds?: string[], labels?: string[] }>} peopleByUid
 * @param {{ minCount?: number, totalPeople?: number }} [opts]
 * @returns {object} documento de agregado
 */
export function computePulseAggregate(weekIso, entries, peopleByUid = {}, opts = {}) {
  const minCount = opts.minCount ?? 3;
  const people = latestPerPerson(entries);

  const general = emptyAcc();
  /** @type {Map<string, ReturnType<typeof emptyAcc>>} */
  const guilds = new Map();
  const labels = new Map();

  const bump = (map, name, entry) => {
    if (!map.has(name)) map.set(name, emptyAcc());
    addToAcc(map.get(name), entry);
  };

  for (const entry of people) {
    addToAcc(general, entry);
    const person = peopleByUid[entry.uid] || {};
    for (const g of person.guilds || []) if (g) bump(guilds, g, entry);
    for (const l of person.labels || []) if (l) bump(labels, l, entry);
  }

  // Solo grupos con suficientes respuestas (privacidad), ordenados por nombre.
  const groups = (map) => [...map.entries()]
    .filter(([, acc]) => acc.count >= minCount)
    .map(([id, acc]) => ({ id, count: acc.count, means: meansOf(acc) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    weekIso,
    minCount,
    respondents: general.count,
    totalPeople: opts.totalPeople ?? null,
    general: general.count >= minCount
      ? { count: general.count, means: meansOf(general) }
      : { count: general.count, means: null },
    guilds: groups(guilds),
    labels: groups(labels),
  };
}
