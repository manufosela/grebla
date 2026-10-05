import { describe, it, expect } from 'vitest';
import {
  checkLogoFile, logoSrcFrom, logoDarkSrcFrom, logoAltFrom, LOGO_MAX_BYTES,
} from './orgLogo.js';

describe('logo del tema oscuro (RMR-TSK-0628)', () => {
  const claro = 'data:image/svg+xml;base64,PHN2Zy8+';
  const oscuro = `data:image/png;base64,${Buffer.from('logo blanco').toString('base64')}`;

  it('si hay versión oscura válida, es la del tema oscuro', () => {
    expect(logoDarkSrcFrom({ logo: claro, logoDark: oscuro })).toBe(oscuro);
  });

  it('sin versión oscura (o inválida), el tema oscuro usa la clara', () => {
    expect(logoDarkSrcFrom({ logo: claro })).toBe(claro);
    expect(logoDarkSrcFrom({ logo: claro, logoDark: 'data:text/html;base64,PGI+' })).toBe(claro);
  });

  it('sin logo claro tampoco hay oscuro: la cabecera se queda con GREBLA', () => {
    expect(logoDarkSrcFrom({ logoDark: oscuro })).toBeNull();
  });
});

const archivo = (type, size) => ({ type, size, name: 'logo' });

describe('qué archivo vale como logo', () => {
  it('un SVG o un PNG de tamaño razonable', () => {
    expect(checkLogoFile(archivo('image/svg+xml', 4096))).toEqual({ ok: true });
    expect(checkLogoFile(archivo('image/png', 40_000))).toEqual({ ok: true });
  });

  it('otro formato se rechaza DICIENDO cuál trae y cuáles valen', () => {
    // «Archivo no válido» obliga a adivinar; esto no.
    const out = checkLogoFile(archivo('image/jpeg', 4096));
    expect(out.ok).toBe(false);
    expect(out.error).toContain('SVG o PNG');
    expect(out.error).toContain('image/jpeg');
  });

  it('y si el navegador no reconoce el tipo, se dice así en vez de callar', () => {
    expect(checkLogoFile(archivo('', 10)).error).toContain('no reconoce');
  });

  it('pasarse de tamaño se rechaza con el peso y el tope, en KB', () => {
    const out = checkLogoFile(archivo('image/png', LOGO_MAX_BYTES + 1));
    expect(out.ok).toBe(false);
    expect(out.error).toContain('96 KB');
  });

  it('justo en el tope entra; el archivo vacío y el que no existe, no', () => {
    expect(checkLogoFile(archivo('image/png', LOGO_MAX_BYTES)).ok).toBe(true);
    expect(checkLogoFile(archivo('image/png', 0)).ok).toBe(false);
    expect(checkLogoFile(null).ok).toBe(false);
  });

  it('un archivo SIN tamaño se rechaza, no se cuela por la puerta de atrás', () => {
    // `undefined <= 0` es false: comparar sin normalizar dejaría pasar esto.
    expect(checkLogoFile({ type: 'image/png' }).ok).toBe(false);
    expect(checkLogoFile(archivo('image/png', undefined)).ok).toBe(false);
    expect(checkLogoFile(archivo('image/png', 'mucho')).ok).toBe(false);
    // Un «1024» en texto no es un tamaño: es la señal de que esto no es un File.
    expect(checkLogoFile(archivo('image/png', '1024')).ok).toBe(false);
  });
});

describe('qué se pinta en la cabecera', () => {
  const svg = 'data:image/svg+xml;base64,PHN2Zy8+';

  it('el data URI guardado, cuando lo es y es de un formato aceptado', () => {
    const png = `data:image/png;base64,${Buffer.from('un png de mentira').toString('base64')}`;
    expect(logoSrcFrom({ logo: svg })).toBe(svg);
    expect(logoSrcFrom({ logo: png })).toBe(png);
  });

  it('sin logo configurado, nada: la cabecera se queda con la marca de GREBLA', () => {
    expect(logoSrcFrom({})).toBeNull();
    expect(logoSrcFrom(null)).toBeNull();
    expect(logoSrcFrom({ logo: '' })).toBeNull();
  });

  it('un data URI con el prefijo bueno pero SIN contenido tampoco se pinta', () => {
    // Comprobar solo el prefijo dejaba pasar esto, y lo que se ve entonces es un
    // icono roto con la marca de GREBLA ya escondida.
    expect(logoSrcFrom({ logo: 'data:image/png;base64,' })).toBeNull();
    expect(logoSrcFrom({ logo: 'data:image/png;base64,AA' })).toBeNull();
    expect(logoSrcFrom({ logo: 'data:image/svg+xml;base64,no es base64!!' })).toBeNull();
    expect(logoSrcFrom({ logo: 'data:image/png;base64,AAAAAAAAA' })).toBeNull(); // no múltiplo de 4
  });

  it('ni uno que se pase del tope de tamaño, aunque esté bien formado', () => {
    const gigante = `data:image/png;base64,${'A'.repeat(4 * 40_000)}`;
    expect(logoSrcFrom({ logo: gigante })).toBeNull();
  });

  it('un valor que no es un data URI aceptado NO se pinta', () => {
    // Mejor la marca de GREBLA que un icono roto — o que una URL ajena metida a
    // mano en la configuración y cargada desde nuestra cabecera.
    expect(logoSrcFrom({ logo: 'https://ajeno.example/logo.png' })).toBeNull();
    expect(logoSrcFrom({ logo: 'data:text/html;base64,PGgxPg==' })).toBeNull();
    expect(logoSrcFrom({ logo: 'javascript:alert(1)' })).toBeNull();
    expect(logoSrcFrom({ logo: 42 })).toBeNull();
  });
});

describe('el texto alternativo', () => {
  it('nombra la casa cuando está configurada', () => {
    expect(logoAltFrom({ orgName: 'TRIBBU' })).toBe('Logo de TRIBBU');
  });

  it('y nunca queda vacío: un alt en blanco es un hueco para quien no ve', () => {
    expect(logoAltFrom({ orgName: '   ' })).toBe('Logo de la organización');
    expect(logoAltFrom(null)).toBe('Logo de la organización');
  });
});
