import { describe, it, expect } from 'vitest';
import { buildPlayerIdentity } from './identity.js';

describe('buildPlayerIdentity', () => {
  it('ingeniero: usuarioId=personId y equipo/líder = ownerLeaderUid de su persona', () => {
    const id = buildPlayerIdentity({ role: 'engineer', uid: 'u1', personId: 'p1' }, { ownerLeaderUid: 'L9' });
    expect(id).toEqual({ usuarioId: 'p1', usuarioKind: 'person', uid: 'u1', liderId: 'L9', equipoId: 'L9' });
  });

  it('ingeniero sin líder asignado: liderId/equipoId null', () => {
    const id = buildPlayerIdentity({ role: 'engineer', uid: 'u1', personId: 'p1' }, null);
    expect(id.liderId).toBe(null);
    expect(id.equipoId).toBe(null);
  });

  it('líder: es su propio equipo (usuarioId=uid)', () => {
    const id = buildPlayerIdentity({ role: 'leader', uid: 'L9' });
    expect(id).toEqual({ usuarioId: 'L9', usuarioKind: 'leader', uid: 'L9', liderId: 'L9', equipoId: 'L9' });
  });

  it('superadmin/viewer/sin acceso no juegan (null)', () => {
    expect(buildPlayerIdentity({ role: 'superadmin', uid: 'a1' })).toBe(null);
    expect(buildPlayerIdentity({ role: 'viewer', uid: 'v1' })).toBe(null);
    expect(buildPlayerIdentity({ role: null, uid: null })).toBe(null);
  });
});
