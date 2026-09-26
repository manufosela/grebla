/**
 * Glue del SEGUIMIENTO del plan de desarrollo (RMR-TSK-0566).
 *
 * Es el lado de gestión de la herramienta: entra quien la gestiona, y se le dan
 * las personas de su ámbito —su equipo, su rama o toda la organización, el mismo
 * alcance que en el resto— más el store del juego para leer el viaje y el
 * cronómetro de cada una. Quien no gestiona no pasa.
 */
import '../components/career/career-tracking.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { branchScopeFor, canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';
import { listLeaders } from '../lib/leaders.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';
import { getFramework } from '../lib/careerFramework.js';
import { getArchipelago } from '../lib/careerMap.js';

const app = document.querySelector('career-tracking');
const denied = document.querySelector('#ct-denied');
const navAdmin = document.querySelector('#cm-nav-admin');

onUserChanged(async (user) => {
  if (!user || !app) return;
  let access = null;
  try { access = await resolveAccess(user); } catch { /* sin acceso resuelto */ }
  const gobierna = canGovern(access);
  const gate = await guardToolPage('career', user, { isSuperadmin: gobierna, appEl: app });
  if (!gate) return;
  // Usar la herramienta no da derecho a ver por dónde va el resto del equipo.
  if (!(gobierna || gate.manage)) {
    app.remove();
    denied?.toggleAttribute('hidden', false);
    return;
  }
  navAdmin?.toggleAttribute('hidden', false);

  try {
    // El framework y el archipiélago se piden AQUÍ, antes de las personas: si
    // llegaran después, la tabla se cargaría dos veces —una sin nivel y otra con
    // él—, y eso son dos rondas de lecturas por persona para la misma pantalla.
    // Solo dan rótulos y ciudadanías, así que si fallan se sigue adelante.
    const [{ store }, leaders, extras] = await Promise.all([
      createCareerContainer({ mode: 'firestore' }),
      listLeaders(),
      Promise.all([getFramework(), getArchipelago()]).catch((err) => {
        console.warn('Seguimiento: sin framework o archipiélago, el nivel saldrá vacío.', err);
        return [null, null];
      }),
    ]);
    const [framework, archipelago] = extras;
    const viewAll = gobierna;
    const { persistence } = await createTeamContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll,
      leaderUids: viewAll ? null : branchScopeFor(access, leaders, user.uid),
    });
    const roster = await listActivePeople(persistence);
    app.framework = framework;
    app.islands = archipelago?.islands ?? null;
    // La persistencia de Equipo es lo que permite ajustar el sub-nivel a mano;
    // sin ella el chip se ve pero no se edita.
    app.persistence = persistence;
    // El nivel actual y su ajuste a mano hacen falta para el sub-nivel efectivo
    // (RMR-TSK-0590): sin ellos la columna «Nivel» saldría vacía.
    app.people = roster.map((p) => ({
      id: p.id,
      name: p.name,
      levelId: p.levelId ?? null,
      careerTargetLevelId: p.careerTargetLevelId ?? null,
      subLevelOverride: p.subLevelOverride ?? null,
    }));
    app.store = store;
  } catch {
    app.people = [];
  }
});
