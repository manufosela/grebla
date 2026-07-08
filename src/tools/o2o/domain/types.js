/**
 * Tipos del dominio de la herramienta O2O (One-to-Ones). JSDoc puro, sin
 * dependencias de Firebase.
 *
 * FASE 1: solo Guía y Formulario previo (plantillas de catálogo, versionadas).
 * Las sesiones, acciones y evolución llegan en fases siguientes.
 *
 * @typedef {Object} GuideQuestion
 * @property {string} id    Id estable de la pregunta (para editar/reordenar).
 * @property {string} text  Texto de la pregunta.
 *
 * @typedef {Object} GuideBlock
 * @property {string} id
 * @property {string} title           Título del bloque (p. ej. «Cómo trabajan hoy»).
 * @property {string} [intro]         Texto introductorio del bloque (opcional).
 * @property {GuideQuestion[]} questions
 *
 * @typedef {Object} O2OGuide   Plantilla de temas/preguntas de un O2O.
 * @property {string} id
 * @property {number} version         Versión de la guía (se incrementa al guardar).
 * @property {string} [updatedAt]     ISO de la última edición.
 * @property {GuideBlock[]} blocks
 *
 * @typedef {Object} FormQuestion
 * @property {string} id
 * @property {string} text
 *
 * @typedef {Object} FormSection
 * @property {string} id
 * @property {string} title
 * @property {FormQuestion[]} questions
 *
 * @typedef {Object} PreO2OForm   Formulario previo (temas para pensar, no rellenar).
 * @property {string} id
 * @property {number} version
 * @property {string} [updatedAt]
 * @property {string} intro           Mensaje de cabecera del formulario.
 * @property {FormSection[]} sections
 *
 * @typedef {Object} O2OPeriod   Campaña de O2O (p. ej. «Periodo Julio 2026»). Vive
 *   bajo el líder (/leaders/{uid}/o2oPeriods) con su PROPIA guía y formulario
 *   EMBEBIDOS (editables por periodo). Las sesiones/acciones se ligan por periodId.
 * @property {string} id
 * @property {string} name            Nombre («Periodo Julio 2026»), editable.
 * @property {'open'|'closed'} [status]
 * @property {O2OGuide} guide         Guía propia del periodo (editable).
 * @property {PreO2OForm} form        Formulario previo propio del periodo (editable).
 * @property {string} createdAt       ISO de creación.
 * @property {string} [updatedAt]     ISO de la última edición.
 */

/**
 * Registro de una sesión de O2O. Vive bajo el LÍDER (/leaders/{uid}/o2o), no bajo
 * la persona: `transcript`, `privateNotes`, `answers` y `summary` son PRIVADOS del
 * líder y el ingeniero no tiene ruta de lectura. Lo único que puede llegar a la
 * persona es `sharedSummary` (si `sharedWithPerson`), servido por Cloud Function.
 *
 * @typedef {Object} SessionAnswer
 * @property {string} questionId  Id de la pregunta de la guía respondida.
 * @property {string} answer      Respuesta/nota (texto libre).
 *
 * @typedef {Object} O2OSession
 * @property {string} id
 * @property {string} [periodId]      Periodo de O2O al que pertenece.
 * @property {string} personId        Persona con la que fue el O2O.
 * @property {string} date            Fecha del O2O (ISO).
 * @property {number} [guideVersion]  Versión de la guía usada al registrarlo.
 * @property {string} [transcript]    PRIVADO — transcripción en bruto (opcional).
 * @property {string} [privateNotes]  PRIVADO — notas del líder.
 * @property {SessionAnswer[]} [answers]  PRIVADO — respuestas a la guía.
 * @property {string} [summary]       PRIVADO — resumen del líder.
 * @property {string} [sharedSummary] Lo que se comparte con la persona.
 * @property {boolean} [sharedWithPerson]  Si el resumen compartido es visible para la persona.
 * @property {string} createdAt       ISO de creación.
 * @property {string} [updatedAt]     ISO de la última edición.
 * @property {{ uid: string, name: string }} [createdBy]  Autor (del login).
 */

/**
 * Acción/compromiso derivado de un O2O. Vive bajo la PERSONA
 * (/people/{personId}/o2oActions) para que el ingeniero pueda verla en su
 * espacio (hereda las reglas de la persona). No lleva datos sensibles del líder.
 *
 * @typedef {'person'|'leader'} ActionOwner  Responsable de la acción.
 * @typedef {'open'|'done'} ActionStatus
 *
 * @typedef {Object} O2OAction
 * @property {string} id
 * @property {string} [periodId]        Periodo de O2O del que salió.
 * @property {string} description       Qué hay que hacer.
 * @property {ActionOwner} owner        Responsable (la persona o el líder).
 * @property {ActionStatus} status      Abierta o hecha.
 * @property {string|null} [originSessionId]  Sesión de la que salió (o null).
 * @property {string} [dueDate]         Fecha objetivo (ISO, opcional).
 * @property {string} createdAt         ISO de creación.
 * @property {string|null} [doneAt]     ISO de cierre (o null si abierta).
 */

/** Ids de los documentos por defecto (sembrados). */
export const DEFAULT_GUIDE_ID = 'o2o-default';
export const DEFAULT_FORM_ID = 'preo2o-default';
