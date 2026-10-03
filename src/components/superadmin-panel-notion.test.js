/**
 * Admin › Usuarios con Notion conectado (RMR-TSK-0588): nombre, email, rama y
 * superior se ven pero no se editan (vienen de Notion), y cambiar el rol ya no
 * arrastra la rama. Métodos reales del prototipo sobre un `this` mínimo, como en
 * superadmin-panel-busy.test.js.
 */
import { describe, it, expect, vi } from 'vitest';
import { SuperadminPanel } from './superadmin-panel.js';

const proto = SuperadminPanel.prototype;
const textOf = (tpl) => JSON.stringify(tpl?.strings ?? []);
const person = { id: 'p1', name: 'Ana', uid: null, pendingEmail: 'ana@example.com', orgRole: 'eng', orgBranch: 'engineering' };

describe('tabla de personas con Notion conectado', () => {
  it('nombre y email sin lápiz de edición', () => {
    const ctx = { _notionSync: true, _editPersonNameId: null, _editEmailId: null, _users: [], _personEmail: proto._personEmail };
    expect(textOf(proto._renderPersonNameCell.call(ctx, person))).not.toContain('rename-btn');
    expect(textOf(proto._renderPersonEmailCell.call(ctx, person))).not.toContain('rename-btn');
  });

  it('sin Notion (la demo) siguen teniendo su lápiz', () => {
    const ctx = { _notionSync: false, _editPersonNameId: null, _editEmailId: null, _users: [], _personEmail: proto._personEmail };
    expect(textOf(proto._renderPersonNameCell.call(ctx, person))).toContain('rename-btn');
    expect(textOf(proto._renderPersonEmailCell.call(ctx, person))).toContain('rename-btn');
  });

  it('cambiar el rol no toca la rama: esa la manda Notion', async () => {
    const update = vi.fn().mockResolvedValue();
    const ctx = {
      _notionSync: true, _peopleList: [person], _orgRoles: [{ id: 'pm', branch: 'product' }],
      persistence: { people: { update } }, _peopleError: '', _peopleNotice: '',
    };
    await proto._setPersonRoleImpl.call(ctx, 'p1', 'pm');
    expect(update).toHaveBeenCalledWith('p1', { orgRole: 'pm' });
    expect(ctx._peopleList[0]).toMatchObject({ orgRole: 'pm', orgBranch: 'engineering' });
  });

  it('sin Notion, cambiar el rol sigue derivando la rama', async () => {
    const update = vi.fn().mockResolvedValue();
    const ctx = {
      _notionSync: false, _peopleList: [person], _orgRoles: [{ id: 'pm', branch: 'product' }],
      persistence: { people: { update } }, _peopleError: '', _peopleNotice: '',
    };
    await proto._setPersonRoleImpl.call(ctx, 'p1', 'pm');
    expect(update).toHaveBeenCalledWith('p1', { orgRole: 'pm', orgBranch: 'product' });
  });
});
