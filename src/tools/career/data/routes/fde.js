/**
 * Itinerario del rol Forward Deployed Engineer (JG-15): el más transversal
 * del archipiélago. Convención de rutas: cabecera de ./backend-php.js.
 *
 * Los cruces cubren lo que su isla da por hecho: SQL para los datos del
 * cliente, prototipado IA de frontend, FastAPI y Docker para servir, y
 * discovery de producto; RAG, agentes y contratos llegan en el Magister.
 */

/** Paradas del hito Peritus (15): entregar valor en terreno con autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'fde/que-es-un-fde',
  'fde/mentalidad-ownership',
  'fde/generalista-t',
  'fde/descubrimiento-en-terreno',
  'fde/plataforma-propia',
  'fde/prototipos-rapidos',
  'fde/comunicar-con-cliente',
  'postgres/sql-fundamentos',
  'frontend/prototipado-ia',
]);

/** Paradas del hito Veteranus (26): dominio y datos del cliente,
 * integraciones seguras, del prototipo al producto y entrega en días con
 * IA, con el stack para servirlo y entrevistas de discovery. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'fde/que-es-un-fde',
  'fde/mentalidad-ownership',
  'fde/generalista-t',
  'fde/descubrimiento-en-terreno',
  'fde/entender-el-dominio',
  'fde/datos-del-cliente',
  'fde/plataforma-propia',
  'fde/prototipos-rapidos',
  'fde/integraciones',
  'fde/seguridad-en-casa-cliente',
  'fde/comunicar-con-cliente',
  'fde/del-prototipo-al-producto',
  'fde/entregar-en-dias-con-ia',
  'postgres/sql-fundamentos',
  'frontend/prototipado-ia',
  'backend-python/fastapi',
  'devops/docker',
  'product-manager/entrevistas-usuarios',
]);

/** Paradas del hito Magister (37): la isla completa (expectativas, puente
 * cliente-equipo, feedback a plataforma, medir valor, calidad con IA) más
 * RAG, agentes y contratos de API para construir soluciones de IA serias
 * en casa del cliente. */
const MAGISTER_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'bases/profesional-ia',
  'fde/que-es-un-fde',
  'fde/mentalidad-ownership',
  'fde/generalista-t',
  'fde/descubrimiento-en-terreno',
  'fde/entender-el-dominio',
  'fde/mapear-procesos-cliente',
  'fde/datos-del-cliente',
  'fde/plataforma-propia',
  'fde/prototipos-rapidos',
  'fde/integraciones',
  'fde/seguridad-en-casa-cliente',
  'fde/comunicar-con-cliente',
  'fde/gestionar-expectativas',
  'fde/puente-cliente-equipo',
  'fde/del-prototipo-al-producto',
  'fde/feedback-a-plataforma',
  'fde/medir-valor-entregado',
  'fde/entregar-en-dias-con-ia',
  'fde/calidad-con-ia-en-cliente',
  'fde/fde-de-confianza',
  'postgres/sql-fundamentos',
  'frontend/prototipado-ia',
  'backend-python/fastapi',
  'devops/docker',
  'product-manager/entrevistas-usuarios',
  'ai-engineer/rag',
  'ai-engineer/agentes',
  'software-architect/apis-y-contratos',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'fde',
  roleName: 'Forward Deployed Engineer',
  tiers: {
    peritus: {
      name: 'Forward Deployed Engineer · Grumete',
      description:
        'Ejecuta con autonomía: ownership y perfil en T, descubrimiento en terreno, ' +
        'dominio de tu plataforma, prototipos en días con IA, SQL para los datos del ' +
        'cliente y comunicación directa con él.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Forward Deployed Engineer · Corsario',
      description:
        'Decide y anticipa: dominio y datos del cliente, integraciones con lo ' +
        'existente y seguridad en su casa, del prototipo al producto con FastAPI y ' +
        'Docker, y entrevistas de usuario para descubrir lo que de verdad necesita.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Forward Deployed Engineer · Capitán',
      description:
        'Transforma: gestiona expectativas y hace de puente cliente-equipo, devuelve ' +
        'feedback a la plataforma y mide el valor entregado, y construye soluciones ' +
        'serias de IA en cliente con RAG, agentes y contratos de API.',
      stops: MAGISTER_STOPS,
    },
  },
});
