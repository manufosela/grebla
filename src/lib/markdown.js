/**
 * Markdown → árbol de bloques (RMR-TSK-0527). Puro y SIN HTML: nunca produce
 * cadenas para innerHTML, solo una estructura que un componente pinta con
 * nodos propios. Así el texto de terceros (la descripción de una historia de
 * Linear) se ve con formato sin que nada de lo que traiga pueda ejecutarse:
 * el HTML que venga escrito se ve como texto, y solo los enlaces http(s) son
 * enlaces.
 *
 * Cubre lo que usa Linear a diario: títulos, párrafos, listas (con casillas),
 * citas, bloques de código, negrita, cursiva, tachado, código en línea y
 * enlaces. Lo que no reconoce lo deja como texto: nada se pierde.
 *
 * @typedef {{ t: 'text', v: string }|{ t: 'br' }|{ t: 'code', v: string }|{ t: 'b'|'i'|'s', c: Inline[] }|{ t: 'a', href: string, c: Inline[] }} Inline
 * @typedef {{ type: 'h', level: number, c: Inline[] }|{ type: 'p', c: Inline[] }|{ type: 'quote', c: Inline[] }|{ type: 'code', text: string }|{ type: 'ul'|'ol', items: Array<{ c: Inline[], checked: boolean|null }> }} Block
 */

const SAFE_HREF = /^https?:\/\/[^\s<>"']+$/i;
const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\n]+\*|_[^_\n]+_)/;

/** Texto en línea → inlines. Reconoce un nivel de énfasis; lo demás es texto. */
export function parseInline(text) {
  const out = [];
  const parts = String(text ?? '').split(INLINE_TOKEN);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) out.push({ t: 'b', c: [{ t: 'text', v: part.slice(2, -2) }] });
    else if (part.startsWith('__') && part.endsWith('__') && part.length > 4) out.push({ t: 'b', c: [{ t: 'text', v: part.slice(2, -2) }] });
    else if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) out.push({ t: 's', c: [{ t: 'text', v: part.slice(2, -2) }] });
    else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) out.push({ t: 'code', v: part.slice(1, -1) });
    else if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) out.push(link(part));
    else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      if (part.length > 2) out.push({ t: 'i', c: [{ t: 'text', v: part.slice(1, -1) }] });
      else out.push({ t: 'text', v: part });
    } else out.push({ t: 'text', v: part });
  }
  return mergeText(out);
}

/** Dos textos seguidos son un texto: lo que un token a medias deja partido vuelve a juntarse. */
function mergeText(inlines) {
  return inlines.reduce((acc, n) => {
    const last = acc.at(-1);
    if (n.t === 'text' && last?.t === 'text') last.v += n.v;
    else acc.push(n);
    return acc;
  }, []);
}

/** [texto](url): enlace solo si la url es http(s); si no, se queda como texto tal cual. */
function link(part) {
  const i = part.indexOf('](');
  const label = part.slice(1, i);
  const href = part.slice(i + 2, -1);
  return SAFE_HREF.test(href) ? { t: 'a', href, c: [{ t: 'text', v: label }] } : { t: 'text', v: part };
}

/** Las líneas de un párrafo, unidas con saltos de línea. */
function paragraph(lines) {
  const c = [];
  lines.forEach((line, k) => {
    if (k > 0) c.push({ t: 'br' });
    c.push(...parseInline(line.trim()));
  });
  return c;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const CHECK = /^\[([ xX])\]\s+(.*)$/;

/**
 * Markdown → bloques.
 * @param {unknown} text
 * @returns {Block[]}
 */
export function parseMarkdown(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', c: paragraph(para) }); para = []; } };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      flush();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i += 1; }
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    if (line.trim() === '') { flush(); continue; }
    const h = HEADING.exec(line);
    if (h) { flush(); blocks.push({ type: 'h', level: h[1].length, c: parseInline(h[2].trim()) }); continue; }
    if (line.startsWith('>')) {
      flush();
      const quote = [line.replace(/^>\s?/, '')];
      while (i + 1 < lines.length && lines[i + 1].startsWith('>')) { i += 1; quote.push(lines[i].replace(/^>\s?/, '')); }
      blocks.push({ type: 'quote', c: paragraph(quote) });
      continue;
    }
    const kind = BULLET.test(line) ? 'ul' : (NUMBERED.test(line) ? 'ol' : null);
    if (kind) {
      flush();
      const items = [];
      let j = i;
      while (j < lines.length) {
        const m = kind === 'ul' ? BULLET.exec(lines[j]) : NUMBERED.exec(lines[j]);
        if (!m) break;
        const check = CHECK.exec(m[1]);
        items.push(check
          ? { c: parseInline(check[2]), checked: check[1] !== ' ' }
          : { c: parseInline(m[1]), checked: null });
        j += 1;
      }
      blocks.push({ type: kind, items });
      i = j - 1;
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
