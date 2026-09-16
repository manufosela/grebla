import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline } from './markdown.js';

const text = (v) => ({ t: 'text', v });

describe('parseInline', () => {
  it('negrita, cursiva, tachado, código y enlace http(s)', () => {
    expect(parseInline('a **b** _c_ ~~d~~ `e` [f](https://x.io/p)')).toEqual([
      text('a '), { t: 'b', c: [text('b')] }, text(' '), { t: 'i', c: [text('c')] }, text(' '),
      { t: 's', c: [text('d')] }, text(' '), { t: 'code', v: 'e' }, text(' '),
      { t: 'a', href: 'https://x.io/p', c: [text('f')] },
    ]);
  });

  it('un enlace que no es http(s) se queda como texto: nada de javascript:', () => {
    expect(parseInline('[ir](javascript:alert(1))')).toEqual([text('[ir](javascript:alert(1))')]);
  });

  it('el HTML escrito es texto, nunca marcado', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([text('<img src=x onerror=alert(1)>')]);
  });

  it('asteriscos sueltos no rompen nada', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([text('2 '), { t: 'i', c: [text(' 3 ')] }, text(' 4')]);
    expect(parseInline('**')).toEqual([text('**')]);
  });
});

describe('parseMarkdown', () => {
  it('títulos, párrafos con saltos, listas con casillas, cita y código', () => {
    const md = '## Criterios\nComo usuario quiero entrar.\nY salir.\n\n- [x] Botón de login\n- [ ] Cuenta vinculada\n- Sin romper nada\n\n1. uno\n2. dos\n\n> nota\n\n```\nconst x = 1;\n```';
    const b = parseMarkdown(md);
    expect(b[0]).toEqual({ type: 'h', level: 2, c: [text('Criterios')] });
    expect(b[1]).toEqual({ type: 'p', c: [text('Como usuario quiero entrar.'), { t: 'br' }, text('Y salir.')] });
    expect(b[2]).toEqual({ type: 'ul', items: [
      { c: [text('Botón de login')], checked: true },
      { c: [text('Cuenta vinculada')], checked: false },
      { c: [text('Sin romper nada')], checked: null },
    ] });
    expect(b[3]).toEqual({ type: 'ol', items: [{ c: [text('uno')], checked: null }, { c: [text('dos')], checked: null }] });
    expect(b[4]).toEqual({ type: 'quote', c: [text('nota')] });
    expect(b[5]).toEqual({ type: 'code', text: 'const x = 1;' });
  });

  it('lo que no reconoce queda como texto: nada se pierde', () => {
    expect(parseMarkdown('| a | b |\n|---|---|')).toEqual([{ type: 'p', c: [text('| a | b |'), { t: 'br' }, text('|---|---|')] }]);
  });

  it('vacío o no texto: sin bloques', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
    expect(parseMarkdown('\n\n')).toEqual([]);
  });

  it('un bloque de código sin cierre llega hasta el final', () => {
    expect(parseMarkdown('```\na\nb')).toEqual([{ type: 'code', text: 'a\nb' }]);
  });
});
