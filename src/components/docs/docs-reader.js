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
 * 1. El contenido se trae con `getBlob`, que pasa por las reglas de Storage. Con
 *    `getDownloadURL` sería más corto, pero esa URL lleva un token que funciona
 *    sin sesión y se puede reenviar: el documento dejaría de ser interno en
 *    cuanto alguien copiara el enlace.
 *
 * 2. Se pinta en un IFRAME AISLADO —`sandbox="allow-scripts"`, sin
 *    `allow-same-origin`—. Un blob URL hereda el origen de la aplicación, así
 *    que abrirlo sin más dejaría que un documento con un script leyera la sesión
 *    y los datos de personas de quien lo abre. Aquí quien publica es de
 *    confianza, pero «de confianza» no es un control: basta un documento
 *    reenviado o una cuenta comprometida. Dentro del sandbox el documento se
 *    ejecuta —lo necesita: son presentaciones con JS— sin poder tocar nada
 *    nuestro.
 */
import { LitElement, html, css } from 'lit';
import { listDocs, fetchDocBlob } from '../../lib/docs.js';
import { groupByFolder } from '../../tools/docs/domain/paths.js';
import { skeletonLines } from '../app-skeleton.js';

export class DocsReader extends LitElement {
  static properties = {
    ready: { type: Boolean },
    canManage: { type: Boolean },
    _docs: { state: true },
    _loading: { state: true },
    _opening: { state: true },
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
      const blob = await fetchDocBlob(doc.path);
      this._revoke();
      this._src = URL.createObjectURL(blob);
      this._viewing = doc;
    } catch (err) {
      this._error = `No se ha podido abrir «${doc.name}»: ${err.message}`;
    } finally {
      this._opening = '';
    }
  }

  /** Suelta el blob al cerrar: si no, el documento se queda en memoria. */
  _revoke() {
    if (this._src) URL.revokeObjectURL(this._src);
    this._src = '';
  }

  _close() {
    this._revoke();
    this._viewing = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._revoke();
  }

  /**
   * Visor: el documento dentro de un iframe SIN `allow-same-origin`, que es lo
   * que lo deja fuera de nuestro origen. `allow-scripts` sí, porque son
   * presentaciones y sin JS no pasan de diapositiva.
   *
   * `allow-popups-to-escape-sandbox` (RMR-TSK-0528): las notas del presentador
   * de reveal.js (tecla S) abren un about:blank y le escriben dentro; si ese
   * popup hereda el sandbox nace con OTRO origen opaco y la ventana queda en
   * blanco (comprobado). Al escapar, el popup toma el origen opaco de su
   * creador —no el nuestro—, así que sigue sin poder tocar GREBLA.
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
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>
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
    return html`
      <button class="doc" data-doc-id=${doc.id} ?disabled=${this._opening === doc.id}
        @click=${() => this._open(doc)}>
        <h3>${doc.name}</h3>
        <p>${doc.description || ''}</p>
        <span class="cta">${this._opening === doc.id ? 'Abriendo…' : 'Abrir la presentación →'}</span>
      </button>`;
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
