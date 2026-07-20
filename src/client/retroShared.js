/**
 * Glue de la retro compartida por enlace (RMR-TSK-0279): `/retro?id=<retroId>`.
 *
 * Quién puede entrar lo decide Firestore (RMR-TSK-0274): miembros de la
 * instancia o correos @tribbuapp.com. Aquí solo se traduce el resultado a algo
 * legible — un `permission-denied` no debe salir como error crudo, sino como
 * «no tienes acceso a esta retro».
 */
import { onUserChanged, signInWithGoogle } from '../lib/auth.js';
import { getRetro } from '../lib/retros.js';
import '../components/retro/retro-board.js';

const statusEl = document.getElementById('retro-status');
const hostEl = document.getElementById('retro-host');
const retroId = new URLSearchParams(location.search).get('id');

/** @param {string} message @param {boolean} [isError] */
function showStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
  statusEl.hidden = false;
}

/** Invita a entrar con Google (quien abre el enlace puede no tener sesión). */
function showSignIn() {
  if (!statusEl) return;
  statusEl.classList.remove('error');
  statusEl.textContent = 'Inicia sesión para ver esta retro y participar. ';
  const button = document.createElement('button');
  button.className = 'signin';
  button.textContent = 'Entrar con Google';
  button.addEventListener('click', () => {
    signInWithGoogle().catch(() => showStatus('No se pudo iniciar sesión. Inténtalo de nuevo.', true));
  });
  statusEl.append(button);
  statusEl.hidden = false;
}

if (!retroId) {
  showStatus('Falta el identificador de la retro en el enlace.', true);
} else {
  onUserChanged(async (user) => {
    if (!user) {
      showSignIn();
      return;
    }
    try {
      // Si las reglas no le dejan, esto lanza permission-denied.
      const retro = await getRetro(retroId);
      if (!retro) {
        showStatus('Esta retro no existe o ha sido borrada.', true);
        return;
      }
      const board = document.createElement('retro-board');
      board.retroId = retroId;
      board.uid = user.uid;
      hostEl?.replaceChildren(board);
      if (hostEl) hostEl.hidden = false;
      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      const denied = /permission|insufficient/i.test(String(err?.code ?? err?.message ?? ''));
      showStatus(
        denied
          ? 'No tienes acceso a esta retro. Entra con tu cuenta de tribbu, o pide a tu manager que te asocie a un equipo.'
          : 'No se pudo cargar la retro. Inténtalo de nuevo en unos minutos.',
        true,
      );
    }
  });
}
