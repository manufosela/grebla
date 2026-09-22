/**
 * <docs-reader> — la documentación de la organización, para leerla
 * (RMR-PCS-0041).
 *
 * Los documentos son presentaciones HTML completas, así que se muestran TAL
 * CUAL, en un visor a pantalla completa: meterlas dentro de la maqueta de GREBLA
 * las rompería.
 *
 * DOS DECISIONES DE SEGURIDAD, las dos necesarias:
 *
 * 1. El documento se abre con un token de visionado (`openDoc`, con sesión) de
 *    UN documento y con caducidad, no con `getDownloadURL`: esa URL lleva un
 *    token que funciona sin sesión, para siempre, y se puede reenviar. El
 *    documento dejaría de ser interno en cuanto alguien copiara el enlace.
 *
 * 2. Se pinta desde OTRO ORIGEN: lo sirve la Cloud Function `serveDoc` con el
 *    suyo (RMR-BUG-0124). Un documento con un script no puede leer la sesión ni
 *    los datos de personas de quien lo abre porque no está en nuestro origen;
 *    quien publica es de confianza, pero «de confianza» no es un control. Antes
 *    iba en un iframe aislado (blob URL sin `allow-same-origin`) y eso rompía
 *    la vista del orador de reveal.js: el popup solo habla con una presentación
 *    de SU MISMO origen y carga una copia por URL, y un origen opaco no tiene
 *    ni lo uno ni lo otro. El `sandbox` que queda no aísla el origen (ya lo es):
 *    quita lo que una presentación no necesita, como navegar esta pestaña.
 */
import { LitElement, html, css } from 'lit';
import { listDocs, openDocView, downloadDocUrl } from '../../lib/docs.js';
import { groupByFolder } from '../../tools/docs/domain/paths.js';
import { skeletonLines } from '../app-skeleton.js';

export class DocsReader extends LitElement {
  static properties = {
    ready: { type: Boolean },
    canManage: { type: Boolean },
    _docs: { state: true },
    _loading: { state: true },
    _opening: { state: true },
    _downloading: { state: true },
    _viewing: { state: true },
    _src: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .folder { margin-bottom: 1.6rem; }
    .folder h2 { margin: 0 0 0.6rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rm-muted, #5b6b7d); }
    .docs { display: grid; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); gap: 1rem; }
    .doc {
      display: flex; flex-direction: column; gap: 0.4rem; text-align: left;
      padding: 1.1rem 1.2rem 1.2rem; font: inherit; cursor: pointer;
      border: 1px solid var(--rm-border, #d7dee2); border-radius: 12px;
      background: var(--rm-surface, #fff); color: inherit;
    }
    .doc:hover { border-color: var(--rm-accent, #2a9d8f); }
    .doc:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .doc[disabled] { opacity: 0.6; cursor: progress; }
    .doc h3 { margin: 0; font-size: 1rem; color: var(--rm-navy, #1e3a5f); }
    .doc p { margin: 0; font-size: 0.87rem; color: var(--rm-muted, #5b6b7d); line-height: 1.5; }
    /* La tarjeta es el botón de abrir y la descarga va aparte: un botón dentro
       de otro no es HTML válido, y además son dos acciones distintas. */
    .doc-card { display: flex; flex-direction: column; }
    .doc-card .doc { flex: 1; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
    .doc-download {
      font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer; text-align: left;
      padding: 0.5rem 1.2rem; color: var(--rm-muted, #5b6b7d);
      background: var(--rm-surface-hover, #f2f6f7);
      border: 1px solid var(--rm-border, #d7dee2); border-top: 0; border-radius: 0 0 12px 12px;
    }
    .doc-download:hover:not([disabled]) { color: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); }
    .doc-download:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .doc-download[disabled] { opacity: 0.6; cursor: progress; }
    :host([theme-dark]) .doc-download { background: #141b21; }
    .cta { margin-top: auto; padding-top: 0.6rem; font-size: 0.85rem; font-weight: 700; color: var(--rm-accent, #2a9d8f); }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
    :host([theme-dark]) .doc { background: #182028; }
    /* Visor: la presentación ocupa lo que pueda, con su barra para volver. */
    .viewer { display: flex; flex-direction: column; gap: 0.6rem; }
    .vbar { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; }
    .back { font: inherit; font-size: 0.88rem; font-weight: 600; border: 0; background: none; cursor: pointer; color: var(--rm-accent, #2a9d8f); padding: 0.2rem 0; }
    .back:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .vname { font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    iframe { width: 100%; height: min(80vh, 46rem); border: 1px solid var(--rm-border, #d7dee2); border-radius: 12px; background: #fff; }
    iframe:fullscreen { height: 100vh; border: 0; border-radius: 0; }
    .maximize { margin-left: auto; }
  `;

  constructor() {
    super();
    this.ready = false;
    this.canManage = false;
    this._docs = [];
    this._loading = true;
    this._opening = '';
    this._downloading = '';
    this._viewing = null;
    this._src = '';
    this._error = '';
  }

  updated(changed) {
    if (changed.has('ready') && this.ready) this._load();
  }

  async _load() {
    this._loading = true;
    try {
      this._docs = await listDocs();
    } catch (err) {
      this._error = `No se ha podido leer la documentación: ${err.message}`;
    } finally {
      this._loading = false;
    }
  }

  /** Abre el documento en el visor aislado. */
  async _open(doc) {
    if (this._opening) return;
    this._opening = doc.id;
    this._error = '';
    try {
      this._src = await openDocView(doc);
      this._viewing = doc;
    } catch (err) {
      this._error = `No se ha podido abrir «${doc.name}»: ${err.message}`;
    } finally {
      this._opening = '';
    }
  }

  _close() {
    this._src = '';
    this._viewing = null;
  }

  /**
   * Descarga el documento (RMR-TSK-0546). Pide su token como para verlo y deja
   * que el navegador guarde el fichero: la función lo entrega con
   * `Content-Disposition: attachment`. El enlace nace y muere aquí; no se pinta
   * en el DOM, porque una URL con token no es para copiarla ni reenviarla.
   * @param {{ id: string, name: string }} doc
   */
  async _download(doc) {
    if (this._downloading) return;
    this._downloading = doc.id;
    this._error = '';
    try {
      const url = await downloadDocUrl(doc);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.download = '';
      a.hidden = true;
      document.body.append(a);
      a.click();
      a.remove();
    } catch (err) {
      this._error = `No se ha podido descargar «${doc.name}»: ${err.message}`;
    } finally {
      this._downloading = '';
    }
  }

  /**
   * Visor: el documento en un iframe con el origen de `serveDoc` (ver la
   * cabecera). `allow-same-origin` aquí significa «el suyo», no el nuestro, y
   * hace falta: la vista del orador de reveal.js (tecla S, RMR-TSK-0528) abre
   * un popup que comprueba que el origen de su opener es el mismo que el suyo
   * y carga una copia de la presentación por URL. `allow-scripts` porque son
   * presentaciones y sin JS no pasan de diapositiva; `allow-popups` por esa
   * ventana; sin `allow-top-navigation`: el documento no navega esta pestaña.
   */
  _renderViewer() {
    return html`
      <div class="viewer">
        <div class="vbar">
          <button class="back" @click=${() => this._close()}>← Volver a la lista</button>
          <span class="vname">${this._viewing.name}</span>
          <button class="back maximize" @click=${() => this._maximize()} title="Pantalla completa (Esc para volver)">⛶ Maximizar</button>
        </div>
        <iframe title=${this._viewing.name} src=${this._src} allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
      </div>`;
  }

  /** La presentación a pantalla completa; Esc vuelve al visor. */
  async _maximize() {
    const frame = this.renderRoot.querySelector('iframe');
    if (!frame?.requestFullscreen) return;
    try {
      await frame.requestFullscreen();
      frame.focus();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo poner a pantalla completa.';
    }
  }

  _renderDoc(doc) {
    const bajando = this._downloading === doc.id;
    return html`
      <div class="doc-card">
        <button class="doc" data-doc-id=${doc.id} ?disabled=${this._opening === doc.id}
          @click=${() => this._open(doc)}>
          <h3>${doc.name}</h3>
          <p>${doc.description || ''}</p>
          <span class="cta">${this._opening === doc.id ? 'Abriendo…' : 'Abrir la presentación →'}</span>
        </button>
        <button class="doc-download" ?disabled=${bajando}
          aria-label=${`Descargar ${doc.name}`}
          @click=${() => this._download(doc)}>${bajando ? 'Preparando…' : '↓ Descargar'}</button>
      </div>`;
  }

  /** El aviso de que algo falló, aparte para no anidar plantillas. */
  _renderError() {
    if (!this._error) return null;
    return html`<p class="error">${this._error}</p>`;
  }

  /** Nada publicado todavía, con la salida para quien puede publicarlo. */
  _renderEmpty() {
    const subir = this.canManage
      ? html` Puedes subirla en <a href="/admin/documentos">Administración › Documentos</a>.`
      : null;
    return html`<p class="empty">Todavía no hay documentación publicada.${subir}</p>`;
  }

  render() {
    if (this._loading) return skeletonLines(4);
    if (this._viewing) return this._renderViewer();
    const { root, folders } = groupByFolder(this._docs);
    // El error va SIEMPRE primero: si la lectura falló, decir «no hay
    // documentación» sería contar como vacío lo que es una avería.
    const error = this._renderError();
    if (root.length === 0 && folders.length === 0) {
      // Si la lectura falló no se dice «no hay documentación»: no es lo mismo
      // estar vacío que estar roto.
      const vacio = this._error ? null : this._renderEmpty();
      return html`${error}${vacio}`;
    }
    // Cada trozo se compone aparte: plantillas dentro de plantillas dejan de
    // leerse a la tercera.
    const primerNivel = root.length ? this._renderGroup(null, root) : null;
    const carpetas = folders.map((f) => this._renderGroup(f.name, f.docs));
    return html`${error}${primerNivel}${carpetas}`;
  }

  /** Un grupo de documentos, con su rótulo si es una carpeta. */
  _renderGroup(title, docs) {
    const rotulo = title ? html`<h2>${title}</h2>` : null;
    return html`
      <div class="folder">
        ${rotulo}
        <div class="docs">${docs.map((d) => this._renderDoc(d))}</div>
      </div>`;
  }
}

if (!customElements.get('docs-reader')) {
  customElements.define('docs-reader', DocsReader);
}
