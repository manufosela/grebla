/**
 * Exportación del framework de carrera a Markdown (RMR-TSK-0428).
 *
 * Función PURA framework → markdown: dimensiones con descripción y, por track,
 * cada nivel (código, título, etiqueta pública, perfil típico, descripción) con
 * sus expectativas por dimensión. Un nivel sin expectativas queda MARCADO, no
 * omitido — el hueco debe verse. Con `levelId` exporta solo ese nivel. Mismo
 * formato que el resumen validado por el usuario el 2026-08-05.
 */

/**
 * @param {{ name?: string, tracks?: any[], dimensions?: any[], levels?: any[], expectations?: any[] }} framework
 * @param {{ levelId?: string|null, generatedAt?: string }} [options] generatedAt en ISO (YYYY-MM-DD); el caller pone la fecha (pureza).
 * @returns {string}
 */
export function frameworkToMarkdown(framework, { levelId = null, generatedAt = '' } = {}) {
  const dims = framework?.dimensions ?? [];
  const tracks = framework?.tracks ?? [];
  const trackName = (id) => tracks.find((t) => t.id === id)?.name ?? id;
  const expOf = (lid, did) =>
    (framework?.expectations ?? []).find((e) => e.levelId === lid && e.dimensionId === did)?.text ?? null;

  let levels = (framework?.levels ?? []).toSorted((a, b) => a.order - b.order);
  if (levelId) {
    levels = levels.filter((l) => l.id === levelId);
    if (levels.length === 0) throw new Error(`No existe el nivel «${levelId}» en el framework.`);
  }

  const lines = [];
  lines.push(`# Framework de carrera — ${framework?.name ?? 'Engineering'}`);
  lines.push('');
  lines.push(
    `> Qué se espera de cada nivel, por dimensión.${generatedAt ? ` Generado el ${generatedAt}.` : ''} Se edita en GREBLA → panel → Carrera → framework.`,
  );
  lines.push('');
  lines.push('## Dimensiones');
  lines.push('');
  for (const d of dims) lines.push(`- **${d.name}**${d.description ? ` — ${d.description}` : ''}`);

  /** @type {Map<string, any[]>} */
  const byTrack = new Map();
  for (const l of levels) {
    if (!byTrack.has(l.trackId)) byTrack.set(l.trackId, []);
    byTrack.get(l.trackId).push(l);
  }
  for (const [trackId, trackLevels] of byTrack) {
    lines.push('');
    lines.push(`## Track ${trackName(trackId)}`);
    for (const l of trackLevels) {
      lines.push('');
      lines.push(`### ${l.code} · ${l.title}${l.publicLabel ? ` (etiqueta pública: ${l.publicLabel})` : ''}`);
      if (l.typicalProfile) lines.push(`*Perfil típico: ${l.typicalProfile}*`);
      if (l.description) {
        lines.push('');
        lines.push(l.description);
      }
      // TODAS las dimensiones, siempre: un hueco parcial debe VERSE, no
      // desaparecer en silencio (hallazgo de codex).
      lines.push('');
      for (const d of dims) {
        const text = expOf(l.id, d.id);
        lines.push(`- **${d.name}:** ${text ?? '_(sin expectativa definida todavía)_'}`);
      }
    }
  }
  return `${lines.join('\n')}\n`;
}
