/**
 * Glue de la retro compartida por enlace (RMR-TSK-0279): `/retro?id=<retroId>`.
 *
 * Quién puede entrar lo decide Firestore (ADR «Retros por membresía»): quien
 * está dentro o quien la tiene en su rama. Si el enlace trae `join`, primero se
 * canjea: abrirlo es lo que te mete dentro, y a partir de ahí la retro te sale
 * en tu listado. Aquí solo se traduce el resultado a algo legible — un
 * `permission-denied` no debe salir como error crudo.
 */
import { onUserChanged, signInWithGoogle } from '../lib/auth.js';
import { getRetro, joinRetroByLink } from '../lib/retros.js';
import '../components/retro/retro-board.js';

const statusEl = document.getElementById('retro-status');
const hostEl = document.getElementById('retro-host');
const params = new URLSearchParams(location.search);
const retroId = params.get('id');
const joinToken = params.get('join');

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

if (retroId) {
  onUserChanged(async (user) => {
    if (!user) {
      showSignIn();
      return;
    }
    try {
      // Canjear el enlace ANTES de leer: si no, quien entra por primera vez se
      // encontraría un «no tienes acceso» aun teniendo el enlace bueno. Un
      // token que no vale no rompe la página: se sigue e intenta leer, por si
      // ya era miembro o le alcanza por su rama.
      if (joinToken) {
        showStatus('Entrando en la retro…');
        try { await joinRetroByLink(retroId, joinToken); } catch { /* el enlace no vale; puede que ya tenga acceso */ }
      }
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
} else {
  showStatus('Falta el identificador de la retro en el enlace.', true);
}
