/**
 * Tests de las DECISIONES del arranque del hub (RMR-BUG-0112).
 *
 * El arranque encadenaba cinco esperas —cuatro de ellas independientes— y una
 * era una Cloud Function que bloqueaba el pintado. Para poder pedirlo todo a la
 * vez hay que separar QUÉ se decide de CUÁNDO se piden los datos: esto es lo
 * primero, y se prueba sin red.
 */
import { describe, it, expect } from 'vitest';
import { isEmployeeOf, hubDestination, needsEmployeePerson, managesSomeTool } from './hubBoot.js';

describe('isEmployeeOf: quién es empleado del dominio de la instancia', () => {
  it('lo es con el email verificado del dominio configurado', () => {
    expect(isEmployeeOf('ana@ejemplo.test', true, 'ejemplo.test')).toBe(true);
  });

  it('sin verificar el email, no', () => {
    // El dominio se comprueba sobre algo que el usuario podría no controlar:
    // sin verificación, cualquiera se pone ese correo al registrarse.
    expect(isEmployeeOf('ana@ejemplo.test', false, 'ejemplo.test')).toBe(false);
  });

  it('de otro dominio, no', () => {
    expect(isEmployeeOf('ana@otra.test', true, 'ejemplo.test')).toBe(false);
  });

  it('sin dominio configurado no lo es NADIE: la demo no reparte acceso por email', () => {
    expect(isEmployeeOf('ana@ejemplo.test', true, '')).toBe(false);
  });

  it('no se cuela quien lleva el dominio en otra parte del correo', () => {
    expect(isEmployeeOf('ejemplo.test@otra.test', true, 'ejemplo.test')).toBe(false);
  });
});

describe('hubDestination: a dónde va quien entra', () => {
  const sinNada = { functionalRole: null, instanceAccess: null };

  it('sin rol, sin gobierno y sin ser empleado: la landing pública', () => {
    expect(hubDestination({ access: sinNada, isEmployee: false, managesAnyTool: false })).toBe('landing');
  });

  it('un viewer va al panel en solo lectura: es observador, no gestiona', () => {
    expect(hubDestination({ access: { instanceAccess: 'viewer' }, isEmployee: false, managesAnyTool: false }))
      .toBe('admin');
  });

  it('con rol funcional, al hub', () => {
    expect(hubDestination({ access: { functionalRole: 'engineer' }, isEmployee: false, managesAnyTool: false }))
      .toBe('tools');
  });

  it('un empleado del dominio sin rol también entra al hub', () => {
    expect(hubDestination({ access: sinNada, isEmployee: true, managesAnyTool: false })).toBe('tools');
  });

  it('quien gestiona CUALQUIER herramienta entra aunque no tenga otro rol', () => {
    // Antes esto era un caso especial de encuestas, heredado de cuando People
    // era un rol suelto. Quien gestiona una herramienta sin tener otro rol
    // tiene el mismo problema: si no entrara, no podría llegar a lo suyo.
    expect(hubDestination({ access: sinNada, isEmployee: false, managesAnyTool: true })).toBe('tools');
  });

  it('sin decir nada de herramientas, decide como si no gestionara ninguna', () => {
    expect(hubDestination({ access: sinNada, isEmployee: false })).toBe('landing');
  });
});

describe('needsEmployeePerson: cuándo hace falta la Cloud Function', () => {
  it('solo si es empleado del dominio y NO tiene ficha', () => {
    expect(needsEmployeePerson({ isEmployee: true, person: null })).toBe(true);
  });

  it('con ficha, NO se llama: es el caso de casi todas las cargas', () => {
    // Aquí estaba el coste: se llamaba en cada entrada de cada empleado, y una
    // función fría tarda segundos delante de una pantalla en blanco.
    expect(needsEmployeePerson({ isEmployee: true, person: { id: 'p1' } })).toBe(false);
  });

  it('quien no es empleado del dominio nunca la necesita', () => {
    expect(needsEmployeePerson({ isEmployee: false, person: null })).toBe(false);
  });
});

describe('managesSomeTool: el atajo de entrada no es de una herramienta concreta', () => {
  const ref = { id: 'p1' };
  const gestiona = (_r, p) => p.toolId === 'surveys';

  it('basta con gestionar UNA', () => {
    expect(managesSomeTool(ref, [{ toolId: 'marea' }, { toolId: 'surveys' }], gestiona)).toBe(true);
  });

  it('si no gestiona ninguna, no hay atajo', () => {
    expect(managesSomeTool(ref, [{ toolId: 'marea' }, { toolId: 'dora' }], gestiona)).toBe(false);
  });

  it('sin políticas cargadas no se inventa permiso', () => {
    // Si la lectura falla, entrar por esta vía sería concederlo por un error.
    expect(managesSomeTool(ref, [], gestiona)).toBe(false);
    expect(managesSomeTool(ref, undefined, gestiona)).toBe(false);
  });
});
