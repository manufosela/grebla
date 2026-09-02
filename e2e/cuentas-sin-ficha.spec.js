/**
 * E2E de las CUENTAS SIN FICHA (RMR-TSK-0446).
 *
 * El panel las pintaba todas igual —«se ha logado pero no tiene ficha»—, y eso
 * es falso en el caso más común: a un viewer se le da acceso de solo lectura a
 * propósito. Como el login no restringe dominio y cada entrada escribe en
 * `/users`, ese aviso convertía lo esperable en un problema y escondía el
 * residuo de verdad entre el ruido.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const haceDias = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/** Las tres situaciones a la vez, para verlas una al lado de otra. */
async function conLasTresCuentas(fn) {
  await db().doc('users/e2e-cuenta-viewer').set({ displayName: 'Viewer Sin Ficha', email: 'viewer@e2e.test', lastLogin: haceDias(400) });
  await db().doc('viewers/e2e-cuenta-viewer').set({ displayName: 'Viewer Sin Ficha', email: 'viewer@e2e.test' });
  await db().doc('users/e2e-cuenta-nueva').set({ displayName: 'Recién Llegada', email: 'nueva@e2e.test', lastLogin: haceDias(2) });
  await db().doc('users/e2e-cuenta-residuo').set({ displayName: 'Cuenta Vieja', email: 'vieja@e2e.test', lastLogin: haceDias(300) });
  try { await fn(); } finally {
    for (const ref of ['users/e2e-cuenta-viewer', 'viewers/e2e-cuenta-viewer', 'users/e2e-cuenta-nueva', 'users/e2e-cuenta-residuo']) {
      await db().doc(ref).delete();
    }
  }
}

const fila = (page, nombre) => page.locator('superadmin-panel tr', { hasText: nombre });

test('a quien tiene acceso a propósito no se le trata como una anomalía', async ({ page }) => {
  await conLasTresCuentas(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    const viewer = fila(page, 'Viewer Sin Ficha');
    await expect(viewer).toContainText('acceso concedido');
    await expect(viewer).toContainText('Viewer');
    // Y no se ofrece retirarle el acceso que se le dio queriendo.
    await expect(viewer.getByRole('button', { name: 'Retirar' })).toHaveCount(0);

    // El rol derivado ya incluye el gobierno: nada de «Superadmin y superadmin».
    await expect(page.locator('superadmin-panel tbody')).not.toContainText('y superadmin');
  });
});

test('quien acaba de entrar está pendiente de ficha, no sobra', async ({ page }) => {
  await conLasTresCuentas(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    const nueva = fila(page, 'Recién Llegada');
    await expect(nueva).toContainText('todavía no tiene ficha');
    await expect(nueva.getByRole('button', { name: 'Crear ficha' })).toBeVisible();
    await expect(nueva.getByRole('button', { name: 'Retirar' })).toHaveCount(0);
  });
});

test('la cuenta sin acceso ni actividad se puede retirar desde el panel', async ({ page }) => {
  await conLasTresCuentas(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    const vieja = fila(page, 'Cuenta Vieja');
    await expect(vieja).toContainText('se puede retirar');
    await vieja.getByRole('button', { name: 'Retirar' }).click();
    await vieja.getByRole('button', { name: 'Sí' }).click();

    await expect.poll(async () => (await db().doc('users/e2e-cuenta-residuo').get()).exists,
      { timeout: 15_000 }).toBe(false);
  });
});

test('no se retira a quien tiene gente a su cargo: dice qué reasignar antes', async ({ page }) => {
  // Con cuenta y gente debajo, pero SIN rol, para que salga como residuo. Se
  // monta una rama propia en vez de desmontar la del manager compartido: si
  // otro spec corre a la vez, quitarle el rol a `e2e-manager` le rompe la
  // cadena de mando a quien esté midiendo visibilidad.
  await db().doc('users/e2e-cuenta-jefa').set({ displayName: 'Jefa Sin Rol', email: 'jefa@e2e.test', lastLogin: haceDias(300) });
  await db().doc('people/e2e-persona-suya').set({
    name: 'Persona de la jefa', uid: null, ownerLeaderUid: 'e2e-cuenta-jefa', active: true,
  });
  try {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    const jefa = fila(page, 'Jefa Sin Rol');
    await jefa.getByRole('button', { name: 'Retirar' }).click();
    await jefa.getByRole('button', { name: 'Sí' }).click();

    // El mensaje dice cuántas personas hay que reasignar, no un «no se pudo».
    await expect(page.locator('superadmin-panel .error')).toContainText('en su equipo');
    expect((await db().doc('users/e2e-cuenta-jefa').get()).exists).toBe(true);
  } finally {
    await db().doc('people/e2e-persona-suya').delete();
    await db().doc('users/e2e-cuenta-jefa').delete();
  }
});

test('quien está de baja NO es una cuenta sin ficha: su ficha existe', async ({ page }) => {
  // Al dar de baja, la persona sale de la lista de activas. Si eso bastara para
  // considerarla «sin ficha», el panel ofrecería crearle otra y acabaría con dos
  // y el historial partido (RMR-BUG-0109).
  await db().doc('users/e2e-cuenta-baja').set({ displayName: 'Persona Dada de Baja', email: 'baja@e2e.test', lastLogin: haceDias(30) });
  await db().doc('people/e2e-persona-baja').set({
    name: 'Persona Dada de Baja', uid: 'e2e-cuenta-baja', ownerLeaderUid: 'e2e-manager', active: false,
  });
  try {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');
    await expect(page.locator('superadmin-panel table.people')).toBeVisible();

    await expect(page.locator('superadmin-panel tbody')).not.toContainText('Persona Dada de Baja (cuenta sin ficha)');
    await expect(fila(page, 'Persona Dada de Baja').getByRole('button', { name: 'Crear ficha' })).toHaveCount(0);
  } finally {
    await db().doc('people/e2e-persona-baja').delete();
    await db().doc('users/e2e-cuenta-baja').delete();
  }
});
