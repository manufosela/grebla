/**
 * Qué ve la PERSONA del O2O que viene (RMR-TSK-0512).
 *
 * El periodo de O2O vive bajo el líder (/leaders/{uid}/o2oPeriods) y lleva
 * DENTRO DEL MISMO DOCUMENTO dos cosas de dueños distintos:
 *   - `form`  — el formulario previo: temas para que la persona PIENSE antes;
 *   - `guide` — la guía del manager: las preguntas que usará él DURANTE.
 *
 * Por eso la proyección es explícita campo a campo y no un `...period`: la guía
 * es suya y no tiene ruta de lectura para nadie más. Las reglas de Firestore
 * deniegan el periodo a la persona (solo el líder dueño y el superadmin), así
 * que esto solo puede salir por la Cloud Function, con el Admin SDK, y este
 * módulo es el único sitio donde se decide qué sale.
 *
 * Módulo PURO, sin Firebase: se puede probar y leer entero de un vistazo.
 */

/** @param {unknown} v @returns {string} */
const texto = (v) => String(v ?? '').trim();

/**
 * Secciones con al menos una pregunta de verdad. Una sección vacía o una
 * pregunta en blanco no son «algo en lo que pensar»: prometerían contenido que
 * no existe.
 * @param {Array<{id?: string, title?: string, questions?: Array<{id?: string, text?: string}>}>|null|undefined} sections
 */
function seccionesConPreguntas(sections) {
  return (Array.isArray(sections) ? sections : [])
    .map((s) => ({
      id: texto(s?.id),
      title: texto(s?.title),
      questions: (Array.isArray(s?.questions) ? s.questions : [])
        .map((q) => ({ id: texto(q?.id), text: texto(q?.text) }))
        .filter((q) => q.text !== ''),
    }))
    .filter((s) => s.questions.length > 0);
}

/**
 * El O2O que viene, proyectado para la persona: nombre del periodo y formulario
 * previo. Nada más.
 *
 * CUÁL ES «EL QUE VIENE»: hoy un periodo se crea abierto y no hay forma de
 * cerrarlo, así que filtrar por estado devolvería todos. Se toma el MÁS
 * RECIENTE por fecha de creación — crear un periodo nuevo sustituye al anterior
 * a ojos de la persona.
 *
 * @param {string} leaderUid
 * @param {Array<object>|null|undefined} periods  periodos del líder, tal cual vienen de Firestore
 * @returns {{ periodId: string, leaderUid: string, name: string, form: { intro: string, sections: Array<object> } }|null}
 */
export function upcomingFrom(leaderUid, periods) {
  const lista = Array.isArray(periods) ? periods : [];
  if (lista.length === 0) return null;

  // El más reciente. Un periodo sin fecha no gana por accidente: sin dato, va al
  // final (cadena vacía ordena por debajo de cualquier ISO).
  const reciente = lista.toSorted((a, b) => texto(b?.createdAt).localeCompare(texto(a?.createdAt))).at(0);

  const sections = seccionesConPreguntas(reciente?.form?.sections);
  // Sin preguntas no hay nada que enseñar: un periodo recién creado está en
  // blanco, y anunciarlo sería prometer una preparación que aún no existe.
  if (sections.length === 0) return null;

  return {
    periodId: texto(reciente.id),
    leaderUid,
    name: texto(reciente.name),
    form: { intro: texto(reciente?.form?.intro), sections },
  };
}
