/**
 * Participantes desde el padrón (RMR-TSK-0630): por defecto no va nadie; se
 * marca por departamento, persona a persona, o Todos/Ninguno.
 */
import { describe, it, expect } from 'vitest';
import { SurveyAdmin } from './survey-admin.js';

const { _togglePadron, _togglePadronDept, _toggleAllPadron } = SurveyAdmin.prototype;
const selection = [
  { email: 'ana@example.com', metadata: { department: 'Tech' } },
  { email: 'Bea@example.com', metadata: { department: 'Tech' } },
  { email: 'carla@example.com', metadata: { department: 'PeopOps' } },
];

describe('<survey-admin> — a quién se envía', () => {
  it('marcar Tech y quitar a una persona de Tech', () => {
    const ctx = { _padronSelected: new Set(), _padronSelection: selection };
    _togglePadronDept.call(ctx, 'Tech', true);
    _togglePadron.call(ctx, 'Bea@example.com', false);
    expect([...ctx._padronSelected]).toEqual(['ana@example.com']);
  });

  it('Todos marca a todo el padrón y Ninguno lo vacía', () => {
    const ctx = { _padronSelected: new Set(), _padronSelection: selection };
    _toggleAllPadron.call(ctx, true);
    expect(ctx._padronSelected.size).toBe(3);
    _toggleAllPadron.call(ctx, false);
    expect(ctx._padronSelected.size).toBe(0);
  });
});
