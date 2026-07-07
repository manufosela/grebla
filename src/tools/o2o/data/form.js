/**
 * Formulario previo por defecto (contenido inicial versionado). Se siembra en
 * /o2oForms/preo2o-default. Son temas para PENSAR, no para rellenar.
 *
 * @typedef {import('../domain/types.js').PreO2OForm} PreO2OForm
 */
import { DEFAULT_FORM_ID } from '../domain/types.js';

/** @param {string} sectionId @param {string[]} texts */
const qs = (sectionId, texts) => texts.map((text, i) => ({ id: `${sectionId}-q${i + 1}`, text }));

/** @type {PreO2OForm} */
export const DEFAULT_FORM = {
  id: DEFAULT_FORM_ID,
  version: 1,
  intro:
    'No hace falta que lo rellenes. Son temas para que vengas con ideas pensadas al O2O. Algunos requieren reflexión previa, por eso te los mando antes.',
  sections: [
    {
      id: 'dia',
      title: 'Sobre tu día a día',
      questions: qs('dia', [
        '¿En qué se te va realmente el tiempo en una semana típica? ¿Coincide con donde crees que debería irse?',
        '¿Qué te genera fricción de forma recurrente?',
        '¿Qué parte de tu trabajo te motiva más y cuál menos?',
      ]),
    },
    {
      id: 'equipo',
      title: 'Sobre cómo trabajamos en equipo',
      questions: qs('equipo', [
        'Reparto de tiempo entre revisar PRs, dailys y desarrollo: ¿cómo lo vives? ¿Qué proporción te parecería sana?',
        '¿Qué opinas de nuestras dailys y ceremonias? ¿Aportan o son ruido?',
        '¿Qué cambiarías del proceso de revisión de código?',
      ]),
    },
    {
      id: 'guardias',
      title: 'Sobre las guardias (piénsalo con calma)',
      questions: qs('guardias', [
        '¿Qué te preocupa o te parece bien del modelo de guardias que vamos a introducir?',
        '¿Qué condiciones te parecerían justas y sostenibles?',
      ]),
    },
    {
      id: 'ia',
      title: 'Sobre la IA',
      questions: qs('ia', [
        '¿Para qué usas IA hoy en tu trabajo y con qué frecuencia?',
        '¿Dónde te ayuda de verdad y dónde te ha decepcionado o no te fías?',
        '¿Cómo crees que deberíamos usarla como equipo?',
      ]),
    },
    {
      id: 'ti',
      title: 'Sobre ti y tus objetivos',
      questions: qs('ti', [
        '¿Qué quieres aprender o hacia dónde quieres crecer?',
        '¿Qué esperas de mí como manager para poder rendir mejor?',
      ]),
    },
  ],
};
