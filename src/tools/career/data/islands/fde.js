/**
 * Isla «FDE — Forward Deployed Engineer» (doc /careerMap/fde) — MC-16, oleada 2.
 *
 * Sigue la convención de contenido de islas descrita en ./bases.js: ids de
 * ciudad prefijados por la disciplina ('fde/'), prereqs solo intra-isla y sin
 * ciclos, posiciones 0..100 separadas, pesos 1..3 y cada ciudad con keyPoints,
 * aiFocus y recursos reales. No hay roadmap.sh oficial de FDE: la isla se
 * apoya en el rol popularizado por Palantir y adoptado por las empresas de IA
 * — un ingeniero desplegado con el cliente que descubre el problema en
 * terreno, construye sobre la plataforma propia y convierte prototipos en
 * producto. En la era IA, el FDE entrega valor en días sin sacrificar calidad
 * ni seguridad en casa del cliente.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const FDE_ISLAND = {
  id: 'fde',
  name: 'Isla FDE',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'rol', name: 'El rol FDE' },
    { id: 'terreno', name: 'Descubrimiento en terreno' },
    { id: 'construir', name: 'Construir sobre la plataforma' },
    { id: 'cliente', name: 'Comunicación y confianza' },
    { id: 'producto', name: 'Del prototipo al producto' },
    { id: 'fde-ia', name: 'FDE en la era IA' },
  ],
  cities: [
    // ── El rol FDE (comarca de entrada, junto al puerto) ─────────────────────
    {
      id: 'fde/que-es-un-fde',
      name: 'Qué es un FDE',
      kind: 'skill',
      area: 'rol',
      x: 50,
      y: 72,
      weight: 3,
      prereqs: [],
      keyPoints: [
        'El FDE es un ingeniero desplegado con el cliente: resuelve SU problema con TU plataforma, en su terreno.',
        'Mitad ingeniería, mitad consultoría, cero excusas: el éxito se mide en valor entregado al cliente.',
        'Origen Palantir, presente en las empresas de IA: es uno de los roles más demandados de esta ola.',
        'Vives entre dos mundos: eres los ojos del producto en el cliente y la voz del cliente en el producto.',
        'No es un rol de soporte: es ingeniería de producto con el usuario sentado al lado.',
      ],
      aiFocus:
        'Las empresas de IA contratan FDEs en masa porque su tecnología solo demuestra valor cuando alguien la aterriza en el caso concreto de cada cliente. Profundiza en entender el rol de verdad: el FDE es el puente entre una plataforma potente y un problema de negocio específico — justo donde la IA sola no llega.',
      resources: [
        { kind: 'post', label: 'Palantir Blog — el rol del Forward Deployed Engineer', url: 'https://blog.palantir.com' },
        { kind: 'post', label: 'The Pragmatic Engineer — newsletter', url: 'https://newsletter.pragmaticengineer.com' },
      ],
    },
    {
      id: 'fde/mentalidad-ownership',
      name: 'Ownership extremo',
      kind: 'skill',
      area: 'rol',
      x: 36,
      y: 64,
      weight: 3,
      prereqs: ['fde/que-es-un-fde'],
      keyPoints: [
        'El problema del cliente es TU problema de punta a punta: no hay «eso es de otro equipo».',
        'Sin excusas de contexto: si falta un dato, lo consigues; si falta un acceso, lo persigues.',
        'Decide con autonomía y da la cara: en terreno no hay comité al que escalar cada duda.',
        'Deja todo mejor de lo que lo encontraste: documentación, scripts y relaciones incluidas.',
        'Ownership no es heroísmo en solitario: es asegurar que el problema queda resuelto, pidas ayuda o no.',
      ],
      aiFocus:
        'Con IA, una sola persona con ownership cubre lo que antes exigía un equipo: frontend, integración, datos y despliegue. Profundiza en la otra cara — cuanto más abarcas con ayuda de la máquina, más crítico es que asumas la responsabilidad de TODO lo que entregas, lo hayas tecleado tú o no.',
      resources: [
        { kind: 'libro', label: 'Extreme Ownership (Willink y Babin)', format: 'papel' },
        { kind: 'libro', label: 'The Pragmatic Programmer (Hunt y Thomas)', format: 'papel' },
      ],
    },
    {
      id: 'fde/generalista-t',
      name: 'Perfil generalista en T',
      kind: 'skill',
      area: 'rol',
      x: 64,
      y: 64,
      weight: 2,
      prereqs: ['fde/que-es-un-fde'],
      keyPoints: [
        'Anchura fullstack funcional: montar UI, API, datos y despliegue tú solo, aunque nada sea perfecto.',
        'Profundidad en tu plataforma: en ella sí eres experto, es tu ventaja frente a cualquier consultora.',
        'Aprende dominios rápido: cada cliente es un sector nuevo con su vocabulario y sus reglas.',
        'Ten un kit de arranque personal: plantillas, scripts y patrones que reutilizas en cada despliegue.',
        'Cultiva la humildad del generalista: sabes cuándo llamar al especialista de tu empresa.',
      ],
      aiFocus:
        'La IA es el copiloto perfecto del generalista: te sube al 80% en la tecnología que no dominas y te deja rendir en stacks ajenos desde el día uno. Profundiza en tu plataforma y en aprender-a-aprender dominios — esa combinación es la que la IA amplifica en vez de sustituir.',
      resources: [
        { kind: 'doc', label: 'roadmap.sh — Full Stack', url: 'https://roadmap.sh/full-stack' },
        { kind: 'post', label: 'Simon Willison — IA aplicada al desarrollo', url: 'https://simonwillison.net' },
      ],
    },

    // ── Descubrimiento en terreno (oeste) ────────────────────────────────────
    {
      id: 'fde/descubrimiento-en-terreno',
      name: 'Descubrimiento en terreno',
      kind: 'skill',
      area: 'terreno',
      x: 24,
      y: 54,
      weight: 3,
      prereqs: ['fde/mentalidad-ownership'],
      keyPoints: [
        'Ve donde está el trabajo real: la sala de reuniones miente, el puesto de trabajo del usuario no.',
        'Observa el proceso actual antes de proponer nada: cronometra, anota los workarounds y las hojas de cálculo ocultas.',
        'Pregunta por comportamiento pasado y casos concretos, no por opiniones sobre el futuro.',
        'Identifica al usuario real además del sponsor: quien firma el contrato rara vez es quien usa la herramienta.',
        'Busca el dolor con ROI claro: el primer caso de uso debe doler lo suficiente para mover a la organización.',
      ],
      aiFocus:
        'La IA prepara tu visita (sector, jerga, procesos típicos) y sintetiza tus notas de campo cada noche. Profundiza en la observación presencial: detectar el excel clandestino y el paso del proceso que nadie admite en voz alta es información que solo se consigue estando allí.',
      resources: [
        { kind: 'libro', label: 'The Mom Test (Rob Fitzpatrick)', format: 'papel' },
        { kind: 'libro', label: 'Continuous Discovery Habits (Teresa Torres)', format: 'papel' },
      ],
    },
    {
      id: 'fde/entender-el-dominio',
      name: 'Aprender el dominio del cliente',
      kind: 'skill',
      area: 'terreno',
      x: 12,
      y: 42,
      weight: 2,
      prereqs: ['fde/descubrimiento-en-terreno'],
      keyPoints: [
        'Aprende el vocabulario del sector en la primera semana: hablar su idioma compra credibilidad.',
        'Construye un glosario y un mapa de conceptos del dominio; será oro para ti y para tu equipo.',
        'Entiende los flujos de dinero y de responsabilidad: qué le cuesta caro al cliente y quién responde por qué.',
        'Respeta la regulación del sector (sanidad, banca, industria): condiciona lo que puedes construir.',
        'Encuentra a tu «traductor» local: ese usuario veterano que sabe cómo funcionan las cosas de verdad.',
      ],
      aiFocus:
        'La IA comprime semanas de estudio de dominio en días: pídele el modelo mental del sector, los términos clave y las trampas típicas, y contrástalo en terreno. Profundiza en las particularidades de TU cliente concreto — los matices locales que separan su realidad del manual del sector.',
      resources: [
        { kind: 'libro', label: 'Domain-Driven Design (Eric Evans)', format: 'papel' },
        { kind: 'post', label: 'First Round Review — trabajo con clientes enterprise', url: 'https://review.firstround.com' },
      ],
    },
    {
      id: 'fde/mapear-procesos-cliente',
      name: 'Mapear procesos y sistemas',
      kind: 'skill',
      area: 'terreno',
      x: 28,
      y: 40,
      weight: 2,
      prereqs: ['fde/descubrimiento-en-terreno'],
      keyPoints: [
        'Dibuja el proceso as-is completo: personas, sistemas, ficheros y los huecos que se cruzan a mano.',
        'Inventaría los sistemas existentes: ERPs, bases de datos, APIs disponibles y sus dueños internos.',
        'Localiza las fuentes de verdad de los datos — y prepárate para descubrir que hay varias en conflicto.',
        'Valida el mapa con quienes ejecutan el proceso: te corregirán detalles que cambian el diseño.',
        'Marca los puntos de integración viables: el mejor plan fracasa si el sistema clave no tiene API.',
      ],
      aiFocus:
        'La IA convierte tus notas y capturas en diagramas de proceso presentables en minutos, y te ayuda a interrogar esquemas de bases de datos desconocidos. Profundiza en la arqueología de sistemas legacy: descubrir cómo funciona de verdad el ERP de 20 años sigue exigiendo paciencia humana y política.',
      resources: [
        { kind: 'doc', label: 'C4 model — diagramas de arquitectura', url: 'https://c4model.com' },
        { kind: 'libro', label: 'Working Effectively with Legacy Code (Michael Feathers)', format: 'papel' },
      ],
    },
    {
      id: 'fde/datos-del-cliente',
      name: 'Los datos del cliente',
      kind: 'skill',
      area: 'terreno',
      x: 40,
      y: 48,
      weight: 2,
      prereqs: ['fde/descubrimiento-en-terreno'],
      keyPoints: [
        'Los datos reales siempre están peor de lo prometido: audita calidad, huecos y duplicados el primer día.',
        'Consigue muestras reales pronto: el diseño sobre datos imaginados se cae en la primera integración.',
        'Acuerda por escrito qué datos puedes tocar, copiar o mover — y bajo qué normativa (RGPD incluida).',
        'Construye pipelines de limpieza reproducibles, no arreglos manuales que solo tú sabes repetir.',
        'La calidad de los datos limita todo lo que construyas encima: es la primera conversación honesta con el cliente.',
      ],
      aiFocus:
        'La IA acelera el trabajo sucio de datos: perfilar tablas, detectar anomalías y generar transformaciones de limpieza. Profundiza en la gobernanza — decidir qué datos del cliente pueden pasar por qué modelos es una cuestión de contrato y confianza, no de capacidad técnica.',
      resources: [
        { kind: 'libro', label: 'Designing Data-Intensive Applications (Martin Kleppmann)', format: 'papel' },
        { kind: 'doc', label: 'AEPD — guías de protección de datos', url: 'https://www.aepd.es' },
      ],
    },

    // ── Construir sobre la plataforma (centro-este) ──────────────────────────
    {
      id: 'fde/plataforma-propia',
      name: 'Dominar tu plataforma',
      kind: 'tech',
      area: 'construir',
      x: 62,
      y: 48,
      weight: 3,
      prereqs: ['fde/generalista-t'],
      keyPoints: [
        'Conoce tu plataforma mejor que nadie: sus primitivas, sus límites y sus caminos rápidos.',
        'Resuelve con configuración y composición antes que con código a medida: lo custom envejece mal en casa del cliente.',
        'Aprende de otros despliegues: los patrones que funcionaron en un cliente son tu catálogo de salida.',
        'Sabe qué NO hace tu plataforma y dilo pronto: prometer de más se paga en terreno.',
        'Mantén línea directa con el equipo de plataforma: eres su usuario más exigente.',
      ],
      aiFocus:
        'Alimenta a tu asistente de IA con la documentación de tu plataforma y tus despliegues previos: convierte tu experiencia en un copiloto que propone la primitiva correcta para cada caso. Profundiza en los límites del sistema — saber qué se rompe a escala es lo que te separa de una demo bonita.',
      resources: [
        { kind: 'post', label: 'Palantir Blog — ingeniería y despliegues', url: 'https://blog.palantir.com' },
        { kind: 'libro', label: 'Team Topologies (Skelton y Pais)', format: 'papel' },
      ],
    },
    {
      id: 'fde/prototipos-rapidos',
      name: 'Prototipos en días',
      kind: 'skill',
      area: 'construir',
      x: 52,
      y: 36,
      weight: 3,
      prereqs: ['fde/plataforma-propia'],
      keyPoints: [
        'Enseña algo funcionando la primera semana: con datos del cliente, aunque sea un flujo mínimo.',
        'Elige el corte vertical con más dolor y ROI visible, no el más fácil de construir.',
        'Timeboxing agresivo: si en dos días no hay demo, recorta alcance, no calidad de la parte mostrada.',
        'Deja claro qué es prototipo y qué es producto: gestionar esa expectativa evita disgustos.',
        'Cada demo termina con próximos pasos acordados: el prototipo es un vehículo de decisión.',
      ],
      aiFocus:
        'La IA es tu equipo de prototipado: UI, integraciones y datos de prueba en horas, iterando delante del cliente si hace falta. Profundiza en decidir QUÉ enseñar — el corte vertical que convence al sponsor y al usuario a la vez es una decisión de negocio, no de velocidad.',
      resources: [
        { kind: 'libro', label: 'Sprint (Jake Knapp)', format: 'papel' },
        { kind: 'libro', label: 'Shape Up (Ryan Singer)', url: 'https://basecamp.com/shapeup', format: 'online' },
      ],
    },
    {
      id: 'fde/integraciones',
      name: 'Integraciones con lo existente',
      kind: 'tech',
      area: 'construir',
      x: 76,
      y: 40,
      weight: 2,
      prereqs: ['fde/plataforma-propia'],
      keyPoints: [
        'Integra por el camino más estable disponible: API oficial > export programado > scraping desesperado.',
        'Diseña para la fragilidad ajena: timeouts, reintentos e idempotencia ante sistemas que no controlas.',
        'Versiona y documenta cada contrato de integración: el sistema del cliente cambiará sin avisarte.',
        'Monta observabilidad desde el primer día: cuando la integración falle (fallará), necesitas saberlo antes que el cliente.',
        'Negocia entornos de prueba con el cliente: probar contra producción ajena es jugar con fuego.',
      ],
      aiFocus:
        'La IA escribe conectores y transformaciones de datos a partir de ejemplos y documentación a una velocidad brutal: aprovéchala para el 80% mecánico. Profundiza en el 20% traicionero — autenticaciones corporativas, límites de rate y comportamientos no documentados que solo descubres integrando de verdad.',
      resources: [
        { kind: 'libro', label: 'Enterprise Integration Patterns (Hohpe y Woolf)', format: 'papel' },
        { kind: 'libro', label: 'Release It! (Michael Nygard)', format: 'papel' },
      ],
    },
    {
      id: 'fde/seguridad-en-casa-cliente',
      name: 'Seguridad en casa del cliente',
      kind: 'skill',
      area: 'construir',
      x: 88,
      y: 50,
      weight: 3,
      prereqs: ['fde/integraciones'],
      keyPoints: [
        'Mínimo privilegio siempre: pide los accesos justos, documéntalos y devuélvelos al terminar.',
        'Nada de datos del cliente en tu portátil sin acuerdo explícito: trabaja en SUS entornos o en los pactados.',
        'Secretos gestionados como merecen: ni credenciales en el código, ni tokens en el chat del proyecto.',
        'Cumple las políticas del cliente aunque frenen: saltarse el proceso de seguridad ajeno destruye el contrato.',
        'Deja rastro auditable de lo que tocas: en entornos regulados, poder responder «quién hizo qué» te protege.',
      ],
      aiFocus:
        'Aquí la IA exige doble cuidado: pegar datos o código del cliente en herramientas no aprobadas puede violar el contrato y la ley. Profundiza en los acuerdos de uso de IA de cada cliente — qué modelos, con qué datos y dónde corren — antes de encender tu copiloto en su red.',
      resources: [
        { kind: 'doc', label: 'OWASP — seguridad de aplicaciones', url: 'https://owasp.org' },
        { kind: 'doc', label: 'INCIBE — ciberseguridad para empresas', url: 'https://www.incibe.es' },
      ],
    },

    // ── Comunicación y confianza (suroeste) ──────────────────────────────────
    {
      id: 'fde/comunicar-con-cliente',
      name: 'Comunicar con el cliente',
      kind: 'skill',
      area: 'cliente',
      x: 14,
      y: 26,
      weight: 3,
      prereqs: ['fde/entender-el-dominio'],
      keyPoints: [
        'Traduce siempre a valor de negocio: el cliente no compra endpoints, compra horas ahorradas y riesgo evitado.',
        'Cadencia fiable de comunicación: demo semanal y resumen escrito valen más que disponibilidad 24/7.',
        'Da malas noticias pronto y con plan: el retraso contado a tiempo es gestión, contado tarde es traición.',
        'Escucha más de lo que presentas: cada reunión es también discovery.',
        'Adapta el mensaje al interlocutor: el usuario, el jefe de área y el sponsor oyen historias distintas del mismo avance.',
      ],
      aiFocus:
        'La IA redacta actas, resúmenes ejecutivos y documentación de usuario en el idioma y tono de cada audiencia. Profundiza en la comunicación en vivo — leer la sala, detectar la objeción no verbalizada y ajustar el discurso al momento es lo que sostiene la relación.',
      resources: [
        { kind: 'libro', label: 'The Trusted Advisor (Maister, Green y Galford)', format: 'papel' },
        { kind: 'libro', label: 'Crucial Conversations (Patterson et al.)', format: 'papel' },
      ],
    },
    {
      id: 'fde/gestionar-expectativas',
      name: 'Gestionar expectativas',
      kind: 'skill',
      area: 'cliente',
      x: 28,
      y: 16,
      weight: 2,
      prereqs: ['fde/comunicar-con-cliente'],
      keyPoints: [
        'Promete menos y entrega más: la reputación del FDE se construye en la dirección correcta del asombro.',
        'Escribe el alcance y lo fuera de alcance: la memoria del cliente siempre recuerda la versión más ambiciosa.',
        'Renegocia en cuanto algo cambie: el silencio se interpreta como «todo va según lo prometido».',
        'Una demo espectacular sube las expectativas: acompáñala siempre del mapa honesto hacia producción.',
        'Aprende a decir no con alternativas: «eso no, pero este otro camino te da el 80% mañana».',
      ],
      aiFocus:
        'La velocidad de la IA es un arma de doble filo: entregar en dos días enseña al cliente a esperar TODO en dos días. Profundiza en explicar la diferencia entre prototipo y producto endurecido — gestionar el asombro inicial es ahora parte del oficio.',
      resources: [
        { kind: 'libro', label: 'Getting to Yes (Fisher y Ury)', format: 'papel' },
        { kind: 'post', label: 'First Round Review — trabajo con clientes enterprise', url: 'https://review.firstround.com' },
      ],
    },
    {
      id: 'fde/puente-cliente-equipo',
      name: 'Puente cliente-equipo',
      kind: 'skill',
      area: 'cliente',
      x: 42,
      y: 22,
      weight: 2,
      prereqs: ['fde/comunicar-con-cliente'],
      keyPoints: [
        'Eres el canal de doble sentido: contexto del cliente hacia dentro, avances del equipo hacia fuera.',
        'Documenta lo aprendido en terreno donde tu empresa lo encuentre: lo que no se escribe se pierde contigo.',
        'Filtra sin distorsionar: prioriza las peticiones del cliente, pero transmite su porqué intacto.',
        'Evita convertirte en cuello de botella: presenta a las personas, comparte accesos y contexto.',
        'Sincroniza expectativas entre tu PM, tu equipo de plataforma y el cliente: tres agendas, un plan.',
      ],
      aiFocus:
        'La IA mantiene la memoria del proyecto: resume hilos para el que llega nuevo y convierte tus notas de terreno en tickets accionables. Profundiza en la curaduría — decidir qué señal del cliente merece interrumpir al equipo de plataforma es criterio de negocio puro.',
      resources: [
        { kind: 'libro', label: 'Team Topologies (Skelton y Pais)', format: 'papel' },
        { kind: 'post', label: 'The Pragmatic Engineer — newsletter', url: 'https://newsletter.pragmaticengineer.com' },
      ],
    },

    // ── Del prototipo al producto (este-norte) ───────────────────────────────
    {
      id: 'fde/del-prototipo-al-producto',
      name: 'Del prototipo al producto',
      kind: 'skill',
      area: 'producto',
      x: 64,
      y: 26,
      weight: 3,
      prereqs: ['fde/prototipos-rapidos'],
      keyPoints: [
        'Decide temprano qué prototipo merece endurecerse: no todo lo que funcionó en demo debe vivir para siempre.',
        'Endurecer = tests, manejo de errores, seguridad, observabilidad y despliegue repetible — presupuéstalo.',
        'Paga la deuda del prototipo ANTES de escalar a más usuarios, no después del primer incidente.',
        'Planifica la transferencia: soporte, runbooks y formación para que el sistema viva sin ti.',
        'Define los criterios de «producción» con el cliente: qué SLA, qué soporte y quién responde a las 3 AM.',
      ],
      aiFocus:
        'La IA acelera el endurecimiento: genera tests desde el comportamiento del prototipo, añade manejo de errores y documenta a posteriori. Profundiza en el criterio de transición — reconocer el momento exacto en que seguir parcheando el prototipo sale más caro que endurecerlo es experiencia pura.',
      resources: [
        { kind: 'libro', label: 'Release It! (Michael Nygard)', format: 'papel' },
        { kind: 'libro', label: 'Accelerate (Forsgren, Humble y Kim)', format: 'papel' },
      ],
    },
    {
      id: 'fde/feedback-a-plataforma',
      name: 'Feedback hacia la plataforma',
      kind: 'skill',
      area: 'producto',
      x: 78,
      y: 18,
      weight: 2,
      prereqs: ['fde/del-prototipo-al-producto'],
      keyPoints: [
        'Cada solución custom repetida en dos clientes es una feature de plataforma esperando a nacer.',
        'Reporta con evidencia: qué pediste al producto, qué faltó y cuánto costó el rodeo.',
        'Generaliza sin cliente-centrismo: propone la primitiva, no tu caso particular con otro nombre.',
        'Cierra el ciclo: cuando la plataforma incorpore tu propuesta, migra tu solución custom y retírala.',
        'Tu experiencia en terreno es el discovery más barato que tiene tu empresa: hazla llegar a producto.',
      ],
      aiFocus:
        'La IA detecta patrones en los despliegues (qué se customiza una y otra vez) y redacta la propuesta de feature con los datos de campo. Profundiza en la abstracción correcta — distinguir la necesidad general del capricho de un cliente es lo que convierte a un FDE en diseñador de plataforma.',
      resources: [
        { kind: 'libro', label: 'Escaping the Build Trap (Melissa Perri)', format: 'papel' },
        { kind: 'post', label: 'SVPG — blog de Silicon Valley Product Group', url: 'https://www.svpg.com' },
      ],
    },
    {
      id: 'fde/medir-valor-entregado',
      name: 'Medir el valor entregado',
      kind: 'skill',
      area: 'producto',
      x: 90,
      y: 30,
      weight: 2,
      prereqs: ['fde/del-prototipo-al-producto'],
      keyPoints: [
        'Define la métrica de éxito CON el cliente antes de construir: horas ahorradas, errores evitados, ingresos.',
        'Mide el antes para poder demostrar el después: sin línea base no hay historia de ROI.',
        'Instrumenta el uso real: una herramienta que nadie abre es un fracaso silencioso que debes destapar tú.',
        'Convierte el valor en historia renovable: el ROI documentado es lo que justifica la siguiente fase.',
        'Sé honesto cuando el valor no llega: pivotar a tiempo con datos salva la relación (y el contrato).',
      ],
      aiFocus:
        'La IA monta dashboards de adopción y calcula el ROI desde los datos operativos sin esperar al analista. Profundiza en atribuir con honestidad — separar el valor que aportó tu sistema del que aportó el cambio de proceso es lo que da credibilidad a tu historia.',
      resources: [
        { kind: 'libro', label: 'Lean Analytics (Croll y Yoskovitz)', format: 'papel' },
        { kind: 'libro', label: 'Measure What Matters (John Doerr)', format: 'papel' },
      ],
    },

    // ── FDE en la era IA (norte) ─────────────────────────────────────────────
    {
      id: 'fde/entregar-en-dias-con-ia',
      name: 'Entregar valor en días con IA',
      kind: 'skill',
      area: 'fde-ia',
      x: 52,
      y: 10,
      weight: 3,
      prereqs: ['fde/prototipos-rapidos'],
      keyPoints: [
        'Redefine tu unidad de entrega: con IA, el ciclo descubrir→construir→demostrar cabe en una semana.',
        'Automatiza tu propio flujo: agentes para el boilerplate, la integración y los datos de prueba.',
        'Usa la velocidad para iterar MÁS con el cliente, no para acumular más features sin validar.',
        'Mantén el rigor con la prisa: cada entrega rápida pasa por revisión, tests y control de versiones.',
        'La ventaja competitiva del FDE-IA es el ciclo completo corto, no el tipeo rápido: mide tu lead time real.',
      ],
      aiFocus:
        'Este es el superpoder que define al FDE moderno: lo que una consultora entrega en meses, tú lo demuestras en días construyendo con agentes sobre tu plataforma. Profundiza en orquestar el flujo completo — la IA teclea, pero el corte del problema, la verificación y la puesta en escena son tuyos.',
      resources: [
        { kind: 'post', label: 'Simon Willison — IA aplicada al desarrollo', url: 'https://simonwillison.net' },
        { kind: 'post', label: 'Latent Space — ingeniería de IA aplicada', url: 'https://www.latent.space' },
      ],
    },
    {
      id: 'fde/calidad-con-ia-en-cliente',
      name: 'Calidad y seguridad con IA',
      kind: 'skill',
      area: 'fde-ia',
      x: 66,
      y: 10,
      weight: 2,
      prereqs: ['fde/entregar-en-dias-con-ia'],
      keyPoints: [
        'Revisa TODO el código generado antes de que toque el entorno del cliente: tú firmas, tú respondes.',
        'Monta tu harness portátil de verificación: tests, linters y smoke tests que viajan contigo a cada proyecto.',
        'Acota qué contexto del cliente compartes con modelos: datos sensibles solo en herramientas aprobadas por contrato.',
        'La velocidad de la IA no exime del proceso: control de cambios y trazabilidad también en el prototipo.',
        'Documenta qué se generó con IA y cómo se verificó: transparencia que protege a ambas partes.',
      ],
      aiFocus:
        'Entregar rápido en casa ajena eleva la apuesta: un fallo de calidad o una fuga de datos no rompe tu build, rompe un contrato. Profundiza en construir tu circuito de verificación portátil — la disciplina que te permite ir a velocidad IA sin jugarte la confianza del cliente.',
      resources: [
        { kind: 'doc', label: 'OWASP Top 10 para aplicaciones LLM', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
        { kind: 'doc', label: 'Google Engineering Practices — code review', url: 'https://google.github.io/eng-practices/review/' },
      ],
    },
    {
      id: 'fde/fde-de-confianza',
      name: 'FDE de confianza',
      kind: 'milestone',
      area: 'fde-ia',
      x: 90,
      y: 10,
      weight: 3,
      prereqs: [
        'fde/calidad-con-ia-en-cliente',
        'fde/medir-valor-entregado',
        'fde/gestionar-expectativas',
      ],
      keyPoints: [
        'El cliente te llama antes de decidir: has pasado de proveedor a asesor de confianza.',
        'Entregas valor medible en días, con calidad y seguridad demostrables, usando IA sin atajos sucios.',
        'Tus despliegues alimentan la plataforma: lo que aprendes en terreno se convierte en producto.',
        'Dejas sistemas que viven sin ti: documentados, transferidos y con dueños claros.',
        'Tu siguiente paso lo eliges tú: liderar despliegues mayores, producto, plataforma o emprender.',
      ],
      aiFocus:
        'El milestone del FDE: la combinación de terreno, plataforma e IA te hace capaz de resolver problemas de negocio completos casi en solitario — el perfil que las empresas de IA se disputan. Profundiza en la confianza: es el único activo del FDE que ni la mejor IA puede generar por ti.',
      resources: [
        { kind: 'libro', label: 'The Trusted Advisor (Maister, Green y Galford)', format: 'papel' },
        { kind: 'post', label: 'Palantir Blog — el rol del Forward Deployed Engineer', url: 'https://blog.palantir.com' },
      ],
    },
  ],
};
