/**
 * Guía por defecto del O2O (contenido inicial versionado). Se siembra en
 * /o2oGuides/o2o-default y el líder la edita/versiona desde la herramienta.
 *
 * @typedef {import('../domain/types.js').O2OGuide} O2OGuide
 */
import { DEFAULT_GUIDE_ID } from '../domain/types.js';

/** @param {string} blockId @param {string[]} texts */
const qs = (blockId, texts) => texts.map((text, i) => ({ id: `${blockId}-q${i + 1}`, text }));

/** @type {O2OGuide} */
export const DEFAULT_GUIDE = {
  id: DEFAULT_GUIDE_ID,
  version: 1,
  blocks: [
    {
      id: 'apertura',
      title: 'Apertura',
      intro:
        'Propósito: conocerse, entender el día a día, detectar puntos de dolor. Bidireccional, no evaluativo. El 360 es input, no juicio.',
      questions: [],
    },
    {
      id: 'b1',
      title: 'Bloque 1: Cómo trabajan hoy',
      questions: qs('b1', [
        '¿Cómo es un día normal? ¿En qué se va el tiempo realmente?',
        '¿Qué parte del trabajo da más energía y cuál la quita?',
        '¿Dónde hay fricción recurrente (procesos, herramientas, dependencias)?',
        '¿Qué bloquea o ralentiza más a menudo?',
      ]),
    },
    {
      id: 'b2',
      title: 'Bloque 2: Puntos de dolor y mejora',
      questions: qs('b2', [
        'Si pudieras cambiar una cosa del equipo mañana, ¿cuál sería?',
        '¿Qué echas de menos de un equipo anterior o de otra forma de trabajar?',
        '¿Qué hacemos bien y deberíamos proteger?',
      ]),
    },
    {
      id: 'b3',
      title: 'Bloque 3: Objetivos y desarrollo',
      questions: qs('b3', [
        '¿Dónde te gustaría estar dentro de 1-2 años? ¿Qué quieres aprender?',
        '¿Qué apoyo esperas de un manager?',
      ]),
    },
    {
      id: 'b4',
      title: 'Bloque 4: Temas concretos a calibrar',
      questions: qs('b4', [
        'Reparto de tiempo entre revisión de PRs, dailys y desarrollo. ¿Cómo lo vives hoy?',
        'Guardias: opinión sobre el modelo y las condiciones.',
        'IA: cuánto, cómo y en qué la usan; qué opinan.',
      ]),
    },
    {
      id: 'cierre',
      title: 'Cierre',
      intro:
        'Recoger una acción concreta que el líder pueda devolver, para demostrar que el O2O sirve.',
      questions: [],
    },
  ],
};
