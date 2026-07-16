/**
 * Glue de cliente de Marea: define <marea-fill> e inyecta el uid del usuario
 * logado. La ruta es protegida (requireAuth en Base + client/layout.js redirige
 * a /login si no hay sesión), así que cuando llega un `user` ya está autenticado.
 */
import '../components/common/tool-nav.js';
import '../components/marea/marea-app.js';
import { onUserChanged } from '../lib/auth.js';

const app = document.querySelector('marea-app');

onUserChanged((user) => {
  if (!user || !app) return;
  app.uid = user.uid;
});
