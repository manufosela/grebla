/**
 * <delivery-app> — cómo entrega la organización (RMR-TSK-0602).
 *
 * Los números los calcula el portal, que es quien tiene las fuentes; aquí solo
 * se pintan. Y lo que se pinta lo decide `deliverySummary`, no esta plantilla:
 * las decisiones interesantes de estas métricas son las de NO enseñar un número
 * —sin fuente, sin señal, poca base— y repartirlas por el HTML es como se acaban
 * perdiendo.
 *
 * Tres cosas que esta pantalla hace a propósito:
 *
 *  - **Los cuatro DORA salen siempre**, incluidos los dos que esta organización
 *    no puede medir, con su motivo. Un hueco que se quita invita a rellenarlo con
 *    la métrica de al lado, y la de al lado mide otra cosa.
 *  - **Los avisos van pegados al número**, no al pie. Que la frecuencia suba y la
 *    tasa de fallo no se mueva tiene explicación, y una explicación que hay que
 *    ir a buscar no la lee nadie.
 *  - **Si no se pudo leer, se dice qué pasó** y no se pinta nada. Una pantalla de
 *    ceros se lee como «no entregamos», que es una respuesta, no un error.
 */
import { LitElement, html, css } from 'lit';
import { tableStyles } from '../common/table-styles.js';
import { skeletonLines } from '../app-skeleton.js';
import { deliverySummary, repoRowFor, sparkPoints, currentWeek, ROW_STATES } from '../../tools/metrics/domain/deliverySummary.js';
import { reposSinSenal } from '../../tools/metrics/domain/portalMetrics.js';
// El dominio da horas crudas porque elegir entre «h» y «d» es presentación, y
// eso se decide aquí. `formatHours` devuelve null sin medida, no «0 h».
import { formatHours } from '../../tools/metrics/domain/duration.js';

/** El veredicto, dicho en palabras. La IA devuelve una de estas tres. */
const VERDICT_LABEL = Object.freeze({
  bien: '🟢 Va bien',
  regular: '🟡 Va regular',
  mal: '🔴 Va mal',
});

/** Series de la foto global que merecen una línea de 12 semanas. */
const SPARKS = Object.freeze([
  ['deploys', 'Despliegues'],
  ['wip', 'Trabajo en curso'],
  ['throughput', 'Entregado'],
]);

export class DeliveryApp extends LitElement {
  static properties = {
    /** Lo leído del portal, ya normalizado. `null` mientras carga. */
    metrics: { attribute: false },
    /** Qué pasó si no se pudo leer: `{ message, reason }`. */
    error: { attribute: false },
    /** Interpretación vigente guardada, o null si nadie la ha pedido. */
    interpretation: { attribute: false },
    /** Quién puede pedir una nueva (el superadmin). */
    canInterpret: { attribute: false },
    /** Quien la pide (inyectado): esta pantalla no sabe de Cloud Functions. */
    interpret: { attribute: false },
    _tab: { state: true },
    _interpreting: { state: true },
    _interpretError: { state: true },
  };

  static styles = [tableStyles, css`
    :host { display: block; color: var(--rm-text, #111827); }
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; margin: 0 0 1.2rem;
      background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; }
    .tab { background: none; border: 0; border-radius: 9px; padding: 0.5rem 1.15rem; font: inherit;
      font-weight: 600; font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; }
    .tab.on { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }

    .rows { display: grid; gap: 0.1rem; max-width: 46rem; }
    .metric { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem 1rem; align-items: baseline;
      padding: 0.7rem 0.2rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .metric .name { font-size: 0.95rem; font-weight: 600; }
    .metric .val { font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
    .metric .note { grid-column: 1 / -1; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); line-height: 1.45; }
    /* Sin fuente NO se pinta como un valor apagado: es otra cosa, y tiene que
       verse que lo es. */
    .val.none { font-size: 1rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }

    .sparks { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 1rem; margin: 1.6rem 0 0; }
    .spark { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.7rem 0.8rem; background: var(--rm-surface, #fff); }
    .spark h3 { margin: 0 0 0.4rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--rm-muted, #5b6b7d); font-weight: 700; }
    .spark svg { display: block; width: 100%; height: 2.6rem; }
    .spark .flat { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }

    .warn { margin: 1.4rem 0 0; padding: 0.7rem 0.9rem; border-radius: 10px; font-size: 0.85rem; line-height: 1.5;
      border: 1px solid var(--rm-info-border, #bfd6fb); border-left: 4px solid var(--rm-info, #2563eb);
      background: var(--rm-info-soft, #eff5ff); color: var(--rm-info-text, #1e3a8a); max-width: 60ch; }
    .warn ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
    .error { margin: 0; padding: 0.9rem 1rem; border-radius: 10px; max-width: 60ch; line-height: 1.55;
      border: 1px solid var(--rm-danger, #dc2626); background: color-mix(in srgb, var(--rm-danger, #dc2626) 8%, transparent); }
    .error strong { display: block; margin-bottom: 0.3rem; }
    .foot { margin: 1.4rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); line-height: 1.5; max-width: 60ch; }
    .muted { color: var(--rm-muted, #5b6b7d); }

    /* ── Lectura con IA (RMR-TSK-0610) ── */
    .interp { margin: 2rem 0 0; padding: 1.1rem 1.2rem; max-width: 60ch;
      border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; background: var(--rm-surface, #fff); }
    .interp-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .interp h3 { margin: 0; font-size: 1rem; }
    .interp h4 { margin: 1rem 0 0.3rem; font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); }
    .interp ul { margin: 0; padding-left: 1.1rem; font-size: 0.9rem; line-height: 1.55; }
    .interp-summary { margin: 0.5rem 0 0; font-size: 0.95rem; line-height: 1.6; }
    .interp-btn { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); border: 0;
      border-radius: 9px; padding: 0.45rem 0.9rem; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
    .interp-btn:disabled { opacity: 0.6; cursor: default; }
    .interp-btn:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    /* El veredicto lleva emoji Y palabra: el color solo no vale para quien no lo
       distingue, y aquí el color no es más que refuerzo. */
    .verdict { margin: 0.8rem 0 0; font-weight: 700; font-size: 0.95rem; }
  `];

  constructor() {
    super();
    this.metrics = null;
    this.error = null;
    this.interpretation = null;
    this.canInterpret = false;
    /** @type {((summary: unknown) => Promise<object>)|null} */
    this.interpret = null;
    this._tab = 'global';
    this._interpreting = false;
    this._interpretError = '';
  }

  render() {
    // El error manda sobre lo demás: sin datos no hay pantalla que pintar, y
    // unos ceros se leerían como «no entregamos».
    if (this.error) return this._renderError();
    if (!this.metrics) return skeletonLines(8);
    return html`
      <div class="tabs" role="tablist" aria-label="Entrega">
        ${this._renderTab('global', 'Global')}
        ${this._renderTab('repos', 'Por repositorio')}
      </div>
      ${this._tab === 'global' ? this._renderGlobal() : this._renderRepos()}
      ${this._renderFoot()}`;
  }

  _renderTab(id, label) {
    return html`<button class="tab ${this._tab === id ? 'on' : ''}" type="button" role="tab"
      aria-selected=${this._tab === id ? 'true' : 'false'}
      @click=${() => { this._tab = id; }}>${label}</button>`;
  }

  /** Qué pasó, para poder arreglarlo sin ir a los logs. */
  _renderError() {
    return html`<p class="error" role="alert">
      <strong>No se han podido leer las métricas.</strong>
      ${this.error.message}
    </p>`;
  }

  _renderGlobal() {
    const filas = deliverySummary(this.metrics);
    if (filas.length === 0) return html`<p class="muted">El portal no ha devuelto ninguna semana todavía.</p>`;
    return html`
      <div class="rows">${filas.map((f) => this._renderMetric(f))}</div>
      <div class="sparks">${SPARKS.map(([key, label]) => this._renderSpark(key, label))}</div>
      ${this._renderCoverage()}
      ${this._renderInterpretation(filas)}`;
  }

  /**
   * Interpretación con IA (RMR-TSK-0610). Va DEBAJO de los números, nunca en su
   * lugar: primero lo medido, después lo opinado — aunque lo opinado se lea más
   * fácil, que es precisamente el riesgo.
   *
   * Se le manda el MISMO resumen que está en pantalla, así que no puede
   * interpretar algo distinto de lo que se ve.
   */
  _renderInterpretation(filas) {
    const i = this.interpretation;
    if (!i && !this.canInterpret) return null;
    return html`
      <section class="interp">
        <div class="interp-head">
          <h3>Lectura con IA</h3>
          ${this.canInterpret
            ? html`<button class="interp-btn" type="button" ?disabled=${this._interpreting}
                @click=${() => this._interpret(filas)}>
                ${this._interpreting ? 'Interpretando…' : (i ? 'Volver a interpretar' : 'Interpretar')}
              </button>`
            : null}
        </div>
        ${this._interpretError ? html`<p class="error" role="alert">${this._interpretError}</p>` : null}
        ${i ? this._renderInterpretationBody(i) : html`<p class="muted">Nadie la ha pedido todavía.</p>`}
      </section>`;
  }

  _renderInterpretationBody(i) {
    const cuando = typeof i.at === 'string' ? i.at.slice(0, 10) : null;
    return html`
      <p class="verdict ${i.verdict ?? ''}">${VERDICT_LABEL[i.verdict] ?? 'Sin veredicto'}</p>
      <p class="interp-summary">${i.summary}</p>
      ${this._renderInterpretationList('Causas probables', i.causes)}
      ${this._renderInterpretationList('Qué se puede hacer', i.recommendations)}
      <p class="foot">
        La escribe una IA a partir de estos mismos números: es una lectura, no una
        medida. ${cuando ? `Generada el ${cuando}${i.by?.name ? ` por ${i.by.name}` : ''}.` : ''}
      </p>`;
  }

  _renderInterpretationList(title, items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return html`<div class="interp-list"><h4>${title}</h4>
      <ul>${items.map((t) => html`<li>${t}</li>`)}</ul></div>`;
  }

  async _interpret(filas) {
    if (!this.interpret) return;
    this._interpreting = true;
    this._interpretError = '';
    try {
      // Se manda el resumen YA CALCULADO, el de la pantalla: si la IA leyera las
      // métricas por su cuenta podría interpretar otra semana que la que se ve.
      this.interpretation = await this.interpret(filas);
    } catch (err) {
      console.error('[entrega] no se pudo interpretar:', err);
      this._interpretError = 'No se pudo interpretar. Inténtalo de nuevo en un momento.';
    } finally {
      this._interpreting = false;
    }
  }

  _renderMetric(f) {
    const sinNumero = f.state === ROW_STATES.sinFuente || f.state === ROW_STATES.sinDato;
    const texto = f.state === ROW_STATES.sinFuente ? 'sin fuente' : '—';
    return html`
      <div class="metric">
        <span class="name">${f.label}</span>
        <span class="val ${sinNumero ? 'none' : ''}">${f.value ?? texto}</span>
        ${f.note ? html`<span class="note">${f.note}</span>` : null}
        ${f.help ? html`<span class="note">${f.help}</span>` : null}
      </div>`;
  }

  _renderSpark(key, label) {
    const puntos = sparkPoints(this.metrics.series, key);
    if (!puntos) {
      return html`<div class="spark"><h3>${label}</h3><p class="flat">Sin serie suficiente.</p></div>`;
    }
    // viewBox 0..100 x 0..30, con la y invertida: en SVG crece hacia abajo.
    const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 100).toFixed(1)},${(30 - p.y * 28 - 1).toFixed(1)}`).join(' ');
    return html`
      <div class="spark">
        <h3>${label}</h3>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img"
          aria-label="${label}: ${puntos.length} semanas con medida">
          <path d=${d} fill="none" stroke="var(--rm-accent, #2a9d8f)" stroke-width="1.6"
            vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        </svg>
      </div>`;
  }

  /**
   * Lo que se cuenta pero nunca puede fallar, y lo que ni se cuenta. Va aquí, al
   * lado de los números, y no en una nota al pie que nadie abre.
   */
  _renderCoverage() {
    const sinSenal = reposSinSenal(this.metrics);
    const fuera = this.metrics.cobertura.fueraDeCobertura;
    if (sinSenal.length === 0 && fuera.length === 0) return null;
    return html`
      <div class="warn">
        ${sinSenal.length > 0
          ? html`<p style="margin:0">
              Estos repos cuentan despliegues pero no si salieron bien, así que suben la
              frecuencia y nunca mueven la tasa de fallo: <strong>${sinSenal.join(', ')}</strong>.
            </p>`
          : null}
        ${fuera.length > 0 ? this._renderFueraDeCobertura(fuera) : null}
      </div>`;
  }

  /** Los que ni siquiera entran en la cuenta, cada uno con su motivo. */
  _renderFueraDeCobertura(fuera) {
    return html`
      <p style="margin:0.5rem 0 0">Y estos no entran en la cuenta:</p>
      <ul>${fuera.map((f) => this._renderFuera(f))}</ul>`;
  }

  _renderFuera(f) {
    return html`<li><strong>${f.repo}</strong>: ${f.motivo}</li>`;
  }

  _renderRepos() {
    const filas = (this.metrics.repos ?? []).map(repoRowFor);
    if (filas.length === 0) return html`<p class="muted">Ningún repositorio con actividad en la ventana.</p>`;
    return html`
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Repositorio</th><th class="num">PRs mergeadas</th><th class="num">Revisadas</th>
              <th class="num">Lead time (mediana)</th><th class="num">p85</th>
            </tr>
          </thead>
          <tbody>${filas.map((r) => this._renderRepoRow(r))}</tbody>
        </table>
      </div>`;
  }

  _renderRepoRow(r) {
    // Sin PRs revisadas no hay muestra de lead time: raya, no cero. Un cero diría
    // «entregan al instante», que es lo contrario de «no lo sabemos».
    return html`
      <tr>
        <td>${r.repo}</td>
        <td class="num">${r.mergedPRs ?? '—'}</td>
        <td class="num">${r.reviewedPRs ?? '—'}</td>
        <td class="num">${formatHours(r.leadTimeMedianH) ?? '—'}</td>
        <td class="num">${formatHours(r.leadTimeP85H) ?? '—'}</td>
      </tr>`;
  }

  /** De cuándo son estos números, y si la semana está a medias. */
  _renderFoot() {
    const semana = currentWeek(this.metrics);
    const parcial = semana?.parcial
      ? ' La semana en curso está a medias, así que sus totales todavía van a subir.'
      : '';
    const desde = this.metrics.dataUpdatedAt
      ? `Datos del portal hasta ${this.metrics.dataUpdatedAt.slice(0, 10)}.`
      : 'El portal no ha dicho de cuándo son los datos.';
    return html`<p class="foot">
      ${desde}${parcial} Esto mide cómo entrega el equipo, no a las personas: no sirve
      para valorar a nadie.
    </p>`;
  }
}

customElements.define('delivery-app', DeliveryApp);
