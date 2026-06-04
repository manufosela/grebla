/**
 * Glue de cliente de la página de login: redirige tras autenticarse y ofrece el
 * "claim" del primer administrador cuando todavía no hay ninguno.
 */
import '../components/auth-button.js';
import { onUserChanged, isBootstrapAvailable, claimFirstAdmin } from '../lib/auth.js';

const params = new URLSearchParams(location.search);
const redirect = params.get('redirect') || '/';

const claimBox = document.getElementById('claim');
const claimBtn = document.getElementById('claim-btn');
const claimError = document.getElementById('claim-error');

onUserChanged(async (user) => {
  if (!user) {
    if (claimBox) claimBox.hidden = true;
    return;
  }

  // Si el bootstrap de admin está disponible, ofrecerlo en lugar de redirigir.
  let bootstrap = false;
  try {
    bootstrap = await isBootstrapAvailable();
  } catch {
    bootstrap = false;
  }

  if (bootstrap && claimBox && claimBtn) {
    claimBox.hidden = false;
    claimBtn.addEventListener(
      'click',
      async () => {
        if (claimError) claimError.textContent = '';
        try {
          await claimFirstAdmin(user);
          location.replace('/tools/role-mirror/admin');
        } catch (err) {
          if (claimError) {
            claimError.textContent = err instanceof Error ? err.message : 'No se pudo completar.';
          }
        }
      },
      { once: true },
    );
    return;
  }

  location.replace(redirect);
});
