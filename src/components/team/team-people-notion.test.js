/**
 * Equipo con el censo en Notion (RMR-TSK-0625): ni alta manual ni Transferir;
 * la persona y su manager vienen de Notion. Sin Notion (la demo), igual que
 * siempre. Métodos reales del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect } from 'vitest';
import { TeamPeople } from './team-people.js';

const proto = TeamPeople.prototype;
const textOf = (tpl) => JSON.stringify(tpl?.strings ?? []);

describe('Equipo con Notion conectado', () => {
  it('no se puede transferir: el manager lo dice Notion', () => {
    const sup = { canTransfer: true, role: 'engineer' };
    expect(proto._canTransfer.call({ _notionSync: true, isAdmin: true, _canManage: () => true }, {}, sup)).toBe(false);
    expect(proto._canTransfer.call({ _notionSync: false, isAdmin: true, _canManage: () => true }, {}, sup)).toBe(true);
  });

  it('en vez del alta manual, el aviso de que las altas llegan de Notion', () => {
    expect(textOf(proto._renderAddCard.call({ _notionSync: true }))).toContain('vienen de Notion');
  });

  it('sin saber aún si hay Notion (o si la lectura falló), ni alta ni Transferir', () => {
    expect(proto._renderAddCard.call({ _notionSync: null })).toBeNull();
    const sup = { canTransfer: true, role: 'engineer' };
    expect(proto._canTransfer.call({ _notionSync: null, isAdmin: true, _canManage: () => true }, {}, sup)).toBe(false);
  });
});
