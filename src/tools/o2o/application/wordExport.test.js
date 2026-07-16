/**
 * Tests del builder de documento Word del O2O (RMR-TSK-0232): HTML compatible
 * con Word a partir de la guía/formulario. Puro, sin DOM.
 */
import { describe, it, expect } from 'vitest';
import { buildO2ODocHtml, escapeHtml, o2oDocMeta, WORD_DOC_MIME } from './wordExport.js';

describe('o2oDocMeta', () => {
  it('da título y nombre según la batería', () => {
    expect(o2oDocMeta('guide')).toEqual({ title: 'Guía del O2O', filename: 'guia-o2o.doc' });
    expect(o2oDocMeta('form')).toEqual({ title: 'Preguntas previas al O2O', filename: 'preguntas-previas-o2o.doc' });
  });
});

describe('escapeHtml', () => {
  it('escapa los caracteres peligrosos', () => {
    expect(escapeHtml('a & b < c > d "e" \'f\'')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;');
  });
  it('trata null/undefined como cadena vacía', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('buildO2ODocHtml', () => {
  it('incluye la cabecera Office y el MIME es de Word', () => {
    const html = buildO2ODocHtml({ title: 'Guía del O2O', groups: [] });
    expect(html).toContain('urn:schemas-microsoft-com:office:word');
    expect(html).toContain('<h1>Guía del O2O</h1>');
    expect(WORD_DOC_MIME).toBe('application/msword');
  });

  it('renderiza la intro y las preguntas como lista ordenada', () => {
    const html = buildO2ODocHtml({
      title: 'Preguntas previas al O2O',
      intro: 'No hace falta que lo rellenes.',
      groups: [
        { title: 'Sobre tu día a día', questions: [{ text: '¿En qué se te va el tiempo?' }, { text: '¿Qué te genera fricción?' }] },
      ],
    });
    expect(html).toContain('<p>No hace falta que lo rellenes.</p>');
    expect(html).toContain('<h2>Sobre tu día a día</h2>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>¿En qué se te va el tiempo?</li>');
    expect(html).toContain('<li>¿Qué te genera fricción?</li>');
  });

  it('omite preguntas vacías y grupos sin título ni preguntas', () => {
    const html = buildO2ODocHtml({
      title: 'Guía del O2O',
      groups: [
        { title: 'Bloque 1', questions: [{ text: 'P1' }, { text: '   ' }, { text: '' }] },
        { title: '', questions: [] },
      ],
    });
    expect(html).toContain('<li>P1</li>');
    expect((html.match(/<li>/g) ?? []).length).toBe(1);
    expect(html).not.toContain('<h2></h2>');
  });

  it('escapa el contenido para no romper el HTML', () => {
    const html = buildO2ODocHtml({
      title: 'Guía',
      groups: [{ title: 'A & B', questions: [{ text: '¿1 < 2 && 3 > 2?' }] }],
    });
    expect(html).toContain('<h2>A &amp; B</h2>');
    expect(html).toContain('<li>¿1 &lt; 2 &amp;&amp; 3 &gt; 2?</li>');
  });
});
