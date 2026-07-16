/**
 * Glue del panel de gestión del superadmin. Monta <superadmin-panel>, verifica
 * que el usuario tiene acceso de gestión (superadmin o viewer; si no, lo
 * redirige), le indica si además es manager (para ofrecer "Usar como manager", solo
 * aplicable a un superadmin) y activa el modo de solo lectura para un viewer.
 */
import '../components/superadmin-panel.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getLeader } from '../lib/leaders.js';
import { createTeamContainer } from '../tools/team/composition/container.js';

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
    // "Usar como manager" solo aplica a un superadmin que también sea manager; un
    // viewer nunca gestiona personas propias.
    el.isLeader = role === 'superadmin' && (await getLeader(user.uid)) != null;
    // Persistencia (viewAll) para <catalog-manager>: el superadmin ve TODOS los
    // catálogos (globales + personales de cualquier manager) y crea globales.
    const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: user.uid, viewAll: true });
    el.persistence = persistence;
    el.currentUid = user.uid;
    el.ready = true;
  } catch {
    location.replace('/');
  }
});
