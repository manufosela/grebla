/**
 * Fachada única de los catálogos con ámbito (areas|guilds|labels) para el
 * componente <catalog-manager>: despacha por `kind` a los casos de uso concretos
 * (que ya validan y, en gremios/labels, cascadean el rename a /people por nombre).
 * `promote` (personal → global) es genérico: quita el ownerLeaderUid del repo.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {'areas'|'guilds'|'labels'} CatalogKind
 */
import { addArea, listAreas, removeArea, renameArea } from './areas.js';
import { addGuild, listGuilds, removeGuild, renameGuild } from './guilds.js';
import { addLabel, listLabels, removeLabel, renameLabel } from './labels.js';

const LIST = { areas: listAreas, guilds: listGuilds, labels: listLabels };
const ADD = { areas: addArea, guilds: addGuild, labels: addLabel };
const RENAME = { areas: renameArea, guilds: renameGuild, labels: renameLabel };
const REMOVE = { areas: removeArea, guilds: removeGuild, labels: removeLabel };

/** @param {CatalogKind} kind */
function repoOf(persistence, kind) {
  const repo = persistence[kind];
  if (!repo) throw new Error(`Catálogo desconocido: ${kind}`);
  return repo;
}

/** @param {PersistencePort} persistence @param {CatalogKind} kind */
export function listCatalog(persistence, kind) {
  return LIST[kind](persistence);
}

/** @param {PersistencePort} persistence @param {CatalogKind} kind @param {string} name */
export function addCatalog(persistence, kind, name) {
  return ADD[kind](persistence, name);
}

/** @param {PersistencePort} persistence @param {CatalogKind} kind @param {string} id @param {string} name */
export function renameCatalog(persistence, kind, id, name) {
  return RENAME[kind](persistence, id, name);
}

/** @param {PersistencePort} persistence @param {CatalogKind} kind @param {string} id */
export function removeCatalog(persistence, kind, id) {
  return REMOVE[kind](persistence, id);
}

/** Promueve un personal a global (quita ownerLeaderUid). @param {PersistencePort} persistence @param {CatalogKind} kind @param {string} id */
export function promoteCatalog(persistence, kind, id) {
  return repoOf(persistence, kind).promote(id);
}
