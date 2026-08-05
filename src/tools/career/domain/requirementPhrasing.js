/**
 * Redacción de REQUISITOS a partir de expectativas (RMR-TSK-0417, JD 1.3.0).
 *
 * Las expectativas del framework describen la conducta de quien YA está en el
 * nivel («Empieza a moldear cómo construye el equipo»); una oferta pide
 * capacidades concretas («Capacidad para moldear cómo construye el equipo»).
 * Transformación DETERMINISTA y testeable (sin IA): cada frase se vuelve un
 * ítem — se quitan los abridores aspectuales/futuribles (Empieza a, Puede,
 * Sabe, Va dominando…) y el verbo inicial en 3ª persona pasa a infinitivo con
 * un diccionario acotado (los verbos del seed + comunes). Una frase que no
 * empieza por verbo reconocido se CONSERVA tal cual: visible y honesta, nunca
 * inventada ni descartada.
 */

/** 3ª persona del singular → infinitivo (verbos vistos en los frameworks). */
const VERB_TO_INFINITIVE = Object.freeze({
  absorbe: 'absorber', acompaña: 'acompañar', actúa: 'actuar', alinea: 'alinear',
  aplica: 'aplicar', aporta: 'aportar', aprende: 'aprender', aprovecha: 'aprovechar',
  articula: 'articular', asume: 'asumir', automatiza: 'automatizar', avisa: 'avisar',
  borra: 'borrar', busca: 'buscar', caza: 'cazar', celebra: 'celebrar',
  colabora: 'colaborar', comparte: 'compartir', comunica: 'comunicar',
  considera: 'considerar', construye: 'construir', contribuye: 'contribuir',
  convierte: 'convertir', crea: 'crear', cuantifica: 'cuantificar', cultiva: 'cultivar',
  cumple: 'cumplir', da: 'dar', decide: 'decidir', define: 'definir', delega: 'delegar',
  desarrolla: 'desarrollar', descompone: 'descomponer', detecta: 'detectar',
  diagnostica: 'diagnosticar', dirige: 'dirigir', documenta: 'documentar',
  domina: 'dominar', eleva: 'elevar', elige: 'elegir', enseña: 'enseñar',
  entiende: 'entender', entra: 'entrar', entrega: 'entregar', equilibra: 'equilibrar',
  es: 'ser', escala: 'escalar', escribe: 'escribir', escucha: 'escuchar',
  establece: 'establecer', evita: 'evitar', exige: 'exigir', extiende: 'extender',
  fija: 'fijar', forma: 'formar', garantiza: 'garantizar', genera: 'generar',
  gestiona: 'gestionar', guía: 'guiar', hace: 'hacer', identifica: 'identificar',
  impulsa: 'impulsar', influye: 'influir', incorpora: 'incorporar', integra: 'integrar',
  interviene: 'intervenir', lidera: 'liderar', mantiene: 'mantener', marca: 'marcar',
  mejora: 'mejorar', mentoriza: 'mentorizar', mide: 'medir', modela: 'modelar',
  moldea: 'moldear', monitoriza: 'monitorizar', multiplica: 'multiplicar',
  negocia: 'negociar', observa: 'observar', opera: 'operar', optimiza: 'optimizar',
  participa: 'participar', parte: 'partir', pide: 'pedir', piensa: 'pensar',
  plantea: 'plantear', posee: 'poseer', pregunta: 'preguntar', presenta: 'presentar',
  previene: 'prevenir', prioriza: 'priorizar', produce: 'producir', propone: 'proponer',
  protege: 'proteger', prueba: 'probar', recibe: 'recibir', reconoce: 'reconocer',
  reduce: 'reducir', refuerza: 'reforzar', representa: 'representar',
  responde: 'responder', resuelve: 'resolver', reta: 'retar', revisa: 'revisar',
  señala: 'señalar', sirve: 'servir', sostiene: 'sostener', sube: 'subir',
  tiene: 'tener', toma: 'tomar', trabaja: 'trabajar', traduce: 'traducir',
  usa: 'usar', valida: 'validar', verifica: 'verificar', vive: 'vivir',
});

/** Abridores aspectuales/futuribles: se quitan y lo que sigue manda. */
const ASPECTUAL_OPENERS = /^(?:empieza(?:\s+también)?\s+a|está\s+empezando\s+a|comienza\s+a|puede|sabe|suele)\s+/iu;

/** Gerundios irregulares para el patrón «Va + gerundio». */
const GERUND_TO_INFINITIVE = Object.freeze({
  dominando: 'dominar', aprendiendo: 'aprender', construyendo: 'construir',
  escribiendo: 'escribir', pidiendo: 'pedir', viviendo: 'vivir',
});

/**
 * Trocea un texto en frases: punto seguido de mayúscula (no parte «p. ej.» ni
 * abreviaturas en minúscula) y limpia el punto final.
 * @param {string} text @returns {string[]}
 */
export function splitSentences(text) {
  return String(text ?? '')
    .split(/\.\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/u)
    .map((s) => s.trim().replace(/\.+$/u, '').trim())
    .filter(Boolean);
}

/**
 * Frase → cláusula en infinitivo («moldear cómo construye el equipo…»), o
 * null si el arranque no es un verbo reconocido.
 * @param {string} sentence @returns {string|null}
 */
function toInfinitiveClause(sentence) {
  let rest = sentence.trim();
  const opened = ASPECTUAL_OPENERS.test(rest);
  rest = rest.replace(ASPECTUAL_OPENERS, '');
  const [first, ...tail] = rest.split(/\s+/u);
  if (!first) return null;
  const lower = first.toLocaleLowerCase('es');
  // «Va dominando…» → dominar (gerundios: -ando → -ar; irregulares por tabla).
  if (lower === 'va' && tail[0]) {
    const gerund = tail[0].toLocaleLowerCase('es');
    const inf = GERUND_TO_INFINITIVE[gerund] ?? (gerund.endsWith('ando') ? `${gerund.slice(0, -4)}ar` : null);
    if (inf) return [inf, ...tail.slice(1)].join(' ');
  }
  // Tras un abridor («Puede investigar») lo que sigue ya es infinitivo.
  if (opened && /(?:ar|er|ir)$/u.test(lower)) return [lower, ...tail].join(' ');
  const infinitive = VERB_TO_INFINITIVE[lower];
  if (!infinitive) return null;
  return [infinitive, ...tail].join(' ');
}

/**
 * Ítems de REQUISITO: cada frase → «Capacidad para <infinitivo…>»; las frases
 * sin verbo reconocido se conservan tal cual.
 * @param {string} text @returns {string[]}
 */
export function toCapabilityItems(text) {
  return splitSentences(text).map((sentence) => {
    const clause = toInfinitiveClause(sentence);
    return clause ? `Capacidad para ${clause}` : sentence;
  });
}

/**
 * Ítems de RESPONSABILIDAD: cada frase → infinitivo capitalizado («Tomar
 * decisiones…»); las frases sin verbo reconocido se conservan tal cual.
 * @param {string} text @returns {string[]}
 */
export function toResponsibilityItems(text) {
  return splitSentences(text).map((sentence) => {
    const clause = toInfinitiveClause(sentence);
    if (!clause) return sentence;
    return clause.charAt(0).toLocaleUpperCase('es') + clause.slice(1);
  });
}
