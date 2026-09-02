/**
 * Tests del catálogo de roles del Role Mirror.
 *
 * Los roles son ARQUETIPOS de comportamiento: dicen cómo trabajas, no cuánto
 * alcance tienes (eso es el nivel) ni en qué dominio (eso es la disciplina).
 */
import { describe, it, expect } from 'vitest';
import { ROLES, roleLabelOf } from './roles.js';
describe('roleLabelOf: el historial no miente sobre roles retirados (RMR-TSK-0472)', () => {
  it('resuelve la etiqueta de un rol vigente', () => {
    expect(roleLabelOf('techLead')).toBe('Tech Lead');
  });

  it('un rol que ya no está en el catálogo se dice, no se calla', () => {
    // «staff» salió del Role Mirror por ser un nivel, no un arquetipo. Las
    // mediciones antiguas conservan su clave, y pintar «—» diría que aquella
    // medición no tuvo rol dominante — que es falso.
    expect(roleLabelOf('staff')).toBe('Rol retirado');
  });

  it('sin clave sí es un guion: ahí de verdad no hay rol', () => {
    expect(roleLabelOf(null)).toBe('—');
    expect(roleLabelOf(undefined)).toBe('—');
    expect(roleLabelOf('')).toBe('—');
  });

  it('«staff» ya no es un rol del cuestionario', () => {
    expect(ROLES.map((r) => r.key)).not.toContain('staff');
  });
});
