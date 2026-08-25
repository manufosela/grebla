import { describe, it, expect } from 'vitest';
import { accessFieldsForNewRetro, canSeeRetro, withMember, withoutMember } from './membership.js';

describe('accessFieldsForNewRetro', () => {
  it('quien convoca entra siempre: nadie crea una retro para no estar en ella', () => {
    expect(accessFieldsForNewRetro({ creatorUid: 'ana', chain: [] }).memberUids).toEqual(['ana']);
  });

  it('la rama es la cadena de managers de quien convoca, para que la vean sin invitación', () => {
    expect(accessFieldsForNewRetro({ creatorUid: 'ana', chain: ['manager', 'head', 'cto'] }))
      .toEqual({ memberUids: ['ana'], branchUids: ['manager', 'head', 'cto'] });
  });

  it('sin cadena conocida, la retro nace sin rama: mejor eso que dar acceso a quien no toca', () => {
    expect(accessFieldsForNewRetro({ creatorUid: 'ana' }).branchUids).toEqual([]);
    expect(accessFieldsForNewRetro({ creatorUid: 'ana', chain: null }).branchUids).toEqual([]);
  });

  it('quien convoca no se cuenta en su propia rama: «donde estoy» y «mi rama» son cosas distintas', () => {
    // Un manager que convoca su propia retro aparece en su chain si el espejo
    // se la devuelve; ahí solo debe contar como miembro.
    expect(accessFieldsForNewRetro({ creatorUid: 'jefa', chain: ['jefa', 'head'] }))
      .toEqual({ memberUids: ['jefa'], branchUids: ['head'] });
  });

  it('descarta huecos y repetidos de la cadena', () => {
    expect(accessFieldsForNewRetro({ creatorUid: 'ana', chain: ['head', '', null, 'head', '  '] }).branchUids)
      .toEqual(['head']);
  });

  it('sin saber quién convoca, falla en vez de crear una retro que no vería nadie', () => {
    expect(() => accessFieldsForNewRetro({})).toThrow(/quién la convoca/);
    expect(() => accessFieldsForNewRetro({ creatorUid: '   ' })).toThrow();
  });
});

describe('canSeeRetro', () => {
  const retro = { memberUids: ['ana', 'luis'], branchUids: ['jefa'] };

  it('la ve quien está dentro', () => {
    expect(canSeeRetro(retro, { uid: 'ana' })).toBe(true);
  });

  it('la ve el manager de quien la convocó, aunque no haya entrado', () => {
    expect(canSeeRetro(retro, { uid: 'jefa' })).toBe(true);
  });

  it('NO la ve alguien de la organización que no está ni dentro ni en la rama', () => {
    // Es justo lo que hoy sí puede hacer cualquiera con correo del dominio.
    expect(canSeeRetro(retro, { uid: 'ajeno' })).toBe(false);
  });

  it('la ve quien tiene el permiso de verlas todas (superadmin, People…)', () => {
    expect(canSeeRetro(retro, { uid: 'ajeno', seesAll: true })).toBe(true);
  });

  it('sin sesión no se ve nada, ni siquiera con la retro delante', () => {
    expect(canSeeRetro(retro, { uid: null })).toBe(false);
    expect(canSeeRetro(retro, {})).toBe(false);
  });

  it('una retro sin campos de acceso no se abre «por defecto»', () => {
    expect(canSeeRetro({}, { uid: 'ana' })).toBe(false);
    expect(canSeeRetro(null, { uid: 'ana' })).toBe(false);
  });
});

describe('withMember / withoutMember', () => {
  it('entrar dos veces por el enlace no duplica ni reordena', () => {
    expect(withMember(['ana', 'luis'], 'luis')).toEqual(['ana', 'luis']);
    expect(withMember(['ana'], 'luis')).toEqual(['ana', 'luis']);
  });

  it('ignora un uid vacío en vez de meter basura en la lista', () => {
    expect(withMember(['ana'], '')).toEqual(['ana']);
    expect(withMember(['ana'], '   ')).toEqual(['ana']);
  });

  it('salir quita solo a quien sale', () => {
    expect(withoutMember(['ana', 'luis'], 'luis')).toEqual(['ana']);
    expect(withoutMember(['ana'], 'quien-no-estaba')).toEqual(['ana']);
  });
});
