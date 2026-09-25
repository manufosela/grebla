/**
 * Catalogo de TARJETAS de GREBLA: las herramientas del inicio y las puertas del
 * panel de administracion (RMR-TSK-0572).
 *
 * Vivian dentro de sus paginas. Se sacan aqui porque hay mas de una pantalla que
 * necesita saber que tarjetas existen —el editor del orden, sin ir mas lejos— y
 * dos copias de la misma lista se separan el dia que alguien anade una sola.
 *
 * El codigo manda sobre QUE tarjetas hay. Quien las ve lo deciden las politicas
 * de cada herramienta, y en que orden salen, la configuracion del orden.
 */

export const HUB_TOOLS = [
  {
    // La documentación explica por qué se trabaja así: es de toda la
    // organización (RMR-PCS-0041). El contenido vive en Storage, no en el
    // repositorio, y solo se lee con sesión.
    name: 'Documentación',
    href: '/documentacion',
    layer: 'tribbu',
    description: 'Las presentaciones que explican GREBLA y cómo se organiza Tecnología: para qué existe, cómo trabaja y cómo se mide.',
    available: true,
  },
  {
    // Lo personal es una herramienta más, no otra aplicación (RMR-TSK-0459).
    // Va marcada como `personal`: se ve siempre que tengas ficha, sin depender
    // de la política de audiencia — una cosa es la herramienta O2O para llevar
    // los del equipo y otra ver los tuyos.
    name: 'Mi espacio',
    href: '/mi-espacio',
    layer: 'tribbu',
    description: 'Lo tuyo: tu ficha, tu plan de carrera, tu Role Mirror, tus O2O y tus datos. Lo que tu manager y tú miráis juntos.',
    available: true,
    personal: true,
  },
  {
    name: 'Organigrama',
    href: '/organigrama',
    layer: 'tribbu',
    description: 'Consulta cómo se organiza la casa, en pirámide invertida (liderazgo afectivo): quien más responsabilidad tiene sostiene desde abajo.',
    available: true,
  },
  {
    name: 'Role Mirror',
    href: '/tools/role-mirror',
    layer: 'ingenieria',
    description: 'Autodiagnóstico de perfil de ingeniería: cuestionario adaptativo y mapa de competencias.',
    available: true,
  },
  {
    name: 'Equipo',
    href: '/tools/team',
    layer: 'ingenieria',
    description: 'La foto de tu equipo: cada persona en las 4 dimensiones, con su cobertura de roles, bus factor y conversaciones 1:1.',
    available: true,
  },
  {
    name: 'DORA',
    href: '/tools/dora',
    layer: 'ingenieria',
    description: 'Métricas de entrega a nivel de equipo (lead time, deploy frequency…) desde los repos de la organización.',
    available: true,
  },
  {
    name: 'Flujo (LEAN)',
    href: '/tools/lean',
    layer: 'ingenieria',
    description: 'Métricas de flujo del equipo desde Linear: throughput, cycle time (p50/p85), WIP y aging. Complementan a DORA.',
    available: true,
  },
  {
    name: 'Plan de desarrollo',
    href: '/tools/career-map',
    layer: 'ingenieria',
    description: 'Traza tu ruta de crecimiento en una isla de casas (skills, tecnologías, hitos), gamificado.',
    available: true,
  },
  {
    // El career path ya se veía dentro de «Mi espacio › Mi carrera», pero había
    // que saber que estaba ahí: es la referencia que se consulta antes de una
    // promoción o de un 1:1, así que tiene su propia puerta. NO se quita de Mi
    // espacio: esto se añade (RMR-TSK-0488).
    name: 'Career path',
    href: '/tools/career-path',
    description: 'Todos los niveles de la organización y qué se espera en cada uno, dimensión a dimensión. La referencia para saber a qué aspirar y qué implica cada peldaño.',
    available: true,
    layer: 'ingenieria',
  },
  {
    // Mis O2O: consultar los míos, tenga equipo o no. Vive en «Mi espacio» y se
    // abre directo por su pestaña — no se duplica la vista, se le pone puerta
    // (RMR-TSK-0489). Marcada como personal: se ve con ficha, sin pasar por la
    // política de audiencia, que gobierna la herramienta de gestión.
    name: 'Mis O2O',
    href: '/mi-espacio#o2o',
    description: 'Los tuyos: los temas que hablasteis, los acuerdos y las acciones que salieron de tus one-to-ones.',
    available: true,
    layer: 'tribbu',
    personal: true,
  },
  {
    // La GESTIÓN: preparar, conducir y seguir los del equipo. Solo la ve quien
    // lidera: la herramienta ya rechazaba a quien no, y ofrecerla a todo el que
    // pasara la política era mandar a la gente a una puerta cerrada.
    name: 'O2O de mi equipo',
    href: '/tools/o2o',
    layer: 'tribbu',
    manages: true,
    description: 'Prepara, conduce y da seguimiento a los one-to-ones de tu gente: guía de temas, formulario previo, acciones y evolución.',
    available: true,
  },
  {
    name: 'Moving Motivators',
    href: '/tools/motivators/moving',
    layer: 'tribbu',
    description: 'Juego de cartas: ordena qué te mueve en el trabajo (curiosidad, maestría, propósito…). Reflexión personal y resultados de equipo por rondas.',
    available: true,
  },
  {
    name: 'Affective Motivators',
    href: '/tools/motivators/affective',
    layer: 'tribbu',
    description: 'Juego de cartas: ordena qué necesitas sentir en tu equipo (escucha, confianza, pertenencia…). Reflexión personal y resultados de equipo por rondas.',
    available: true,
  },
  {
    name: 'Marea',
    href: '/marea',
    layer: 'tribbu',
    description: 'El pulso afectivo de la semana: cómo navegas (energía y ánimo) y cuatro anclas. Un registro al día; resultados del equipo siempre agregados y anónimos.',
    available: true,
  },
  {
    name: 'Retros',
    href: '/retros',
    layer: 'tribbu',
    description: 'Retrospectivas de equipo (Start/Stop/Continue, +/−/Start/Stop o Barco): notas anónimas, votos y acciones con owner que se arrastran a la siguiente retro hasta cerrarse.',
    available: true,
  },
  {
    name: 'Scrum Poker',
    href: '/poker',
    layer: 'tribbu',
    description: 'Estimación en equipo en tiempo real: quien organiza deja las tareas, cada persona vota su carta en oculto y, cuando han votado todos, se giran a la vez: verde si hay acuerdo, rojo en la más baja y la más alta.',
    available: true,
  },
  {
    name: 'Kudos',
    href: '/kudos',
    layer: 'tribbu',
    description: 'Da las gracias de forma anónima con un mensaje corto (público y/o privado). Cada semana, el muro muestra a las personas agradecidas — sin rankings ni competición.',
    available: true,
  },
  {
    name: 'Encuestas',
    href: '/tools/encuestas',
    layer: 'tribbu',
    description: 'Encuestas de clima anónimas (eNPS + Q12): crea la encuesta, comparte los enlaces personales y consulta participación y resultados por segmento.',
    available: true,
  },
];

/**
 * Mapea cada tarjeta a su toolId en /toolPolicies (RMR-PCS-0027 · F6). El hub
 * filtra por estas políticas. «team» es gestión (managers/superadmin) y no tiene
 * política de audiencia: se rige por el rol, como hasta ahora.
 */
/** @type {Record<string, string>} */
export const TOOL_ID = {
  '/organigrama': 'organigrama',
  '/tools/role-mirror': 'rolemirror',
  '/tools/team': 'team',
  '/tools/dora': 'dora',
  '/tools/lean': 'lean',
  '/tools/career-map': 'career',
  '/tools/career-path': 'careerpath',
  '/tools/o2o': 'o2o',
  '/mi-espacio#o2o': 'o2o',
  '/tools/motivators/moving': 'motivators',
  '/tools/motivators/affective': 'motivators',
  '/marea': 'marea',
  '/retros': 'retros',
  '/poker': 'poker',
  '/tools/encuestas': 'surveys',
  '/kudos': 'kudos',
  '/documentacion': 'docs',
};

export const ADMIN_CARDS = [
  {
    id: 'organizacion',
    name: 'Organización',
    icon: '🏛️',
    href: '/admin/organizacion',
    description: 'Organigrama y roles, áreas, gremios, dominios, labels, el framework de carrera, usuarios y permisos.',
    govern: true,
  },
  {
    id: 'docs',
    name: 'Documentos',
    icon: '📖',
    href: '/admin/documentos',
    description: 'Las presentaciones que explican cómo trabajamos: subirlas, organizarlas en carpetas y retirarlas.',
  },
  {
    id: 'surveys',
    name: 'Encuestas',
    icon: '📋',
    href: '/tools/encuestas',
    description: 'Plantillas y preguntas, padrón de participantes, ejes de segmentación y resultados.',
  },
  {
    id: 'rolemirror',
    name: 'Role Mirror',
    icon: '◑',
    href: '/tools/role-mirror/admin',
    description: 'Los perfiles de ingeniería: la propuesta de cada persona, la versión que cuenta y su histórico.',
  },
  {
    id: 'career',
    name: 'Plan de desarrollo',
    icon: '◇',
    href: '/tools/career-map/admin',
    description: 'Por dónde va el plan de cada persona y cuánto tiempo le dedica.',
  },
  {
    id: 'o2o',
    name: 'O2O',
    icon: '💬',
    href: '/tools/o2o',
    description: 'La guía de temas y el formulario previo de cada periodo, y el seguimiento de acciones.',
  },
  {
    id: 'motivators',
    name: 'Motivadores',
    icon: '🃏',
    href: '/tools/motivators/moving#rounds',
    description: 'Rondas de Moving y Affective Motivators: abrir, cerrar y ver los resultados del equipo.',
  },
  {
    id: 'marea',
    name: 'Marea',
    icon: '🌊',
    href: '/marea#admin',
    description: 'El umbral de anonimato de los resultados y cuánta gente marca su marea cada semana.',
  },
  {
    id: 'lean',
    name: 'Flujo (LEAN)',
    icon: '🔀',
    href: '/tools/lean#teams',
    description: 'Qué unidades se miden y a qué subdominio pertenece cada una.',
  },
  {
    id: 'dora',
    name: 'DORA',
    icon: '🚀',
    href: '/tools/dora#repos',
    description: 'Repos medidos, su equipo y el recálculo de las métricas de entrega.',
  },
];
