/**
 * Glue del panel de gestión del superadmin. Monta <superadmin-panel>, verifica
 * que el usuario tiene acceso de gestión (superadmin o viewer; si no, lo
 * redirige), le indica si además es líder (para ofrecer "Usar como líder", solo
 * aplicable a un superadmin) y activa el modo de solo lectura para un viewer.
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
    if (role !== 'superadmin' && role !== 'viewer') {
      location.replace('/');
      return;
    }
    el.readOnly = role === 'viewer';
    // "Usar como líder" solo aplica a un superadmin que también sea líder; un
    // viewer nunca gestiona personas propias.
    el.isLeader = role === 'superadmin' && (await getLeader(user.uid)) != null;
    el.ready = true;
  } catch {
    location.replace('/');
  }
});
