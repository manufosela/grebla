/**
 * Glue de cliente de los juegos de Motivadores. Resuelve el acceso, construye la
 * identidad del jugador (ingeniero o manager), crea el container Firestore e inyecta
 * persistence, identity y la ronda abierta en <motivators-app>. El juego se toma
 * del atributo `deck` del elemento (moving_motivators | affective_motivators).
 */
import '../components/motivators/motivators-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern, hasAccess } from '../lib/accessRoles.js';
import { getMyPerson } from '../lib/engineer.js';
import { createMotivatorsContainer } from '../tools/motivators/composition/container.js';
import { buildPlayerIdentity } from '../tools/motivators/application/identity.js';
import { getActiveRound, listRounds } from '../tools/motivators/application/usecases.js';
import { listLeaders } from '../lib/leaders.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('motivators-app');

/** Mapa uid → nombre visible del manager (para etiquetar el desglose por equipo). */
async function leaderNameMap() {
  try {
    const leaders = await listLeaders();
    return Object.fromEntries(leaders.map((l) => [l.uid, l.displayName || l.email || `Equipo ${String(l.uid).slice(0, 6)}`]));
  } catch {
    return {};
  }
}

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    // Gate por política de la herramienta (RMR-TSK-0387): PRIMERO la política
    // (si deniega, pantalla de sin-acceso); después los requisitos internos.
    const gate = await guardToolPage('motivators', user, { isSuperadmin: canGovern(access), appEl: app });
    if (!gate) return;
    if (!hasAccess(access)) {
      app.error = 'No tienes acceso. Inicia sesión con tu cuenta del equipo.';
      return;
    }

    app.isAdmin = canGovern(access);
    // Gestión por política (RMR-TSK-0388): la pestaña Rondas también por managedBy.
    app.canManageRounds = canGovern(access) || gate.manage;
    app.uid = user.uid;
    const person = access.functionalRole === 'engineer' && !access.instanceAccess ? await getMyPerson(user.uid) : null;
    app.identity = buildPlayerIdentity(access, person);
    const { persistence } = await createMotivatorsContainer({ mode: 'firestore' });
    app.persistence = persistence;
    const game = app.deck || 'moving_motivators';
    const [round, rounds, leaderNames] = await Promise.all([
      getActiveRound(persistence, game),
      listRounds(persistence, game),
      leaderNameMap(),
    ]);
    app.round = round;
    app.rounds = rounds;
    app.leaderNames = leaderNames;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo iniciar el juego.';
  }
});
