/**
 * Tipos del dominio de la herramienta de seguimiento de equipo (JSDoc, sin
 * dependencias de Firebase). Las cuatro dimensiones son INDEPENDIENTES (R1): no
 * existe un "nivel global de persona". Cada lectura es un estado con fecha (R2).
 *
 * @typedef {import('./levels.js').LevelValue} LevelValue
 *
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} name
 * @property {string[]} teamRoles     Roles funcionales en el equipo (del catálogo TeamRole). No es Belbin.
 * @property {string} [teamRole]      LEGACY: rol único (string). Se deriva a teamRoles al leer (retrocompat).
 * @property {string} startDate       ISO date (alta)
 * @property {boolean} active
 * @property {string|null} [deactivatedAt]  ISO date de la baja (null/ausente si activa)
 * @property {string|null} [githubLogin]    Usuario de GitHub, para mapear la contribución DORA a la persona.
 * @property {string|null} [uid]            Cuenta vinculada (acceso de solo lectura de la persona). Se vincula al dar acceso.
 * @property {string} [ownerLeaderUid]      Líder dueño de la persona (la gestiona y comparte).
 * @property {Record<string, SharePermission>} [sharedWith]   Compartición con otros líderes: uid → permiso.
 * @property {string[]} [sharedWithUids]    Espejo de las claves de sharedWith (para consultas array-contains).
 *
 * @typedef {'view'|'edit'} SharePermission   Permiso de una persona compartida (ver / editar).
 *
 * @typedef {Object} SeniorityReading
 * @property {LevelValue} level
 * @property {boolean} [toNext]
 * @property {string} date
 * @property {string} [note]
 *
 * @typedef {Object} EmotionalReading
 * @property {LevelValue} level
 * @property {boolean} [toNext]
 * @property {string} date
 * @property {string} [note]
 *
 * @typedef {Object} KnowledgeReading
 * @property {string} areaId
 * @property {LevelValue} level
 * @property {boolean} [toNext]
 * @property {string} date
 * @property {string} [note]
 *
 * @typedef {'primary'|'secondary'} ContributionStrength
 * @typedef {Object} ContributionReading
 * @property {Record<string, ContributionStrength>} roles  sigla Belbin → primario/secundario
 * @property {string} date
 * @property {string} [note]
 *
 * @typedef {Object} SupportNote   // R5: acompañamiento NO diagnóstico, sin nivel, separado
 * @property {string} id
 * @property {string} text
 * @property {string} date
 *
 * @typedef {'o2o'|'catchup'} ConversationType
 * @typedef {Object} FileRef
 * @property {string} ref
 * @property {string} [url]
 * @property {string} provider
 *
 * @typedef {Object} Conversation   // R4: gira en torno a notas/comportamientos
 * @property {string} id
 * @property {ConversationType} type
 * @property {string} date
 * @property {string} notes
 * @property {FileRef|null} [audio]
 * @property {string|null} [transcription]   // enganche IA (fase 2): se rellena a mano en MVP
 * @property {string|null} [summary]         // enganche IA (fase 2)
 * @property {string[]} [linkedDimensions]
 *
 * @typedef {Object} Area
 * @property {string} id
 * @property {string} name
 *
 * @typedef {Object} TeamRole   Rol funcional del equipo (catálogo con ámbito).
 * @property {string} id
 * @property {string} name
 * @property {string} [ownerLeaderUid]   Líder dueño si es personal; ausente si es global.
 *
 * @typedef {Object} OrgSettings
 * @property {number} cadenceDays            R7: cadencia configurable (global en MVP)
 * @property {number} busFactorMinLevel      Umbral de dominio para contar cobertura (default 3 = Peritus)
 * @property {{ fileStorage: boolean }} features
 */

/** Las cuatro dimensiones independientes (R1). */
export const DIMENSIONS = Object.freeze(['contribution', 'knowledge', 'seniority', 'emotional']);

/** Valores por defecto de configuración (H4/H8/H9). */
export const DEFAULT_SETTINGS = Object.freeze({
  cadenceDays: 30,
  busFactorMinLevel: 3,
  features: { fileStorage: false },
});

export {};
