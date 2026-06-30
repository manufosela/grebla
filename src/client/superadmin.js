/**
 * Glue del panel de gestión del superadmin. Monta <superadmin-panel>, verifica
 * que el usuario es superadmin (si no, lo redirige) y le indica si además es
 * líder (para ofrecer "Usar como líder").
 */
import '../components/superadmin-panel.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getLeader } from '../lib/leaders.js';

const el = document.querySelector('superadmin-panel');

onUserChanged(async (user) => {
  if (!el) return;
  if (!user) {
    location.replace('/login?redirect=%2Fadmin');
    return;
  }
  try {
    const { role } = await resolveAccess(user);
    if (role !== 'superadmin') {
      location.replace('/');
      return;
    }
    el.isLeader = (await getLeader(user.uid)) != null;
    el.ready = true;
  } catch {
    location.replace('/');
  }
});
