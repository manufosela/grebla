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

/** Ids de los documentos por defecto (sembrados). */
export const DEFAULT_GUIDE_ID = 'o2o-default';
export const DEFAULT_FORM_ID = 'preo2o-default';
