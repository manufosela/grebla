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

/** Máximo de palabras distintas por nube (las más frecuentes). */
const MAX_WORDS = 40;

const emptyAcc = () => ({ count: 0, sums: Object.fromEntries(PULSE_DIMS.map((d) => [d, 0])), words: new Map() });

/** Normaliza una palabra para la nube: minúsculas, sin espacios sobrantes. */
export function normalizeWord(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function addToAcc(acc, entry) {
  acc.count += 1;
  for (const d of PULSE_DIMS) acc.sums[d] += Number(entry[d]) || 0;
  // Solo cuenta la palabra si la persona hizo opt-in explícito (shareWord).
  if (entry.shareWord === true) {
    const word = normalizeWord(entry.palabra);
    if (word) acc.words.set(word, (acc.words.get(word) ?? 0) + 1);
  }
}

/** Medias redondeadas de un acumulador (o null si no hay datos). */
function meansOf(acc) {
  if (!acc.count) return null;
  return Object.fromEntries(PULSE_DIMS.map((d) => [d, Math.round(acc.sums[d] / acc.count)]));
}

/** Nube de palabras de un acumulador: [{text, count}] por frecuencia (top MAX_WORDS). */
function wordsOf(acc) {
  return [...acc.words.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, MAX_WORDS);
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
 * Departamento de un manager: el Head del que cuelga, subiendo por `reportsTo`
 * hasta dar con alguien que tenga el rol de Head (RMR-TSK-0296). Si el propio
 * manager es Head, ese es su departamento. Devuelve null si no cuelga de
 * ninguno. Lleva registro de visitados para terminar ante un ciclo en los datos.
 * @param {string|null} leaderUid
 * @param {Record<string, string|null>} reportsToByUid
 * @param {Set<string>} headUids
 * @returns {string|null}
 */
export function departmentOf(leaderUid, reportsToByUid, headUids) {
  let current = leaderUid;
  const seen = new Set();
  while (current && !seen.has(current)) {
    if (headUids.has(current)) return current;
    seen.add(current);
    current = reportsToByUid[current] ?? null;
  }
  return null;
}

/**
 * @param {string} weekIso
 * @param {Array<Record<string, any>>} entries  entradas de la semana (crudas)
 * @param {Record<string, { guilds?: string[], labels?: string[], department?: string|null }>} peopleByUid
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
  // Corte por departamento (RMR-TSK-0296). Es el primer eje de la marea que
  // sigue la línea de mando —gremio y squad son transversales a propósito—, así
  // que se apoya en el MISMO umbral que los demás: un departamento por debajo
  // del mínimo no se publica, porque sería mirar a personas concretas.
  const departments = new Map();

  const bump = (map, name, entry) => {
    if (!map.has(name)) map.set(name, emptyAcc());
    addToAcc(map.get(name), entry);
  };

  for (const entry of people) {
    addToAcc(general, entry);
    const person = peopleByUid[entry.uid] || {};
    for (const g of person.guilds || []) if (g) bump(guilds, g, entry);
    for (const l of person.labels || []) if (l) bump(labels, l, entry);
    if (person.department) bump(departments, person.department, entry);
  }

  // Solo grupos con suficientes respuestas (privacidad), ordenados por nombre.
  // La nube de palabras va con cada grupo que supera el umbral: al gatearse por
  // el mismo `count >= minCount`, nunca se expone la palabra de un grupo pequeño.
  const groups = (map) => [...map.entries()]
    .filter(([, acc]) => acc.count >= minCount)
    .map(([id, acc]) => ({ id, count: acc.count, means: meansOf(acc), words: wordsOf(acc) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    weekIso,
    minCount,
    respondents: general.count,
    totalPeople: opts.totalPeople ?? null,
    general: general.count >= minCount
      ? { count: general.count, means: meansOf(general), words: wordsOf(general) }
      : { count: general.count, means: null, words: [] },
    guilds: groups(guilds),
    labels: groups(labels),
    departments: groups(departments),
  };
}
