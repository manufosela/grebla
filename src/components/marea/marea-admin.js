/**
 * <marea-admin> — pestaña «Administrar» de Marea (RMR-TSK-0496).
 *
 * El único valor que se toca aquí mueve lo que la herramienta enseña, así que
 * el texto tiene que decir exactamente lo que el código hace: el suelo de 3 es
 * intocable, por encima se ajusta en los dos sentidos, y bajarlo vuelve a
 * publicar grupos que estaban ocultos.
 *
 * Solo la ve quien GESTIONA la herramienta. Lo que se administra de Marea es
 * poco a propósito: el umbral de anonimato y la participación. No hay nada por
 * persona, ni lo habrá — el manager no ve la marea de nadie, y administrar no
 * puede ser la puerta de atrás a lo que la herramienta promete no enseñar.
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import { getMareaSettings, saveMareaMinCount } from '../../lib/toolSettings.js';
import { getRecentPulseAggregates } from '../../lib/pulse.js';
import { MIN_ANON, MAX_ANON, validateMinCount } from '../../tools/pulse/domain/settings.js';
import { parseWeekIso } from '../../tools/pulse/domain/pulse.js';
import { weekRangeLabel } from './weekLabel.js';
import '../common/busy-overlay.js';

export class MareaAdmin extends LitElement {
  static properties = {
    _minCount: { state: true },
    _guardado: { state: true },
    _semanas: { state: true },
    _cargando: { state: true },
    _saving: { state: true },
    _error: { state: true },
    _ok: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .box { border: 1px solid var(--rm-border, #dde7ec); border-radius: 14px; padding: 1rem 1.1rem; background: var(--rm-surface-hover, #f5fafa); margin-bottom: 1.3rem; }
    h3 { margin: 0 0 0.35rem; font-size: 0.95rem; color: var(--rm-navy, #1e3a5f); }
    p { margin: 0 0 0.7rem; font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); line-height: 1.5; max-width: 62ch; }
    .row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    label { font-size: 0.85rem; font-weight: 600; }
    input { width: 5rem; font: inherit; padding: 0.4rem 0.55rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, #fff); color: inherit; font-variant-numeric: tabular-nums; }
    input:focus-visible { outline: 2px solid var(--gr-teal, #2a9d8f); outline-offset: 1px; background: var(--rm-surface, #fff); }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; padding: 0.45rem 1rem; border-radius: 999px; border: 0; cursor: pointer; background: var(--gr-teal, #2a9d8f); color: var(--rm-on-accent, #0c1420); }
    button[disabled] { opacity: 0.55; cursor: default; }
    button:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: 2px; }
    .msg { font-size: 0.82rem; margin-top: 0.55rem; min-height: 1.2em; }
    .msg.err { color: var(--rm-danger, #b91c1c); }
    .msg.ok { color: var(--rm-accent-700, #1f7a6e); }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--rm-border, #dde7ec); }
    th { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #5b6b7d); }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .table-wrap { overflow-x: auto; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this._minCount = MIN_ANON;
    this._guardado = MIN_ANON;
    this._semanas = [];
    this._cargando = true;
    this._saving = false;
    this._error = '';
    this._ok = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this._cargar();
  }

  async _cargar() {
    this._cargando = true;
    try {
      const [ajustes, semanas] = await Promise.all([getMareaSettings(), getRecentPulseAggregates(12)]);
      this._minCount = ajustes.minCount;
      this._guardado = ajustes.minCount;
      // Más recientes primero: lo que se mira es la semana en curso.
      this._semanas = [...semanas].reverse();
    } catch (err) {
      this._error = `No se ha podido leer la configuración: ${err.message}`;
    } finally {
      this._cargando = false;
    }
  }

  async _guardar() {
    const check = validateMinCount(this._minCount);
    if (!check.ok) { this._error = check.reason; this._ok = ''; return; }
    this._saving = true;
    this._error = '';
    this._ok = '';
    const baja = this._minCount < this._guardado;
    try {
      await saveMareaMinCount(this._minCount);
      this._guardado = this._minCount;
      this._ok = baja
        ? 'Guardado. Al bajar el umbral, las semanas anteriores se están recalculando y volverán a publicar los grupos que ahora lo alcanzan.'
        : 'Guardado. Los resultados de las semanas anteriores se están recalculando con el nuevo umbral.';
      this._semanas = await getRecentPulseAggregates(12);
      this._semanas = [...this._semanas].reverse();
    } catch (err) {
      this._error = `No se ha podido guardar: ${err.message}`;
    } finally {
      this._saving = false;
    }
  }

  /** Etiqueta legible de una semana ISO: «Semana 30 · 20–26 jul». */
  static _semana(weekIso) {
    const w = parseWeekIso(weekIso);
    const rango = weekRangeLabel(weekIso);
    if (!w) return weekIso;
    return rango ? `Semana ${w.week} · ${rango}` : `Semana ${w.week} (${w.year})`;
  }

  _renderUmbral() {
    const sinCambios = this._minCount === this._guardado;
    return html`
      <section class="box">
        <h3>Umbral de anonimato</h3>
        <p>
          Cuánta gente tiene que haber marcado su marea para que un grupo enseñe
          su media. Por debajo del umbral no se publica nada de ese grupo: ni
          medias, ni palabras, ni recuento por dimensión.
        </p>
        <p>
          El mínimo de ${MIN_ANON} no se toca: es la promesa que se le hace a
          quien rellena su marea, no una preferencia. Por encima de ahí lo
          ajustas tú. Súbelo si los grupos son grandes —con ${MIN_ANON} personas
          en un gremio de treinta, quien las conoce ata cabos—; ten en cuenta que
          bajarlo vuelve a publicar grupos más pequeños que hasta ahora estaban
          ocultos.
        </p>
        <div class="row">
          <label for="min">Mínimo por grupo</label>
          <input id="min" type="number" inputmode="numeric" min=${MIN_ANON} max=${MAX_ANON}
            .value=${String(this._minCount)}
            @input=${(e) => { this._minCount = Number(e.target.value); this._ok = ''; this._error = ''; }} />
          <button ?disabled=${sinCambios || this._saving} @click=${() => this._guardar()}>Guardar umbral</button>
        </div>
        <p class="msg ${this._error ? 'err' : 'ok'}">${this._error || this._ok}</p>
      </section>
    `;
  }

  _renderParticipacion() {
    if (!this._semanas.length) {
      return html`<section class="box"><h3>Participación</h3><p class="empty">Todavía no hay ninguna semana con resultados.</p></section>`;
    }
    return html`
      <section class="box">
        <h3>Participación</h3>
        <p>
          Cuánta gente marcó su marea cada semana. Es un recuento: aquí no se ve
          quién respondió ni qué respondió.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Semana</th><th class="num">Respondieron</th><th class="num">De</th><th class="num">Umbral aplicado</th></tr>
            </thead>
            <tbody>
              ${this._semanas.map((s) => html`
                <tr>
                  <td>${MareaAdmin._semana(s.weekIso)}</td>
                  <td class="num">${s.respondents ?? 0}</td>
                  <td class="num">${s.totalPeople ?? '—'}</td>
                  <td class="num">${s.minCount ?? MIN_ANON}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  render() {
    if (this._cargando) return skeletonLines(6);
    return html`
      ${this._saving ? html`<busy-overlay message="Guardando el umbral…"></busy-overlay>` : null}
      ${this._renderUmbral()}
      ${this._renderParticipacion()}
    `;
  }
}

if (!customElements.get('marea-admin')) {
  customElements.define('marea-admin', MareaAdmin);
}
