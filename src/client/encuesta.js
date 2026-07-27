/**
 * Glue de la página pública de respuesta (RMR-TSK-0320). Lee el enlace personal
 * de la URL (`?s=<surveyId>&t=<token>`) y lo inyecta en <survey-respond>. No hay
 * sesión: el token es la única credencial.
 */
import '../components/survey/survey-respond.js';

const el = document.querySelector('survey-respond');
if (el) {
  const params = new URLSearchParams(location.search);
  el.setLink(params.get('s'), params.get('t'));
}
