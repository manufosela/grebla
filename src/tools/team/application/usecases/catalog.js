/**
 * Fachada única de los catálogos con ámbito (areas|guilds|labels) para el
 * componente <catalog-manager>: despacha por `kind` a los casos de uso concretos
 * (que ya validan y, en gremios/labels, cascadean el rename a /people por nombre).
 * `promote` (personal → global) es genérico: quita el ownerLeaderUid del repo.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {'areas'|'guilds'|'labels'|'squads'} CatalogKind
 */
import { addArea, listAreas, removeArea, renameArea } from './areas.js';
import { addGuild, listGuilds, removeGuild, renameGuild } from './guilds.js';
import { addSquad, listSquads, removeSquad, renameSquad } from './squads.js';
import {
  addLabel, listLabels, removeLabel, renameLabel, updateLabelMeta,
} from './labels.js';

const LIST = { areas: listAreas, guilds: listGuilds, labels: listLabels, squads: listSquads };
const ADD = { areas: addArea, guilds: addGuild, labels: addLabel, squads: addSquad };
const RENAME = { areas: renameArea, guilds: renameGuild, labels: renameLabel, squads: renameSquad };
const REMOVE = { areas: removeArea, guilds: removeGuild, labels: removeLabel, squads: removeSquad };

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

/**
 * @param {PersistencePort} persistence @param {CatalogKind} kind @param {string} name
 * @param {{ subLabel?: string, color?: string }} [extra]  Metadatos (solo labels).
 */
export function addCatalog(persistence, kind, name, extra = {}) {
  return ADD[kind](persistence, name, extra);
}

/**
 * Actualiza los metadatos de un label (subLabel/color); solo aplica a `labels`.
 * @param {PersistencePort} persistence @param {CatalogKind} kind @param {string} id
 * @param {{ subLabel?: string, color?: string }} patch
 */
export function updateCatalogMeta(persistence, kind, id, patch) {
  if (kind !== 'labels') throw new Error(`El catálogo ${kind} no tiene metadatos`);
  return updateLabelMeta(persistence, id, patch);
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
