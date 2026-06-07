/**
 * API de la capa de aplicación del seguimiento de equipo. La UI importa desde
 * aquí; nunca toca puertos ni dominio directamente.
 */
export { addPerson, listActivePeople, deactivatePerson, updatePerson } from './people.js';
export { addArea, listAreas, removeArea } from './areas.js';
export { addReading, getCurrentReading, getPersonTimeline } from './readings.js';
export { registerConversation, listConversations, updateConversation } from './conversations.js';
export { addSupportNote, listSupportNotes, removeSupportNote } from './supportNotes.js';
export {
  getTeamCoverage,
  getBusFactor,
  getSilenceAlerts,
  getTeamHealth,
  exportAggregate,
} from './team.js';
