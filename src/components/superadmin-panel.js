/**
 * <superadmin-panel>
 * Vista de gestión del superadmin (separada de la vista de líder). Lista los
 * líderes de la instancia (alta por email vía Cloud Function, baja) y permite
 * ver el equipo de cada líder (personas y su perfil Role Mirror) en LECTURA.
 * Si el superadmin es además líder, "Usar como líder" lo lleva a las herramientas.
 *
 * Propiedades:
 *  - ready: boolean  (lo activa el glue cuando hay sesión de superadmin)
 *  - isLeader: boolean  (si el superadmin también es líder → botón "Usar como líder")
 */
import { LitElement, html, css } from 'lit';
import { listLeaders, addLeaderByEmail, removeLeader } from '../lib/leaders.js';
import { listCatalog, createGlobal, promoteToGlobal, removeFromCatalog } from '../lib/catalog.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';
import { getPersonProfile } from '../lib/firestore.js';
import { getCareerMap, saveCareerMap } from '../lib/careerMap.js';

const CITY_KINDS = ['tech', 'skill', 'milestone'];
const REC_KINDS = ['curso', 'formacion', 'doc', 'titulo'];

const VIEW_FLAG = 'grebla-view';

export class SuperadminPanel extends LitElement {
  static properties = {
    ready: { attribute: false },
    isLeader: { attribute: false },
    leaders: { state: true },
    selected: { state: true },
    team: { state: true },
    teamLoading: { state: true },
    _email: { state: true },
    _error: { state: true },
    _teamRoles: { state: true },
    _labels: { state: true },
    _newCat: { state: true },
    _careerMap: { state: true },
    _newArea: { state: true },
    _newCity: { state: true },
    _confirmArea: { state: true },
    _confirmCity: { state: true },
    _mapError: { state: true },
    _mapNotice: { state: true },
    _mapSaving: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .bar h1 { font-size: 1.4rem; margin: 0; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.1rem; margin: 0 0 1rem; }
    .toolbar { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    input {
      padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      font: inherit; font-size: 0.9rem; min-width: 16rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    button {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: #fff; }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    tbody tr.clickable { cursor: pointer; }
    tbody tr.clickable:hover { background: var(--rm-surface-hover, #f9fafb); }
    tr.sel { background: var(--rm-surface-hover, #eef2ff); }
    .muted { color: var(--rm-muted, #9ca3af); }
    .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #fff; }
    .del-btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-danger, #dc2626); border-radius: 6px; padding: 0.2rem 0.6rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.88rem; padding: 0.5rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .notice { color: var(--rm-accent, #2a9d8f); font-size: 0.85rem; font-weight: 600; }
    .ro-note { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; }
    h3.sub { font-size: 0.95rem; margin: 1.25rem 0 0.6rem; color: var(--rm-text, #111827); }
    .confirm { font-size: 0.78rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }
    .confirm button { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.78rem; padding: 0 0.25rem; color: var(--rm-text, #111827); }
    .confirm .yes { color: var(--rm-danger, #dc2626); }
    select { padding: 0.4rem 0.5rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font: inherit; font-size: 0.85rem; }
    .cities { display: grid; gap: 0.9rem; }
    .city { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.8rem 1rem; background: var(--rm-surface, #fff); }
    .city-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
    .city-head .cid { font-weight: 700; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; }
    .fields label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    .fields label.check { flex-direction: row; align-items: center; gap: 0.4rem; }
    .fields label.full { grid-column: 1 / -1; }
    .fields input, .fields select { min-width: 0; font-size: 0.85rem; }
    .fields input[type="checkbox"] { width: auto; min-width: 0; }
    .recs-edit { margin-top: 0.75rem; border-top: 1px solid var(--rm-border, #eef0f2); padding-top: 0.6rem; }
    .recs-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: var(--rm-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.4rem; }
    .recs-head button { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
    .rec-row { display: grid; grid-template-columns: 7rem 1fr 1fr auto; gap: 0.4rem; margin-bottom: 0.4rem; align-items: center; }
    .rec-row input { min-width: 0; }
    @media (max-width: 640px) { .rec-row { grid-template-columns: 1fr; } }
  `;

  constructor() {
    super();
    this.ready = false;
    this.isLeader = false;
    /** @type {import('../lib/leaders.js').Leader[]} */
    this.leaders = [];
    /** @type {import('../lib/leaders.js').Leader|null} */
    this.selected = null;
    /** @type {Array<Object>} */
    this.team = [];
    this.teamLoading = false;
    this._email = '';
    this._error = '';
    /** @type {import('../lib/catalog.js').CatalogItem[]} */
    this._teamRoles = [];
    /** @type {import('../lib/catalog.js').CatalogItem[]} */
    this._labels = [];
    this._newCat = { teamRoles: '', labels: '' };
    /** @type {import('../tools/career/domain/types.js').CareerMap|null} */
    this._careerMap = null;
    this._newArea = { id: '', name: '' };
    this._newCity = { id: '', name: '' };
    this._confirmArea = null;
    this._confirmCity = null;
    this._mapError = '';
    this._mapNotice = '';
    this._mapSaving = false;
    this._loaded = false;
  }

  updated() {
    if (this.ready && !this._loaded) {
      this._loaded = true;
      this._loadLeaders();
      this._loadCatalogs();
      this._loadCareerMap();
    }
  }

  async _loadCatalogs() {
    try {
      const [teamRoles, labels] = await Promise.all([listCatalog('teamRoles'), listCatalog('labels')]);
      this._teamRoles = teamRoles;
      this._labels = labels;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los catálogos.';
    }
  }

  /** @param {import('../lib/catalog.js').CatalogKind} kind */
  async _createGlobalItem(kind) {
    const name = (this._newCat[kind] || '').trim();
    if (!name) return;
    this._error = '';
    try {
      await createGlobal(kind, name);
      this._newCat = { ...this._newCat, [kind]: '' };
      await this._loadCatalogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear.';
    }
  }

  /** @param {import('../lib/catalog.js').CatalogKind} kind @param {string} id */
  async _promote(kind, id) {
    this._error = '';
    try {
      await promoteToGlobal(kind, id);
      await this._loadCatalogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo promover.';
    }
  }

  /** @param {import('../lib/catalog.js').CatalogKind} kind @param {string} id */
  async _removeCatalogItem(kind, id) {
    this._error = '';
    try {
      await removeFromCatalog(kind, id);
      await this._loadCatalogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo eliminar.';
    }
  }

  // ── Mapa de carrera (editor) ───────────────────────────────────────────────

  async _loadCareerMap() {
    this._mapError = '';
    try {
      this._careerMap = await getCareerMap();
    } catch (err) {
      this._mapError = err instanceof Error ? err.message : 'No se pudo cargar el mapa de carrera.';
    }
  }

  /** Reemplaza el mapa de trabajo (copia inmutable para refrescar Lit). @param {Partial<import('../tools/career/domain/types.js').CareerMap>} patch */
  _patchMap(patch) {
    this._careerMap = { ...this._careerMap, ...patch };
    this._mapNotice = '';
  }

  /** @param {number} idx @param {Partial<import('../tools/career/domain/types.js').City>} patch */
  _patchCity(idx, patch) {
    const cities = this._careerMap.cities.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    this._patchMap({ cities });
  }

  _addArea() {
    const id = this._newArea.id.trim();
    const name = this._newArea.name.trim();
    this._mapError = '';
    if (!id || !name) { this._mapError = 'La comarca necesita id y nombre.'; return; }
    if (this._careerMap.areas.some((a) => a.id === id)) { this._mapError = `Ya existe la comarca «${id}».`; return; }
    this._patchMap({ areas: [...this._careerMap.areas, { id, name }] });
    this._newArea = { id: '', name: '' };
  }

  /** @param {string} id @param {string} name */
  _renameArea(id, name) {
    this._patchMap({ areas: this._careerMap.areas.map((a) => (a.id === id ? { ...a, name } : a)) });
  }

  /** @param {string} id */
  _deleteArea(id) {
    this._mapError = '';
    const inUse = this._careerMap.cities.filter((c) => c.area === id);
    if (inUse.length) {
      this._confirmArea = null;
      this._mapError = `No se puede borrar «${id}»: ${inUse.length} ciudad(es) la usan. Reasígnalas antes.`;
      return;
    }
    this._patchMap({ areas: this._careerMap.areas.filter((a) => a.id !== id) });
    this._confirmArea = null;
  }

  _addCity() {
    const id = this._newCity.id.trim();
    const name = this._newCity.name.trim();
    this._mapError = '';
    if (!id || !name) { this._mapError = 'La ciudad necesita id y nombre.'; return; }
    if (this._careerMap.cities.some((c) => c.id === id)) { this._mapError = `Ya existe la ciudad «${id}».`; return; }
    const area = this._careerMap.areas[0]?.id ?? '';
    /** @type {import('../tools/career/domain/types.js').City} */
    const city = { id, name, kind: 'tech', area, x: 50, y: 50, weight: 1, prereqs: [] };
    this._patchMap({ cities: [...this._careerMap.cities, city] });
    this._newCity = { id: '', name: '' };
  }

  /** @param {string} id */
  _deleteCity(id) {
    // Quita la ciudad y la elimina de los prereqs de las demás.
    const cities = this._careerMap.cities
      .filter((c) => c.id !== id)
      .map((c) => (c.prereqs.includes(id) ? { ...c, prereqs: c.prereqs.filter((p) => p !== id) } : c));
    this._patchMap({ cities });
    this._confirmCity = null;
  }

  /** @param {number} idx @param {HTMLSelectElement} select */
  _setPrereqs(idx, select) {
    const prereqs = [...select.selectedOptions].map((o) => o.value);
    this._patchCity(idx, { prereqs });
  }

  /** @param {number} idx */
  _addRecommendation(idx) {
    const city = this._careerMap.cities[idx];
    const recommendations = [...(city.recommendations ?? []), { kind: 'doc', label: '', url: '' }];
    this._patchCity(idx, { recommendations });
  }

  /** @param {number} idx @param {number} recIdx @param {Partial<import('../tools/career/domain/types.js').Recommendation>} patch */
  _patchRecommendation(idx, recIdx, patch) {
    const recommendations = (this._careerMap.cities[idx].recommendations ?? []).map((r, i) => (i === recIdx ? { ...r, ...patch } : r));
    this._patchCity(idx, { recommendations });
  }

  /** @param {number} idx @param {number} recIdx */
  _removeRecommendation(idx, recIdx) {
    const recommendations = (this._careerMap.cities[idx].recommendations ?? []).filter((_, i) => i !== recIdx);
    this._patchCity(idx, { recommendations });
  }

  /** Valida el mapa antes de guardar. @returns {string|null} mensaje de error o null */
  _validateMap() {
    const { areas, cities } = this._careerMap;
    const areaIds = new Set(areas.map((a) => a.id));
    const cityIds = new Set();
    for (const c of cities) {
      if (!c.id.trim() || !c.name.trim()) return 'Hay ciudades sin id o sin nombre.';
      if (cityIds.has(c.id)) return `Ciudad duplicada: «${c.id}».`;
      cityIds.add(c.id);
      if (c.area && !areaIds.has(c.area)) return `La ciudad «${c.id}» apunta a una comarca inexistente.`;
      if (c.x < 0 || c.x > 100 || c.y < 0 || c.y > 100) return `La ciudad «${c.id}» tiene una posición fuera de 0..100.`;
    }
    return null;
  }

  async _saveCareerMap() {
    this._mapError = '';
    this._mapNotice = '';
    const invalid = this._validateMap();
    if (invalid) { this._mapError = invalid; return; }
    this._mapSaving = true;
    try {
      await saveCareerMap(this._careerMap);
      this._mapNotice = 'Mapa guardado.';
    } catch (err) {
      this._mapError = err instanceof Error ? err.message : 'No se pudo guardar el mapa.';
    } finally {
      this._mapSaving = false;
    }
  }

  /** @param {string} uid */
  _leaderLabel(uid) {
    const l = this.leaders.find((x) => x.uid === uid);
    return l?.displayName ?? l?.email ?? uid;
  }

  async _loadLeaders() {
    this._error = '';
    try {
      this.leaders = await listLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los líderes.';
    }
  }

  async _addLeader() {
    const email = this._email.trim();
    if (!email) return;
    this._error = '';
    try {
      await addLeaderByEmail(email);
      this._email = '';
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo añadir el líder.';
    }
  }

  /** @param {string} uid */
  async _removeLeader(uid) {
    this._error = '';
    try {
      await removeLeader(uid);
      if (this.selected?.uid === uid) this.selected = null;
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo quitar el líder.';
    }
  }

  /** @param {import('../lib/leaders.js').Leader} leader */
  async _openTeam(leader) {
    this.selected = leader;
    this.team = [];
    this.teamLoading = true;
    this._error = '';
    try {
      const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: leader.uid });
      const people = await listActivePeople(persistence);
      this.team = await Promise.all(
        people.map(async (p) => ({ ...p, profile: await getPersonProfile(p.id) })),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el equipo.';
    } finally {
      this.teamLoading = false;
    }
  }

  _useAsLeader() {
    sessionStorage.setItem(VIEW_FLAG, 'leader');
    location.assign('/');
  }

  /**
   * @param {import('../lib/catalog.js').CatalogKind} kind
   * @param {import('../lib/catalog.js').CatalogItem[]} items
   * @param {string} title @param {string} placeholder
   */
  _renderCatalog(kind, items, title, placeholder) {
    const globals = items.filter((i) => !i.ownerLeaderUid);
    const personals = items.filter((i) => i.ownerLeaderUid);
    return html`
      <section>
        <h2>${title}</h2>
        <div class="toolbar">
          <input
            type="text"
            placeholder=${placeholder}
            .value=${this._newCat[kind]}
            @input=${(e) => { this._newCat = { ...this._newCat, [kind]: e.target.value }; }}
          />
          <button class="primary" ?disabled=${!this._newCat[kind].trim()} @click=${() => this._createGlobalItem(kind)}>Crear global</button>
        </div>
        ${globals.length === 0
          ? html`<p class="empty">Aún no hay globales.</p>`
          : html`<table>
              <thead><tr><th>Global</th><th></th></tr></thead>
              <tbody>
                ${globals.map(
                  (i) => html`<tr>
                    <td>${i.name}</td>
                    <td><button class="del-btn" @click=${() => this._removeCatalogItem(kind, i.id)}>Borrar</button></td>
                  </tr>`,
                )}
              </tbody>
            </table>`}
        ${personals.length === 0
          ? null
          : html`
              <p class="ro-note">Personales de líderes — promuévelos a global para compartirlos con todos:</p>
              <table>
                <thead><tr><th>Nombre</th><th>Líder</th><th></th></tr></thead>
                <tbody>
                  ${personals.map(
                    (i) => html`<tr>
                      <td>${i.name}</td>
                      <td class="muted">${this._leaderLabel(i.ownerLeaderUid)}</td>
                      <td>
                        <button @click=${() => this._promote(kind, i.id)}>Promover a global</button>
                        <button class="del-btn" @click=${() => this._removeCatalogItem(kind, i.id)}>Borrar</button>
                      </td>
                    </tr>`,
                  )}
                </tbody>
              </table>`}
      </section>
    `;
  }

  render() {
    return html`
      <div class="bar">
        <h1>Gestión de la organización</h1>
        ${this.isLeader
          ? html`<button class="primary" @click=${this._useAsLeader}>Usar como líder →</button>`
          : null}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._renderLeaders()}
      ${this._renderCatalog('teamRoles', this._teamRoles, 'Roles de equipo (organización)', 'Nuevo rol global…')}
      ${this._renderCatalog('labels', this._labels, 'Labels (organización)', 'Nuevo label global…')}
      ${this._renderCareerMap()}
      ${this.selected ? this._renderTeam() : null}
    `;
  }

  _renderCareerMap() {
    const map = this._careerMap;
    return html`
      <section>
        <h2>Mapa de carrera</h2>
        <p class="ro-note">Edita la isla de la organización: comarcas y ciudades (hitos, skills y tecnologías). Los cambios se aplican al guardar.</p>
        ${this._mapError ? html`<p class="error">${this._mapError}</p>` : null}
        ${this._mapNotice ? html`<p class="notice">${this._mapNotice}</p>` : null}
        ${!map
          ? html`<p class="empty">Cargando el mapa…</p>`
          : html`
              ${this._renderAreas(map)}
              ${this._renderCities(map)}
              <div class="toolbar" style="margin-top:1rem">
                <button class="primary" ?disabled=${this._mapSaving} @click=${() => this._saveCareerMap()}>
                  ${this._mapSaving ? 'Guardando…' : 'Guardar mapa'}
                </button>
              </div>
            `}
      </section>
    `;
  }

  /** @param {import('../tools/career/domain/types.js').CareerMap} map */
  _renderAreas(map) {
    return html`
      <h3 class="sub">Comarcas (${map.areas.length})</h3>
      <div class="toolbar">
        <input type="text" placeholder="id (p. ej. frontend)" .value=${this._newArea.id}
          @input=${(e) => { this._newArea = { ...this._newArea, id: e.target.value }; }} />
        <input type="text" placeholder="Nombre" .value=${this._newArea.name}
          @input=${(e) => { this._newArea = { ...this._newArea, name: e.target.value }; }} />
        <button class="primary" ?disabled=${!this._newArea.id.trim() || !this._newArea.name.trim()} @click=${() => this._addArea()}>Añadir comarca</button>
      </div>
      ${map.areas.length === 0
        ? html`<p class="empty">Aún no hay comarcas.</p>`
        : html`<table>
            <thead><tr><th>Id</th><th>Nombre</th><th></th></tr></thead>
            <tbody>
              ${map.areas.map(
                (a) => html`<tr>
                  <td class="muted">${a.id}</td>
                  <td><input type="text" .value=${a.name} @input=${(e) => this._renameArea(a.id, e.target.value)} /></td>
                  <td>${this._confirmArea === a.id
                    ? html`<span class="confirm">¿Borrar?
                        <button class="yes" @click=${() => this._deleteArea(a.id)}>Sí</button>
                        <button @click=${() => { this._confirmArea = null; }}>No</button>
                      </span>`
                    : html`<button class="del-btn" @click=${() => { this._confirmArea = a.id; this._mapError = ''; }}>Borrar</button>`}
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>`}
    `;
  }

  /** @param {import('../tools/career/domain/types.js').CareerMap} map */
  _renderCities(map) {
    return html`
      <h3 class="sub">Ciudades (${map.cities.length})</h3>
      <div class="toolbar">
        <input type="text" placeholder="id (p. ej. react)" .value=${this._newCity.id}
          @input=${(e) => { this._newCity = { ...this._newCity, id: e.target.value }; }} />
        <input type="text" placeholder="Nombre" .value=${this._newCity.name}
          @input=${(e) => { this._newCity = { ...this._newCity, name: e.target.value }; }} />
        <button class="primary" ?disabled=${!this._newCity.id.trim() || !this._newCity.name.trim()} @click=${() => this._addCity()}>Añadir ciudad</button>
      </div>
      ${map.cities.length === 0
        ? html`<p class="empty">Aún no hay ciudades.</p>`
        : html`<div class="cities">${map.cities.map((c, idx) => this._renderCity(map, c, idx))}</div>`}
    `;
  }

  /**
   * @param {import('../tools/career/domain/types.js').CareerMap} map
   * @param {import('../tools/career/domain/types.js').City} c
   * @param {number} idx
   */
  _renderCity(map, c, idx) {
    return html`
      <div class="city">
        <div class="city-head">
          <span class="cid">${c.id}</span>
          ${this._confirmCity === c.id
            ? html`<span class="confirm">¿Borrar ciudad?
                <button class="yes" @click=${() => this._deleteCity(c.id)}>Sí</button>
                <button @click=${() => { this._confirmCity = null; }}>No</button>
              </span>`
            : html`<button class="del-btn" @click=${() => { this._confirmCity = c.id; this._mapError = ''; }}>Borrar</button>`}
        </div>
        <div class="fields">
          <label>Nombre
            <input type="text" .value=${c.name} @input=${(e) => this._patchCity(idx, { name: e.target.value })} />
          </label>
          <label>Comarca
            <select @change=${(e) => this._patchCity(idx, { area: e.target.value })}>
              <option value="" ?selected=${!c.area}>— sin comarca —</option>
              ${map.areas.map((a) => html`<option value=${a.id} ?selected=${a.id === c.area}>${a.name}</option>`)}
            </select>
          </label>
          <label>Tipo
            <select @change=${(e) => this._patchCity(idx, { kind: e.target.value })}>
              ${CITY_KINDS.map((k) => html`<option value=${k} ?selected=${k === c.kind}>${k}</option>`)}
            </select>
          </label>
          <label>Peso
            <input type="number" min="0" step="1" .value=${String(c.weight)} @input=${(e) => this._patchCity(idx, { weight: Number(e.target.value) })} />
          </label>
          <label>X (0..100)
            <input type="number" min="0" max="100" step="1" .value=${String(c.x)} @input=${(e) => this._patchCity(idx, { x: Number(e.target.value) })} />
          </label>
          <label>Y (0..100)
            <input type="number" min="0" max="100" step="1" .value=${String(c.y)} @input=${(e) => this._patchCity(idx, { y: Number(e.target.value) })} />
          </label>
          <label class="check">
            <input type="checkbox" .checked=${c.deprecated === true} @change=${(e) => this._patchCity(idx, { deprecated: e.target.checked || undefined })} />
            Deprecada
          </label>
          <label class="full">Prerequisitos
            <select multiple size="4" @change=${(e) => this._setPrereqs(idx, e.target)}>
              ${map.cities
                .filter((other) => other.id !== c.id)
                .map((other) => html`<option value=${other.id} ?selected=${c.prereqs.includes(other.id)}>${other.name} (${other.id})</option>`)}
            </select>
          </label>
        </div>
        <div class="recs-edit">
          <div class="recs-head">
            <span>Recomendaciones</span>
            <button @click=${() => this._addRecommendation(idx)}>+ Añadir</button>
          </div>
          ${(c.recommendations ?? []).length === 0
            ? html`<p class="empty">Sin recomendaciones.</p>`
            : (c.recommendations ?? []).map(
                (r, recIdx) => html`<div class="rec-row">
                  <select @change=${(e) => this._patchRecommendation(idx, recIdx, { kind: e.target.value })}>
                    ${REC_KINDS.map((k) => html`<option value=${k} ?selected=${k === r.kind}>${k}</option>`)}
                  </select>
                  <input type="text" placeholder="Etiqueta" .value=${r.label ?? ''} @input=${(e) => this._patchRecommendation(idx, recIdx, { label: e.target.value })} />
                  <input type="url" placeholder="https://… (opcional)" .value=${r.url ?? ''} @input=${(e) => this._patchRecommendation(idx, recIdx, { url: e.target.value })} />
                  <button class="del-btn" @click=${() => this._removeRecommendation(idx, recIdx)}>×</button>
                </div>`,
              )}
        </div>
      </div>
    `;
  }

  _renderLeaders() {
    return html`
      <section>
        <h2>Líderes (${this.leaders.length})</h2>
        <p class="ro-note">Da de alta a los líderes por su email (deben haber iniciado sesión al menos una vez). Pincha un líder para ver su equipo.</p>
        <div class="toolbar">
          <input
            type="email"
            placeholder="email@dominio.com"
            .value=${this._email}
            @input=${(e) => { this._email = e.target.value; }}
          />
          <button class="primary" ?disabled=${!this._email.trim()} @click=${() => this._addLeader()}>Añadir líder</button>
        </div>
        ${this.leaders.length === 0
          ? html`<p class="empty">Aún no hay líderes dados de alta.</p>`
          : html`<table>
              <thead><tr><th>Nombre</th><th>Email</th><th></th></tr></thead>
              <tbody>
                ${this.leaders.map(
                  (l) => html`
                    <tr class="clickable ${this.selected?.uid === l.uid ? 'sel' : ''}" @click=${() => this._openTeam(l)}>
                      <td>${l.displayName ?? '—'}</td>
                      <td class="muted">${l.email ?? '—'}</td>
                      <td @click=${(e) => e.stopPropagation()}>
                        <button class="del-btn" @click=${() => this._removeLeader(l.uid)}>Quitar</button>
                      </td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>`}
      </section>
    `;
  }

  _renderTeam() {
    const name = this.selected.displayName ?? this.selected.email ?? this.selected.uid;
    return html`
      <section>
        <h2>Equipo de ${name}</h2>
        <p class="ro-note">Vista de solo lectura. La gestión de cada persona la hace su líder.</p>
        ${this.teamLoading
          ? html`<p class="empty">Cargando equipo…</p>`
          : this.team.length === 0
            ? html`<p class="empty">Este líder aún no tiene personas en su equipo.</p>`
            : html`<table>
                <thead><tr><th>Persona</th><th>Roles</th><th>Rol dominante</th><th>Completitud</th></tr></thead>
                <tbody>
                  ${this.team.map(
                    (p) => html`
                      <tr>
                        <td>${p.name}</td>
                        <td class="muted">${(p.teamRoles ?? []).join(', ') || '—'}</td>
                        <td>${p.profile?.dominantRole ?? html`<span class="muted">—</span>`}</td>
                        <td>${p.profile?.completion != null ? `${p.profile.completion}%` : '—'}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>`}
      </section>
    `;
  }
}

if (!customElements.get('superadmin-panel')) {
  customElements.define('superadmin-panel', SuperadminPanel);
}
