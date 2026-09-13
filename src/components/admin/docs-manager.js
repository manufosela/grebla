/**
 * <docs-manager> — gestor de DOCUMENTOS de la organización (RMR-PCS-0041).
 *
 * Aquí se publican los HTML que explican cómo trabajamos: se suben, se les pone
 * nombre y carpeta, y se retiran cuando dejan de valer. Sin desplegar nada, que
 * es lo que hacía falta.
 *
 * El fichero se sube a Storage —donde la regla decide quién lo lee— y sus datos
 * van a Firestore. Lo que se ve en la lista no es el fichero: es su nombre
 * legible, y por eso hay que pedirlo al subir.
 */
import { LitElement, html, css } from 'lit';
import { noteStyles } from '../common/note-styles.js';
import { listDocs, publishDoc, removeDoc } from '../../lib/docs.js';
import { groupByFolder, sanitizeFolder, sanitizeFileName, isHtmlFile } from '../../tools/docs/domain/paths.js';

export class DocsManager extends LitElement {
  static properties = {
    readOnly: { type: Boolean, attribute: 'read-only' },
    _docs: { state: true },
    _file: { state: true },
    _name: { state: true },
    _description: { state: true },
    _folder: { state: true },
    _confirmRemove: { state: true },
    _error: { state: true },
    _notice: { state: true },
    _busy: { state: true },
    _loading: { state: true },
  };

  static styles = [noteStyles, css`
    :host { display: block; }
    .form { display: grid; gap: 0.7rem; max-width: 40rem; margin-bottom: 1.6rem; }
    label { display: grid; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #1e3a5f); }
    input[type="text"], input[type="file"] { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    input:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 1px; }
    .hint { font-weight: 400; font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; padding: 0.45rem 1rem; border-radius: 999px; border: 0; cursor: pointer; background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #0c1420); }
    button[disabled] { opacity: 0.55; cursor: default; }
    button.link { background: none; color: var(--rm-danger, #b91c1c); padding: 0.2rem 0.4rem; text-decoration: underline; }
    .folder { margin-bottom: 1.2rem; }
    .folder h3 { margin: 0 0 0.4rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rm-muted, #5b6b7d); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    li { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; padding: 0.5rem 0.7rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 10px; }
    .dname { font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .ddesc { flex: 1; font-size: 0.83rem; color: var(--rm-muted, #5b6b7d); }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; }
    .msg { font-size: 0.85rem; margin: 0 0 0.9rem; }
    .msg.err { color: var(--rm-danger, #b91c1c); }
    .msg.ok { color: var(--rm-accent-700, #1f7a6e); }
  `];

  constructor() {
    super();
    this.readOnly = false;
    this._docs = [];
    this._file = null;
    this._name = '';
    this._description = '';
    this._folder = '';
    this._confirmRemove = null;
    this._error = '';
    this._notice = '';
    this._busy = false;
    this._loading = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  async _load() {
    this._loading = true;
    try {
      this._docs = await listDocs();
    } catch (err) {
      this._error = `No se han podido leer los documentos: ${err.message}`;
    } finally {
      this._loading = false;
    }
  }

  /**
   * Toma el fichero elegido y propone su nombre.
   *
   * Rechaza lo que no sea HTML AQUÍ, no al subir: dejar elegir un PDF y fallar
   * después de la subida es hacer perder el tiempo dos veces.
   */
  _pickFile(file) {
    this._error = '';
    this._notice = '';
    if (!file) { this._file = null; return; }
    if (!isHtmlFile(file)) {
      this._file = null;
      this._error = 'Por ahora solo se publican páginas HTML.';
      return;
    }
    this._file = file;
    if (!this._name.trim()) this._name = file.name.replace(/\.html?$/i, '');
  }

  async _publish() {
    if (!this._file) { this._error = 'Elige el fichero HTML.'; return; }
    if (!this._name.trim()) { this._error = 'Ponle un nombre al documento.'; return; }
    this._busy = true;
    this._error = '';
    try {
      await publishDoc({
        name: this._name,
        description: this._description,
        folder: this._folder,
        fileName: this._file.name,
        file: this._file,
      });
      this._notice = `«${this._name.trim()}» publicado.`;
      this._file = null;
      this._name = '';
      this._description = '';
      this._folder = '';
      this.renderRoot.querySelector('input[type="file"]').value = '';
      await this._load();
    } catch (err) {
      this._error = `No se ha podido publicar: ${err.message}`;
    } finally {
      this._busy = false;
    }
  }

  async _remove(doc) {
    this._busy = true;
    this._error = '';
    try {
      await removeDoc(doc);
      this._confirmRemove = null;
      this._notice = `«${doc.name}» retirado.`;
      await this._load();
    } catch (err) {
      this._error = `No se ha podido retirar: ${err.message}`;
    } finally {
      this._busy = false;
    }
  }

  /** Dónde va a quedar, dicho antes de subirlo: la ruta no se adivina. */
  get _destino() {
    const file = sanitizeFileName(this._file?.name);
    if (!file) return '';
    const folder = sanitizeFolder(this._folder);
    return folder ? `${folder}/${file}` : file;
  }

  _renderForm() {
    if (this.readOnly) return null;
    return html`
      <div class="form">
        <label>Fichero HTML
          <input type="file" accept=".html,.htm,text/html"
            @change=${(e) => this._pickFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>Nombre
          <input type="text" placeholder="p. ej. «GREBLA — marco de gestión de equipos»"
            .value=${this._name} @input=${(e) => { this._name = e.target.value; }} />
        </label>
        <label>De qué va
          <input type="text" placeholder="Una línea para saber si es lo que buscas"
            .value=${this._description} @input=${(e) => { this._description = e.target.value; }} />
        </label>
        <label>Carpeta
          <input type="text" placeholder="Vacío = primer nivel" list="docs-folders"
            .value=${this._folder} @input=${(e) => { this._folder = e.target.value; }} />
          <span class="hint">
            ${this._destino ? html`Quedará como <strong>${this._destino}</strong>.` : 'Vacío lo deja en el primer nivel.'}
          </span>
        </label>
        <datalist id="docs-folders">
          ${groupByFolder(this._docs).folders.map((f) => html`<option value=${f.name}></option>`)}
        </datalist>
        <div>
          <button ?disabled=${this._busy || !this._file} @click=${() => this._publish()}>
            ${this._busy ? 'Publicando…' : 'Publicar documento'}
          </button>
        </div>
      </div>`;
  }

  _renderDoc(doc) {
    const confirmando = this._confirmRemove === doc.id;
    return html`<li>
      <span class="dname">${doc.name}</span>
      <span class="ddesc">${doc.description || ''}</span>
      ${this.readOnly ? null : confirmando
        ? html`<button class="link" @click=${() => this._remove(doc)}>Confirmar</button>
               <button class="link" @click=${() => { this._confirmRemove = null; }}>Cancelar</button>`
        : html`<button class="link" @click=${() => { this._confirmRemove = doc.id; }}>Retirar</button>`}
    </li>`;
  }

  _renderList() {
    if (this._loading) return html`<p class="empty">Cargando…</p>`;
    const { root, folders } = groupByFolder(this._docs);
    if (root.length === 0 && folders.length === 0) {
      return html`<p class="empty">Todavía no hay ningún documento publicado.</p>`;
    }
    return html`
      ${root.length ? html`<div class="folder"><h3>Primer nivel</h3><ul>${root.map((d) => this._renderDoc(d))}</ul></div>` : null}
      ${folders.map((f) => html`<div class="folder"><h3>${f.name}</h3><ul>${f.docs.map((d) => this._renderDoc(d))}</ul></div>`)}`;
  }

  render() {
    return html`
      ${this._renderForm()}
      ${this._error ? html`<p class="msg err">${this._error}</p>` : null}
      ${this._notice ? html`<p class="msg ok">${this._notice}</p>` : null}
      ${this._renderList()}`;
  }
}

if (!customElements.get('docs-manager')) {
  customElements.define('docs-manager', DocsManager);
}
