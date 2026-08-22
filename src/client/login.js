/**
 * Glue de cliente de la página de login: tras autenticarse, redirige a la ruta
 * de origen (?redirect=) o a la home. El alta de administradores NO se hace aquí
 * — se gestiona server-side (Admin SDK / seed / Cloud Function grantAdmin).
 */
import '../components/auth-button.js';
import { onUserChanged } from '../lib/auth.js';
import { safeRedirect } from '../lib/safeRedirect.js';

const params = new URLSearchParams(location.search);
// El destino lo escribe quien manda el enlace: se sanea antes de navegar
// (RMR-BUG-0097), nunca se usa crudo.
const redirect = safeRedirect(params.get('redirect'));

onUserChanged((user) => {
  if (user) location.replace(redirect);
});
