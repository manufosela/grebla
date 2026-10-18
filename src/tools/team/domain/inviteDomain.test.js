import { describe, it, expect } from 'vitest';
import { inviteDomainError } from './inviteDomain.js';

/** Solo se invita con emails de la organización (RMR-TSK-0774); la pantalla lo dice antes que las reglas. */
describe('inviteDomainError', () => {
  it('un email del dominio, o ninguno, vale', () => {
    expect(inviteDomainError('ana@empresa.example', 'empresa.example')).toBeNull();
    expect(inviteDomainError('ANA@Empresa.example', '@empresa.example')).toBeNull();
    expect(inviteDomainError('', 'empresa.example')).toBeNull();
  });

  it('uno de fuera, no, y dice cuál vale', () => {
    expect(inviteDomainError('ana@personal.example', 'empresa.example')).toMatch(/@empresa\.example/);
  });

  it('sin dominio configurado (la demo), cualquiera', () => {
    expect(inviteDomainError('ana@personal.example', '')).toBeNull();
  });
});
