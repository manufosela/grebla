/**
 * Logo de la instancia en dos versiones (RMR-TSK-0628): cada ranura guarda la
 * suya y la vista previa refleja lo guardado. Métodos del prototipo.
 */
import { describe, it, expect, vi } from 'vitest';
import { OrgIdentity } from './org-identity.js';

const { _store } = OrgIdentity.prototype;
const png = 'data:image/png;base64,AAAA';

describe('<org-identity> — logo claro y logo oscuro', () => {
  it('la ranura oscura guarda con su propia función y no toca el logo claro', async () => {
    const saveLogo = vi.fn();
    const saveLogoDark = vi.fn().mockResolvedValue();
    const ctx = { logo: 'claro', logoDark: null, saveLogo, saveLogoDark };
    await _store.call(ctx, 'logoDark', png);
    expect(saveLogoDark).toHaveBeenCalledWith(png);
    expect(saveLogo).not.toHaveBeenCalled();
    expect(ctx).toMatchObject({ logo: 'claro', logoDark: png });
  });

  it('la ranura clara sigue guardando como siempre', async () => {
    const saveLogo = vi.fn().mockResolvedValue();
    const ctx = { logo: null, saveLogo, saveLogoDark: vi.fn() };
    await _store.call(ctx, 'logo', png);
    expect(saveLogo).toHaveBeenCalledWith(png);
    expect(ctx.logo).toBe(png);
  });

  it('si guardar falla, la vista previa se queda con lo que de verdad hay', async () => {
    const ctx = { logoDark: 'antes', saveLogoDark: vi.fn().mockRejectedValue(new Error('no')) };
    await expect(_store.call(ctx, 'logoDark', png)).rejects.toThrow('no');
    expect(ctx.logoDark).toBe('antes');
  });
});
