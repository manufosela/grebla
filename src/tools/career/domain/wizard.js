/**
 * El BRUJO de la isla (MC-22): lógica PURA de las consultas asíncronas al
 * líder. En cada isla hay una cabaña del brujo donde el jugador deja preguntas
 * sobre los temas de la isla; llegan a la cola del líder, que responde (o
 * registra que la respondió otro developer vía `creditedTo` — la derivación v1
 * es informativa: el líder recoge la respuesta del compañero; simplificación
 * documentada en el ADR de progresión). Todo queda en la ficha del jugador.
 *
 * Persistencia: /people/{personId}/career/wizard/questions/{questionId}.
 * OJO — el diseño original decía /people/{p}/career/questions/{qId}, pero ese
 * path tiene 5 segmentos (colección, no documento) y en Firestore no puede
 * alojar docs: se añade el doc-fantasma `wizard` para mantener las preguntas
 * dentro del subárbol career de la persona.
 *
 * Estados de una consulta (y del indicador de la cabaña):
 *  - 'pending'  → esperando respuesta del líder (farol ÁMBAR pulsante).
 *  - 'answered' → el líder respondió; el jugador aún no la vio (farol TEAL).
 *  - 'seen'     → el jugador la marcó como vista (la cabaña vuelve a reposo).
 *
 * @typedef {'pending'|'answered'|'seen'} QuestionStatus
 *
 * Autor de una consulta o de una respuesta (del login, como en las notas del
 * tool Equipo); ausente en registros sin autoría.
 * @typedef {{ uid: string, name: string }} QuestionAuthor
 *
 * @typedef {Object} WizardQuestion
 * @property {string} id                    Id del documento.
 * @property {string} islandId              Isla cuyo brujo recibió la consulta.
 * @property {string} islandName            Nombre de la isla (denormalizado para listados).
 * @property {string} text                  La consulta del jugador.
 * @property {QuestionStatus} status
 * @property {string} createdAt             ISO 8601 del momento de la consulta.
 * @property {QuestionAuthor} [createdBy]   Quién la dejó (login).
 * @property {string} [answer]              Respuesta del líder (status 'answered'/'seen').
 * @property {string} [answeredAt]          ISO 8601 de la respuesta.
 * @property {QuestionAuthor} [answeredBy]  Quién respondió (login del líder).
 * @property {string} [creditedTo]          Developer que ayudó, si el líder derivó la duda.
 * @property {string} [seenAt]              ISO 8601 de «vista» por el jugador.
 */

/** Estados válidos de una consulta al brujo. @type {ReadonlyArray<QuestionStatus>} */
export const QUESTION_STATUSES = Object.freeze(['pending', 'answered', 'seen']);

/** Estados visuales de la cabaña del brujo. @typedef {'none'|'pending'|'ready'} WizardHutState */

/** @param {unknown} value @returns {string} */
function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Sanea un autor crudo a QuestionAuthor, o undefined si no tiene la forma
 * (uid y name no vacíos): sin autoría antes que autoría corrupta.
 * @param {unknown} raw
 * @returns {QuestionAuthor|undefined}
 */
function normalizeAuthor(raw) {
  if (raw === null || typeof raw !== 'object') return undefined;
  const uid = cleanString(/** @type {{uid?: unknown}} */ (raw).uid);
  const name = cleanString(/** @type {{name?: unknown}} */ (raw).name);
  return uid && name ? { uid, name } : undefined;
}

/**
 * Normaliza una consulta persistida al modelo actual (migración suave, como
 * normalizeJourney): strings saneados y estado validado. Un estado desconocido
 * se degrada de forma VISIBLE y segura: con respuesta pasa a 'answered' (el
 * jugador la ve) y sin ella a 'pending' (el líder la ve en su cola) — nunca se
 * pierde una consulta en silencio.
 * @param {Record<string, unknown> & { id?: unknown }} raw
 * @returns {WizardQuestion}
 */
export function normalizeQuestion(raw) {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('normalizeQuestion requiere un objeto de consulta.');
  }
  const id = cleanString(raw.id);
  if (!id) throw new Error('normalizeQuestion: la consulta no tiene id.');
  const answer = cleanString(raw.answer);
  const status = QUESTION_STATUSES.includes(/** @type {QuestionStatus} */ (raw.status))
    ? /** @type {QuestionStatus} */ (raw.status)
    : answer
      ? 'answered'
      : 'pending';
  /** @type {WizardQuestion} */
  const question = {
    id,
    islandId: cleanString(raw.islandId),
    islandName: cleanString(raw.islandName),
    text: cleanString(raw.text),
    status,
    createdAt: cleanString(raw.createdAt),
  };
  const createdBy = normalizeAuthor(raw.createdBy);
  if (createdBy) question.createdBy = createdBy;
  if (answer) question.answer = answer;
  const answeredAt = cleanString(raw.answeredAt);
  if (answeredAt) question.answeredAt = answeredAt;
  const answeredBy = normalizeAuthor(raw.answeredBy);
  if (answeredBy) question.answeredBy = answeredBy;
  const creditedTo = cleanString(raw.creditedTo);
  if (creditedTo) question.creditedTo = creditedTo;
  const seenAt = cleanString(raw.seenAt);
  if (seenAt) question.seenAt = seenAt;
  return question;
}

/**
 * Consultas ordenadas por fecha DESCENDENTE (la más reciente primero: el
 * orden de los listados del jugador). ISO 8601 ordena lexicográficamente;
 * las fechas vacías/corruptas van al final (deterministas, no se pierden).
 * @param {ReadonlyArray<WizardQuestion>} questions
 * @returns {WizardQuestion[]}
 */
export function sortQuestionsByDateDesc(questions) {
  return (questions ?? []).toSorted((a, b) => {
    if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/**
 * Consultas PENDIENTES en orden de llegada (ascendente): la cola del líder es
 * FIFO — la duda más antigua se atiende primero.
 * @param {ReadonlyArray<WizardQuestion>} questions
 * @returns {WizardQuestion[]}
 */
export function pendingQuestions(questions) {
  return sortQuestionsByDateDesc(questions)
    .toReversed()
    .filter((q) => q.status === 'pending');
}

/**
 * Estado visual de la cabaña del brujo a partir de las consultas de SU isla.
 * Prioridad: answered > pending > none — el jugador ve ANTES que tiene una
 * respuesta lista que el recordatorio de lo que dejó pendiente.
 * @param {ReadonlyArray<WizardQuestion>} questions
 * @returns {WizardHutState}
 */
export function wizardState(questions) {
  const list = questions ?? [];
  if (list.some((q) => q.status === 'answered')) return 'ready';
  if (list.some((q) => q.status === 'pending')) return 'pending';
  return 'none';
}
