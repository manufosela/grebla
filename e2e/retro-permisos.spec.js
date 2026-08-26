/**
 * La interfaz no ofrece lo que las reglas van a denegar (RMR-TSK-0458).
 *
 * Gestionar una retro —cerrarla, borrarla— es de quien la convocó. Ofrecer esos
 * botones a los demás no da acceso (las reglas mandan), pero hace pulsar algo
 * que falla, que es la peor forma de decir «no puedes».
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

const AJENA = 'e2e-retro-de-otra';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Botones de la fila de una retro, atravesando shadow DOM. */
const botonesDeFila = (page) => page.evaluate(() => {
  const out = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.tagName === 'BUTTON' && el.closest('tr')) out.push(el.textContent.trim());
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  return out;
});

test.beforeEach(async () => {
  await db().doc(`retros/${AJENA}`).set({
    name: 'Retro de otra persona',
    ownerLeaderUid: 'e2e-manager',
    memberUids: ['e2e-manager', 'e2e-engineer'],
    branchUids: [], joinToken: 'x', status: 'open',
    scope: { type: 'team', squadId: null, label: null }, createdAt: new Date(),
  });
});

test.afterEach(async () => {
  await db().doc(`retros/${AJENA}`).delete().catch(() => {});
});

test('quien participa pero no convocó: puede abrir y salir, no cerrar ni borrar', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await expect(page.getByText('Retro de otra persona')).toBeVisible();

  const botones = await botonesDeFila(page);
  expect(botones).toContain('Abrir');
  expect(botones).toContain('Salir');
  expect(botones).not.toContain('Cerrar');
  expect(botones).not.toContain('Borrar');
});

test('quien la convocó: puede cerrar y borrar, y no se ofrece salir de la suya', async ({ page }) => {
  await db().doc(`retros/${AJENA}`).update({ ownerLeaderUid: 'e2e-engineer' });
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await expect(page.getByText('Retro de otra persona')).toBeVisible();

  const botones = await botonesDeFila(page);
  expect(botones).toContain('Cerrar');
  expect(botones).toContain('Borrar');
  expect(botones).not.toContain('Salir');
});

test('las retros se reparten en dos pestañas, sin apilar formulario y lista', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');

  // Se entra por la lista, que es lo que se consulta a diario.
  await expect(page.getByRole('tab', { name: /Mis retros/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByPlaceholder('p. ej. Retro Sprint 29')).toBeHidden();

  await page.getByRole('tab', { name: 'Nueva retro' }).click();
  await expect(page.getByPlaceholder('p. ej. Retro Sprint 29')).toBeVisible();
});
