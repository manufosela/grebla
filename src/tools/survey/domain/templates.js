/**
 * Plantillas de preguntas de encuesta (RMR-TSK-0325). Dominio puro.
 *
 * Plantilla de CLIMA: eNPS (recomendación 1–10 + razón en texto) + las 12
 * preguntas del Q12 de Gallup (escala 1–5). Es un punto de partida editable por
 * People (el Q12 es un instrumento de Gallup; su uso es decisión de People).
 */

const Q12_LABELS = [
  'Sé lo que se espera de mí en el trabajo.',
  'Tengo los materiales y el equipo que necesito para hacer bien mi trabajo.',
  'En el trabajo, tengo la oportunidad de hacer cada día lo que mejor sé hacer.',
  'En los últimos siete días, he recibido reconocimiento o elogios por hacer un buen trabajo.',
  'Mi responsable, o alguien en el trabajo, se preocupa por mí como persona.',
  'Hay alguien en el trabajo que estimula mi desarrollo.',
  'En el trabajo, mis opiniones cuentan.',
  'La misión o el propósito de la empresa me hace sentir que mi trabajo es importante.',
  'Mis compañeros están comprometidos con hacer un trabajo de calidad.',
  'Tengo un buen amigo en el trabajo.',
  'En los últimos seis meses, alguien me ha hablado sobre mi progreso.',
  'Este último año he tenido oportunidades de aprender y crecer en el trabajo.',
];

/** Preguntas de la plantilla de clima (eNPS + Q12), con ids estables. */
export function climateTemplate() {
  return [
    { id: 'enps', type: 'scale', min: 1, max: 10, required: true, label: '¿Recomendarías TRIBBU como un lugar para trabajar?' },
    { id: 'enps_reason', type: 'text', required: false, label: '¿Cuál es la razón de esta puntuación?' },
    ...Q12_LABELS.map((label, i) => ({ id: `q${i + 1}`, type: 'scale', min: 1, max: 5, required: true, label })),
  ];
}
