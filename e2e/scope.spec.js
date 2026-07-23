/**
 * E2E del toggle de ámbito (RMR-TSK-0309): un usuario que gobierna la instancia
 * (admin) Y ADEMÁS lidera un equipo ve por defecto SU equipo —no toda la
 * organización— y puede alternar. Es el valor central del ADR de acceso en dos
 * ejes: el gobierno deja de tapar la faceta funcional.
 *
 * El admin-manager (ROLES.adminmgr) está en /admins y en /leaders, con su propia
 * persona; NO debe ver por defecto la gente de otros managers.
 */
import { test, expect, signInAs } from './fixtures.js';

test('el admin que además lidera ve su equipo por defecto y puede alternar', async ({ page }) => {
  await signInAs(page, 'adminmgr');
  await page.goto('/tools/team');

  // Por defecto (ámbito «mi equipo»): ve SU persona...
  await expect(page.getByText('Persona del admin-manager')).toBeVisible();
  // ...y NO la de otro manager (eso sería «toda la organización»).
  await expect(page.getByText('Persona del manager')).toHaveCount(0);

  // El control de ámbito existe (solo aparece para quien puede elegir).
  await expect(page.getByRole('button', { name: 'Toda la organización' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mi equipo' })).toBeVisible();
});
