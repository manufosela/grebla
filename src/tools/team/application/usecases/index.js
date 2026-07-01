/**
 * API de la capa de aplicación del seguimiento de equipo. La UI importa desde
 * aquí; nunca toca puertos ni dominio directamente.
 */
export {
  addPerson,
  listActivePeople,
  listDepartedPeople,
  deactivatePerson,
  updatePerson,
  sharePerson,
  unsharePerson,
  transferOwnership,
  normalizePerson,
  getTurnover,
} from './people.js';
export { addArea, listAreas, removeArea } from './areas.js';
export { getSettings, updateSettings } from './config.js';
export { addGuild, listGuilds, removeGuild } from './guilds.js';
export { addLabel, listLabels, removeLabel } from './labels.js';
export { addReading, getCurrentReading, getPersonTimeline } from './readings.js';
export { registerConversation, listConversations, updateConversation } from './conversations.js';
export { addSupportNote, listSupportNotes, removeSupportNote } from './supportNotes.js';
export {
  getTeamCoverage,
  getBusFactor,
  getSilenceAlerts,
  getTeamHealth,
  getDiagnosis,
  exportAggregate,
} from './team.js';
export { getTeamMap } from './teamMap.js';
