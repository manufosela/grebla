/**
 * Isla «Engineering Manager» (doc /careerMap/engineering-manager) — MC-16, oleada 2.
 *
 * Sigue la convención de contenido de islas descrita en ./bases.js: ids de
 * ciudad prefijados por la disciplina ('engineering-manager/'), prereqs solo
 * intra-isla y sin ciclos, posiciones 0..100 separadas, pesos 1..3 y cada
 * ciudad con keyPoints, aiFocus y recursos reales. Basada en el roadmap de
 * engineering manager de roadmap.sh, adaptada a la era IA: el EM ya no solo
 * gestiona personas que escriben código, gestiona equipos aumentados por IA —
 * y su reto es medir y desarrollar sin caer en la ley de Goodhart.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const ENGINEERING_MANAGER_ISLAND = {
  id: 'engineering-manager',
  name: 'Isla Engineering Manager',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'transicion', name: 'De IC a manager' },
    { id: 'personas', name: 'Personas y desarrollo' },
    { id: 'equipo', name: 'Salud del equipo' },
    { id: 'delivery', name: 'Delivery y prioridades' },
    { id: 'contratacion', name: 'Contratación y onboarding' },
    { id: 'gestion-ia', name: 'Gestión en la era IA' },
  ],
  cities: [
    // ── De IC a manager (comarca de entrada, junto al puerto) ───────────────
    {
      id: 'engineering-manager/rol-del-em',
      name: 'El rol del EM',
      kind: 'skill',
      area: 'transicion',
      x: 46,
      y: 72,
      weight: 3,
      summary: 'El rol del EM es entender que tu trabajo ya no es tu código, sino que tu equipo funcione y crezca. Consiste en asumir que tu impacto ahora es a través de otros. Te capacita para hacer bien un trabajo distinto en vez de ser un senior con reuniones.',
      prereqs: [],
      keyPoints: [
        'Entiende el cambio de contrato: tu output ya no es tu código, es el output de tu equipo.',
        'Diferencia los sombreros: people management, delivery, técnica y estrategia — y cuánto pesa cada uno en TU empresa.',
        'Habla con tu manager para acordar expectativas explícitas de los primeros 90 días.',
        'Asume que vuelves a ser junior: gestionar es una profesión nueva, no un ascenso del mismo oficio.',
        'Decide si de verdad quieres este camino: el péndulo IC↔manager es legítimo y reversible.',
      ],
      aiFocus:
        'La IA no gestiona personas: acelera a los ICs y eso hace MÁS valioso al manager que da contexto, dirección y cobertura. Profundiza en entender qué partes de tu rol son juicio humano irreducible (confianza, motivación, política) y cuáles puedes apoyar con herramientas.',
      resources: [
        { kind: 'libro', label: 'The Manager’s Path (Camille Fournier)', format: 'papel' },
        { kind: 'doc', label: 'roadmap.sh — Engineering Manager', url: 'https://roadmap.sh/engineering-manager' },
        { kind: 'post', label: 'Rands in Repose — ensayos de management', url: 'https://randsinrepose.com' },
      ],
    },
    {
      id: 'engineering-manager/soltar-el-codigo',
      name: 'Soltar el teclado',
      kind: 'skill',
      area: 'transicion',
      x: 32,
      y: 66,
      weight: 2,
      summary: 'Soltar el teclado es dejar de ser quien resuelve los problemas técnicos para que lo haga el equipo. Consiste en resistir la tentación de meterte y crear espacio para que otros crezcan. Te capacita para escalar tu impacto en vez de ser el cuello de botella de todo.',
      prereqs: ['engineering-manager/rol-del-em'],
      keyPoints: [
        'Sal del camino crítico: no cojas tareas que bloqueen al equipo si tu semana se llena de reuniones.',
        'Mantén contacto técnico sin competir: revisa PRs, participa en diseño, coge tareas pequeñas y sin fecha.',
        'Resiste el impulso de resolver tú lo que un miembro del equipo puede resolver aprendiendo.',
        'Redefine tu dopamina: celebra los logros del equipo como antes celebrabas tus merges.',
        'Protege un bloque semanal de trabajo profundo para no perder criterio técnico.',
      ],
      aiFocus:
        'Con IA puedes seguir tocando código en los huecos sin bloquear a nadie: prototipos, revisiones y exploraciones que antes no te cabían. Profundiza en usarla para mantener tu criterio técnico afilado — leer y evaluar código del equipo — sin volver a ocupar el camino crítico.',
      resources: [
        { kind: 'libro', label: 'An Elegant Puzzle (Will Larson)', format: 'papel' },
        { kind: 'post', label: 'The Pragmatic Engineer — newsletter', url: 'https://newsletter.pragmaticengineer.com' },
      ],
    },
    {
      id: 'engineering-manager/gestion-del-tiempo',
      name: 'Gestión del tiempo y la energía',
      kind: 'skill',
      area: 'transicion',
      x: 60,
      y: 66,
      weight: 2,
      summary: 'La gestión del tiempo y la energía es proteger tu foco cuando el día se llena de interrupciones. Consiste en priorizar, agrupar y decir que no a lo que no importa. Te capacita para no acabar apagando fuegos sin haber hecho lo que de verdad movía la aguja.',
      prereqs: ['engineering-manager/rol-del-em'],
      keyPoints: [
        'Acepta que tu agenda es tu herramienta principal: audítala cada semana contra tus prioridades reales.',
        'Distingue maker schedule de manager schedule y protege el del equipo, no solo el tuyo.',
        'Agrupa reuniones y deja huecos de recuperación: la calidad de tus decisiones depende de tu energía.',
        'Aprende a declinar reuniones sin agenda ni resultado esperado.',
        'Revisa mensualmente qué puedes delegar, automatizar o eliminar de tu plato.',
      ],
      aiFocus:
        'La IA te quita la parte mecánica del rol: resumir hilos, preparar borradores de docs, ordenar notas de reuniones. Profundiza en decidir a qué dedicas el tiempo liberado — más 1:1s y más pensamiento estratégico, no más reuniones de relleno.',
      resources: [
        { kind: 'post', label: 'Paul Graham — Maker’s Schedule, Manager’s Schedule', url: 'https://www.paulgraham.com' },
        { kind: 'libro', label: 'Deep Work (Cal Newport)', format: 'papel' },
      ],
    },

    // ── Personas y desarrollo (oeste) ────────────────────────────────────────
    {
      id: 'engineering-manager/one-on-ones',
      name: '1:1s que funcionan',
      kind: 'skill',
      area: 'personas',
      x: 20,
      y: 56,
      weight: 3,
      summary: 'Los 1:1s que funcionan son las conversaciones regulares que sostienen la relación con cada persona. Consiste en escuchar, no informar, y que sea SU espacio. Te capacita para conocer a tu gente, detectar problemas pronto y construir confianza real.',
      prereqs: ['engineering-manager/soltar-el-codigo'],
      keyPoints: [
        'El 1:1 es la reunión de la otra persona: su agenda primero, tus temas después.',
        'Cadencia sagrada: mejor 30 minutos semanales fiables que una hora mensual que se cancela.',
        'No lo conviertas en status report: para eso ya existen el board y los standups.',
        'Haz preguntas abiertas («¿qué te frena?», «¿qué harías distinto?») y aguanta el silencio.',
        'Toma notas y haz seguimiento: los compromisos del 1:1 que se evaporan destruyen la confianza.',
      ],
      aiFocus:
        'La IA puede prepararte el contexto del 1:1 (PRs, incidencias, temas pendientes) y ayudarte a detectar patrones en tus notas a lo largo de meses. Profundiza tú en la conversación misma: escuchar de verdad y leer lo que no se dice es exactamente lo que ninguna herramienta hace por ti.',
      resources: [
        { kind: 'libro', label: 'The Manager’s Path (Camille Fournier)', format: 'papel' },
        { kind: 'post', label: 'Lara Hogan — management y liderazgo', url: 'https://larahogan.me' },
      ],
    },
    {
      id: 'engineering-manager/feedback',
      name: 'Feedback continuo',
      kind: 'skill',
      area: 'personas',
      x: 10,
      y: 44,
      weight: 3,
      summary: 'El feedback continuo es decir las cosas a tiempo, concretas y sin dramatizar, en ambas direcciones. Consiste en normalizar el feedback como algo cotidiano, no de la evaluación anual. Te capacita para que la gente mejore de verdad y no se entere de nada por sorpresa.',
      prereqs: ['engineering-manager/one-on-ones'],
      keyPoints: [
        'Da feedback frecuente y pequeño: nada de lo que se diga en la review anual debería ser sorpresa.',
        'Usa hechos observables + impacto, no juicios de carácter: «cuando X, pasó Y», no «eres Z».',
        'El feedback positivo específico es tan importante como el correctivo — y más escaso.',
        'Radical candor: preocúpate personalmente Y reta directamente; ni agresividad ni silencio cómplice.',
        'Pide feedback sobre ti mismo primero: modelas la cultura que quieres tener.',
      ],
      aiFocus:
        'La IA puede ayudarte a ensayar conversaciones de feedback y a pulir el tono de un mensaje escrito antes de enviarlo. Profundiza en la observación directa: el feedback vale por la calidad de los ejemplos concretos que tú has recogido, y eso no se delega.',
      resources: [
        { kind: 'libro', label: 'Radical Candor (Kim Scott)', format: 'papel' },
        { kind: 'libro', label: 'Thanks for the Feedback (Stone y Heen)', format: 'papel' },
        { kind: 'post', label: 'LeadDev — artículos de engineering leadership', url: 'https://leaddev.com' },
      ],
    },
    {
      id: 'engineering-manager/marcos-de-carrera',
      name: 'Marcos de carrera',
      kind: 'skill',
      area: 'personas',
      x: 22,
      y: 44,
      weight: 3,
      summary: 'Los marcos de carrera son dejar claro qué se espera en cada nivel y cómo se crece. Consiste en usar y aplicar con justicia una escala de niveles. Te capacita para que las promociones sean transparentes y la gente sepa en qué trabajar.',
      prereqs: ['engineering-manager/one-on-ones'],
      keyPoints: [
        'Define (o adopta) un career ladder con niveles y expectativas observables por nivel.',
        'Separa la conversación de carrera de la de rendimiento: son músculos distintos.',
        'Cada persona debería saber qué le falta para el siguiente nivel — por escrito, sin adivinanzas.',
        'Ofrece los dos raíles: track IC senior y track management, con igual prestigio y salario.',
        'Revisa el marco cuando cambia el oficio: los ladders pre-IA sobrevaloran producir código a mano.',
      ],
      aiFocus:
        'La era IA obliga a reescribir los marcos de carrera: «escribe mucho código» ya no distingue seniority, «juzga, verifica y multiplica al equipo» sí. Profundiza en definir expectativas por nivel donde el criterio técnico y el apalancamiento pesen más que el volumen de output.',
      resources: [
        { kind: 'doc', label: 'progression.fyi — colección de career frameworks', url: 'https://progression.fyi' },
        { kind: 'libro', label: 'The Manager’s Path (Camille Fournier)', format: 'papel' },
      ],
    },
    {
      id: 'engineering-manager/delegacion',
      name: 'Delegar de verdad',
      kind: 'skill',
      area: 'personas',
      x: 32,
      y: 52,
      weight: 2,
      summary: 'Delegar de verdad es dar a alguien un problema con su contexto y su autonomía, no una lista de órdenes. Consiste en soltar el cómo y quedarte con el qué y el porqué. Te capacita para multiplicar lo que hace el equipo y para que la gente crezca haciéndolo.',
      prereqs: ['engineering-manager/one-on-ones'],
      keyPoints: [
        'Delega resultados, no tareas: define el qué y el porqué, deja el cómo a la otra persona.',
        'Ajusta el nivel de delegación a la madurez: desde «hazlo conmigo» hasta «decide y cuéntame».',
        'Acepta el 80%: si esperas tu solución exacta, no estás delegando, estás dictando.',
        'Delega también lo visible y lo apetecible (charlas, diseño), no solo lo tedioso.',
        'Haz seguimiento acordado de antemano, no micromanagement por sorpresa.',
      ],
      aiFocus:
        'Tu equipo ahora delega en la IA igual que tú delegas en ellos: enseña a delegar bien en ambos niveles — contexto claro, criterio de aceptación y verificación. Profundiza en detectar cuándo alguien «delega» en la IA lo que aún no sabe juzgar: ahí hay una conversación de desarrollo.',
      resources: [
        { kind: 'libro', label: 'Turn the Ship Around! (David Marquet)', format: 'papel' },
        { kind: 'post', label: 'Rands in Repose — ensayos de management', url: 'https://randsinrepose.com' },
      ],
    },
    {
      id: 'engineering-manager/conversaciones-dificiles',
      name: 'Conversaciones difíciles',
      kind: 'skill',
      area: 'personas',
      x: 14,
      y: 32,
      weight: 2,
      summary: 'Las conversaciones difíciles son abordar el bajo rendimiento, el conflicto o la mala noticia sin escaquearte. Consiste en ser claro y humano a la vez, con datos y respeto. Te capacita para resolver los problemas que otros evitan hasta que explotan.',
      prereqs: ['engineering-manager/feedback'],
      keyPoints: [
        'No las pospongas: el coste de una conversación difícil crece cada semana que la evitas.',
        'Prepárala por escrito: hechos, impacto, qué necesitas que cambie y para cuándo.',
        'En bajo rendimiento, sé claro con las consecuencias: la ambigüedad compasiva es crueldad diferida.',
        'Documenta los acuerdos (PIP si toca) y cumple tu parte del plan escrupulosamente.',
        'Separa la persona del problema: dureza con el asunto, respeto con la persona.',
      ],
      aiFocus:
        'La IA te sirve de sparring: ensaya la conversación, anticipa objeciones y revisa que tu mensaje no suene ambiguo. Profundiza en gestionarte a ti — tu incomodidad es el motivo real por el que estas conversaciones se retrasan, y eso solo se entrena en vivo.',
      resources: [
        { kind: 'libro', label: 'Crucial Conversations (Patterson et al.)', format: 'papel' },
        { kind: 'libro', label: 'Difficult Conversations (Stone, Patton y Heen)', format: 'papel' },
      ],
    },

    // ── Salud del equipo (centro) ────────────────────────────────────────────
    {
      id: 'engineering-manager/seguridad-psicologica',
      name: 'Seguridad psicológica',
      kind: 'skill',
      area: 'equipo',
      x: 34,
      y: 38,
      weight: 3,
      summary: 'La seguridad psicológica es crear un equipo donde se puede preguntar, discrepar y equivocarse sin miedo. Consiste en modelar la vulnerabilidad y premiar la sinceridad. Te capacita para desbloquear el rendimiento real: la gente que no teme, aporta.',
      prereqs: ['engineering-manager/one-on-ones'],
      keyPoints: [
        'Seguridad psicológica no es comodidad: es poder disentir, preguntar y fallar sin castigo.',
        'Modela la vulnerabilidad: admite tus errores en público antes de pedir que otros lo hagan.',
        'Postmortems sin culpa: se analizan sistemas y decisiones, nunca se busca al culpable.',
        'Observa quién habla en las reuniones y quién no; reparte el aire activamente.',
        'Reacciona bien a las malas noticias: la primera vez que mates al mensajero, dejarán de llegar.',
      ],
      aiFocus:
        'En equipos con IA aparece un miedo nuevo: admitir que no sabes algo que «la IA hace en segundos», o que tu rol cambia. Profundiza en crear el espacio donde se pueda hablar de eso abiertamente — los equipos que esconden sus dudas sobre la IA la usan peor y se queman antes.',
      resources: [
        { kind: 'libro', label: 'The Fearless Organization (Amy Edmondson)', format: 'papel' },
        { kind: 'doc', label: 'Google re:Work — guías de equipos efectivos', url: 'https://rework.withgoogle.com' },
      ],
    },
    {
      id: 'engineering-manager/dinamicas-de-equipo',
      name: 'Dinámicas y topología de equipos',
      kind: 'skill',
      area: 'equipo',
      x: 44,
      y: 30,
      weight: 2,
      summary: 'Las dinámicas y la topología de equipos son entender cómo se organizan los equipos y cómo interactúan. Consiste en aplicar patrones (stream-aligned, plataforma) según el trabajo. Te capacita para diseñar equipos que fluyen en vez de pisarse y bloquearse.',
      prereqs: ['engineering-manager/seguridad-psicologica'],
      keyPoints: [
        'Conoce los cuatro tipos de equipo (stream-aligned, platform, enabling, complicated-subsystem) y cuál es el tuyo.',
        'Reduce la carga cognitiva del equipo: un equipo que lo lleva todo no lleva bien nada.',
        'Diseña las interacciones entre equipos (colaboración, X-as-a-service, facilitación) a propósito, no por inercia.',
        'La ley de Conway va a por ti: la arquitectura copiará tu organigrama, úsalo a tu favor.',
        'Cuida los rituales que sí aportan (retro, planning) y mata los que son teatro.',
      ],
      aiFocus:
        'La IA reduce el coste de codificar pero no el de coordinar: los límites de equipo y la carga cognitiva se vuelven EL cuello de botella. Profundiza en Team Topologies para diseñar equipos pequeños y autónomos donde la IA multiplica en vez de amplificar el caos.',
      resources: [
        { kind: 'libro', label: 'Team Topologies (Skelton y Pais)', format: 'papel' },
        { kind: 'doc', label: 'teamtopologies.com — recursos oficiales', url: 'https://teamtopologies.com' },
      ],
    },
    {
      id: 'engineering-manager/motivacion-y-burnout',
      name: 'Motivación y burnout',
      kind: 'skill',
      area: 'equipo',
      x: 24,
      y: 24,
      weight: 2,
      summary: 'La motivación y el burnout son cuidar la energía del equipo antes de que se apague. Consiste en reconocer las señales, ajustar la carga y entender qué mueve a cada persona. Te capacita para sostener el rendimiento a largo plazo sin quemar a la gente por el camino.',
      prereqs: ['engineering-manager/seguridad-psicologica'],
      keyPoints: [
        'Motivación intrínseca = autonomía + maestría + propósito; tu trabajo es no cargártela.',
        'Detecta el burnout pronto: cinismo, retiro de las conversaciones y bajada de calidad sostenida.',
        'El burnout se arregla cambiando la carga y el contexto, no con una semana de vacaciones.',
        'Reparte el trabajo glamuroso y el trabajo sucio (guardias, mantenimiento) con justicia visible.',
        'Vigila a tus mejores personas: los high performers se queman en silencio y se van sin avisar.',
      ],
      aiFocus:
        'La presión de «con IA deberías ir el doble de rápido» es una receta de burnout nueva y muy real. Profundiza en proteger al equipo de expectativas infladas: la IA acelera tareas, no elimina el coste de pensar, revisar y responsabilizarse del resultado.',
      resources: [
        { kind: 'libro', label: 'Drive (Daniel Pink)', format: 'papel' },
        { kind: 'libro', label: 'Resilient Management (Lara Hogan)', format: 'papel' },
        { kind: 'post', label: 'LeadDev — artículos de engineering leadership', url: 'https://leaddev.com' },
      ],
    },

    // ── Delivery y prioridades (este-centro) ─────────────────────────────────
    {
      id: 'engineering-manager/prioridades-y-foco',
      name: 'Prioridades y foco',
      kind: 'skill',
      area: 'delivery',
      x: 58,
      y: 52,
      weight: 3,
      summary: 'Las prioridades y el foco son proteger al equipo de hacerlo todo a la vez y mal. Consiste en elegir lo que importa, comunicarlo y sostenerlo frente a la presión. Te capacita para que el equipo avance en lo que de verdad mueve la aguja, no en el ruido.',
      prereqs: ['engineering-manager/gestion-del-tiempo'],
      keyPoints: [
        'Si todo es prioritario, nada lo es: mantén una lista ordenada y públicamente visible.',
        'Aprende a decir no (o «no ahora») con el porqué: proteger el foco del equipo es tu trabajo.',
        'Limita el WIP: pocas cosas terminadas valen más que muchas empezadas.',
        'Negocia alcance antes que fechas o calidad: el triángulo de hierro no se estira.',
        'Reserva capacidad explícita para deuda técnica e imprevistos (20% es un buen punto de partida).',
      ],
      aiFocus:
        'Cuando construir se abarata con IA, el riesgo es decir sí a todo y morir de WIP: priorizar se vuelve MÁS crítico, no menos. Profundiza en el coste de oportunidad — la pregunta ya no es «¿podemos hacerlo?» (casi siempre sí) sino «¿es esto lo mejor que podemos hacer ahora?».',
      resources: [
        { kind: 'libro', label: 'Making Work Visible (Dominica DeGrandis)', format: 'papel' },
        { kind: 'libro', label: 'Essentialism (Greg McKeown)', format: 'papel' },
      ],
    },
    {
      id: 'engineering-manager/metricas-sin-goodhart',
      name: 'Medir sin Goodhart',
      kind: 'skill',
      area: 'delivery',
      x: 70,
      y: 44,
      weight: 3,
      summary: 'Medir sin Goodhart es usar métricas sin que se conviertan en el objetivo que se hace trampa. Consiste en medir para entender, no para presionar, y mirar varias señales. Te capacita para guiarte con datos sin que el equipo optimice el número y no el resultado.',
      prereqs: ['engineering-manager/prioridades-y-foco'],
      keyPoints: [
        'Ley de Goodhart: cuando una medida se convierte en objetivo, deja de ser buena medida.',
        'Usa las métricas DORA (lead time, frecuencia de despliegue, MTTR, change failure rate) a nivel de equipo, nunca de individuo.',
        'Combina velocidad con salud: SPACE recuerda que satisfacción y colaboración también cuentan.',
        'Las métricas abren conversaciones, no cierran evaluaciones: úsalas para preguntar «¿qué nos frena?».',
        'Desconfía de líneas de código, número de commits y story points como medida de valor.',
      ],
      aiFocus:
        'Con IA los proxies baratos (commits, líneas, PRs) se inflan solos y Goodhart se dispara: medir «cuánto código» ya no mide nada. Profundiza en métricas de resultado (fiabilidad, lead time, valor entregado) y en detectar cuándo un dashboard bonito está deformando el comportamiento del equipo.',
      resources: [
        { kind: 'libro', label: 'Accelerate (Forsgren, Humble y Kim)', format: 'papel' },
        { kind: 'doc', label: 'DORA — investigación y métricas', url: 'https://dora.dev' },
      ],
    },
    {
      id: 'engineering-manager/gestion-de-proyectos',
      name: 'Ejecución y estimaciones',
      kind: 'skill',
      area: 'delivery',
      x: 56,
      y: 38,
      weight: 2,
      summary: 'La ejecución y las estimaciones son sacar el trabajo adelante con plazos honestos y sin sorpresas. Consiste en descomponer, estimar con incertidumbre y comunicar el avance. Te capacita para que el equipo entregue de forma predecible y confiable.',
      prereqs: ['engineering-manager/prioridades-y-foco'],
      keyPoints: [
        'Trocea el trabajo en entregas pequeñas y valiosas: el riesgo se gestiona reduciendo el tamaño del lote.',
        'Las estimaciones son intervalos con incertidumbre, no promesas: comunica rangos y supuestos.',
        'Detecta bloqueos y dependencias a diario; desatascar es de las cosas más valiosas que haces.',
        'Comunica desviaciones pronto y con plan: las malas noticias no mejoran con el tiempo.',
        'Cierra los proyectos con retro y aprendizaje explícito, no solo con celebración.',
      ],
      aiFocus:
        'La IA acorta la fase de escribir código pero no la de aclarar requisitos, integrar y verificar: las estimaciones «con IA» fallan si solo descuentas el tipeo. Profundiza en medir dónde se va el tiempo real de tu equipo antes de recalibrar plazos por la vía del entusiasmo.',
      resources: [
        { kind: 'libro', label: 'Shape Up (Ryan Singer)', url: 'https://basecamp.com/shapeup', format: 'online' },
        { kind: 'libro', label: 'The Phoenix Project (Kim, Behr y Spafford)', format: 'papel' },
      ],
    },
    {
      id: 'engineering-manager/comunicar-hacia-arriba',
      name: 'Gestionar hacia arriba y a los lados',
      kind: 'skill',
      area: 'delivery',
      x: 82,
      y: 54,
      weight: 2,
      summary: 'Gestionar hacia arriba y a los lados es comunicar bien con tu jefe y con otros equipos. Consiste en dar contexto, malas noticias a tiempo y defender a tu equipo. Te capacita para conseguir apoyo y recursos y para que tu equipo no quede en tierra de nadie.',
      prereqs: ['engineering-manager/prioridades-y-foco'],
      keyPoints: [
        'Traduce lo técnico a impacto de negocio: tu dirección no compra refactors, compra riesgo y velocidad.',
        'Sin sorpresas: tu manager debe enterarse de los problemas por ti, no por otros.',
        'Escribe resúmenes cortos y periódicos (qué avanzó, qué preocupa, qué necesitas).',
        'Construye alianzas con producto, diseño y otros EMs antes de necesitarlas.',
        'Pide contexto de negocio activamente: gestionar hacia arriba también es hacer buenas preguntas.',
      ],
      aiFocus:
        'La IA redacta el borrador del status report en minutos; el valor está en TU selección de qué contar y qué señal de alarma subir. Profundiza en narrativa ejecutiva: convertir veinte hilos técnicos en tres frases con decisión incluida es criterio, no redacción.',
      resources: [
        { kind: 'post', label: 'The Pragmatic Engineer — newsletter', url: 'https://newsletter.pragmaticengineer.com' },
        { kind: 'libro', label: 'An Elegant Puzzle (Will Larson)', format: 'papel' },
      ],
    },

    // ── Contratación y onboarding (este) ─────────────────────────────────────
    {
      id: 'engineering-manager/entrevistas',
      name: 'Entrevistar bien',
      kind: 'skill',
      area: 'contratacion',
      x: 84,
      y: 32,
      weight: 2,
      summary: 'Entrevistar bien es evaluar de forma justa y consistente si alguien encaja, sin sesgos ni improvisación. Consiste en preguntas con criterio y decisiones basadas en evidencia. Te capacita para construir el equipo con buenas incorporaciones y no con corazonadas.',
      prereqs: ['engineering-manager/marcos-de-carrera'],
      keyPoints: [
        'Define la rúbrica ANTES de entrevistar: qué señales buscas y qué respuestas las evidencian.',
        'Entrevistas estructuradas: mismas preguntas para todos los candidatos reduce sesgo y ruido.',
        'Evalúa cómo piensa y colabora, no cuánto trivia recuerda: el trivia ya lo responde una máquina.',
        'Cuida la experiencia del candidato: cada entrevista es marketing de tu equipo.',
        'Decide con datos de la rúbrica y debrief estructurado, no con «me dio buena sensación».',
      ],
      aiFocus:
        'Los candidatos usan IA para preparar (y a veces para responder): los ejercicios de memorizar algoritmos ya no discriminan. Profundiza en rediseñar tu proceso — pair programming realista, revisar código generado, razonar trade-offs en voz alta — para evaluar el criterio que de verdad contratas.',
      resources: [
        { kind: 'libro', label: 'Who (Geoff Smart y Randy Street)', format: 'papel' },
        { kind: 'post', label: 'First Round Review — hiring y management', url: 'https://review.firstround.com' },
      ],
    },
    {
      id: 'engineering-manager/onboarding',
      name: 'Onboarding efectivo',
      kind: 'skill',
      area: 'contratacion',
      x: 72,
      y: 22,
      weight: 2,
      summary: 'El onboarding efectivo es que quien entra sea productivo y se sienta parte pronto. Consiste en un plan de primeros días, un buddy y objetivos claros. Te capacita para no desperdiciar las primeras semanas de cada incorporación en la niebla.',
      prereqs: ['engineering-manager/entrevistas'],
      keyPoints: [
        'Prepara el primer día antes de que llegue: accesos, buddy asignado y primera tarea elegida.',
        'Primera contribución a producción en la primera semana: pequeña, real y celebrada.',
        'Plan 30/60/90 por escrito con expectativas claras en cada hito.',
        'El onboarding es un test de tu documentación: cada tropiezo del nuevo es un bug de tus docs.',
        'Pide feedback al recién llegado: sus ojos frescos ven lo que el equipo ya ha normalizado.',
      ],
      aiFocus:
        'Un asistente de IA con acceso al repo responde al nuevo el 80% de las preguntas «tontas» sin coste social, y acelera semanas el onboarding. Profundiza en lo que la IA no transfiere: contexto histórico, relaciones y el porqué político de las decisiones — eso sigue siendo tu trabajo.',
      resources: [
        { kind: 'post', label: 'Lara Hogan — management y liderazgo', url: 'https://larahogan.me' },
        { kind: 'doc', label: 'Google re:Work — guías de equipos efectivos', url: 'https://rework.withgoogle.com' },
      ],
    },
    {
      id: 'engineering-manager/construir-el-equipo',
      name: 'Diseñar el equipo',
      kind: 'skill',
      area: 'contratacion',
      x: 94,
      y: 42,
      weight: 2,
      summary: 'Diseñar el equipo es decidir qué perfiles necesitas y cómo se complementan. Consiste en pensar en habilidades, seniority y dinámicas antes de contratar a lo loco. Te capacita para construir un equipo equilibrado donde las piezas encajan.',
      prereqs: ['engineering-manager/entrevistas'],
      keyPoints: [
        'Contrata por complementariedad, no por clonación: cubre huecos de habilidades y de perspectiva.',
        'Piensa en composición de seniority: un equipo solo de seniors es tan frágil como uno solo de juniors.',
        'Trabaja el pipeline antes de tener la vacante: cultivar red y marca de equipo lleva meses.',
        'La retención empieza en el diseño del rol: gente en roles que les hacen crecer no se va.',
        'Planifica sucesión: si alguien clave se fuera mañana, ¿qué se rompe?',
      ],
      aiFocus:
        'La IA cambia el mix que necesitas: menos manos para producir código, más criterio para dirigirlo y verificarlo — replantea qué perfiles contratas y qué haces crecer dentro. Profundiza en el caso de los juniors: siguen siendo tu cantera de seniors, diseña su rampa en un mundo donde la IA hace «su» trabajo de antes.',
      resources: [
        { kind: 'libro', label: 'Team Topologies (Skelton y Pais)', format: 'papel' },
        { kind: 'post', label: 'The Pragmatic Engineer — newsletter', url: 'https://newsletter.pragmaticengineer.com' },
      ],
    },

    // ── Gestión en la era IA (norte) ─────────────────────────────────────────
    {
      id: 'engineering-manager/equipos-aumentados-ia',
      name: 'Equipos aumentados por IA',
      kind: 'skill',
      area: 'gestion-ia',
      x: 58,
      y: 22,
      weight: 3,
      summary: 'Los equipos aumentados por IA son liderar cuando parte del trabajo lo hace o lo acelera la IA. Consiste en repensar procesos, roles y calidad con la IA en la ecuación. Te capacita para sacar partido a la IA en el equipo sin perder el criterio ni la responsabilidad.',
      prereqs: ['engineering-manager/dinamicas-de-equipo', 'engineering-manager/gestion-de-proyectos'],
      keyPoints: [
        'Establece normas de equipo explícitas sobre uso de IA: qué se delega, qué se revisa y cómo se declara.',
        'El code review cambia: más volumen de código plausible exige revisores mejores, no menos review.',
        'Invierte en el «harness» del equipo: tests, CI y entornos que verifican rápido lo que la IA produce.',
        'Presupuesta y gobierna las herramientas de IA como parte de la plataforma, no como juguetes personales.',
        'Comparte aprendizajes de uso de IA en el equipo: los buenos prompts y flujos son conocimiento común.',
      ],
      aiFocus:
        'Gestionar un equipo aumentado por IA es gestionar un sistema nuevo: el cuello de botella se mueve del tipeo a la revisión, la integración y la confianza. Profundiza en rediseñar el flujo de trabajo completo — quién verifica qué, dónde exige el proceso juicio humano y cómo evitas una fábrica de código sin dueño.',
      resources: [
        { kind: 'post', label: 'Simon Willison — IA aplicada al desarrollo', url: 'https://simonwillison.net' },
        { kind: 'post', label: 'The Pragmatic Engineer — newsletter', url: 'https://newsletter.pragmaticengineer.com' },
        { kind: 'doc', label: 'roadmap.sh — AI Engineer', url: 'https://roadmap.sh/ai-engineer' },
      ],
    },
    {
      id: 'engineering-manager/medir-productividad-ia',
      name: 'Medir el impacto de la IA',
      kind: 'skill',
      area: 'gestion-ia',
      x: 46,
      y: 14,
      weight: 2,
      summary: 'Medir el impacto de la IA es saber si de verdad ayuda o solo lo parece, sin caer en métricas vanidosas. Consiste en medir resultados de negocio, no líneas generadas. Te capacita para decidir con datos dónde la IA aporta y dónde estorba.',
      prereqs: ['engineering-manager/equipos-aumentados-ia'],
      keyPoints: [
        'Mide resultado (lead time, calidad, incidentes), no actividad (líneas generadas, prompts lanzados).',
        'Compara flujo completo: si la IA acelera codificar pero infla el review, el neto puede ser cero.',
        'Vigila la calidad diferida: defectos, churn de código y deuda que aflora semanas después.',
        'Encuesta la experiencia del equipo: la percepción de fricción es dato, no anécdota.',
        'Cuidado con el teatro de adopción: obligar a usar IA para lucir métricas es Goodhart con otro sombrero.',
      ],
      aiFocus:
        'Todo el mundo te pedirá «el ROI de la IA» y casi todas las cifras fáciles mienten. Profundiza en diseñar una medición honesta: hipótesis por delante, métricas DORA/SPACE de fondo y la humildad de aceptar que parte del impacto es cualitativo y tarda en verse.',
      resources: [
        { kind: 'doc', label: 'DORA — investigación y métricas', url: 'https://dora.dev' },
        { kind: 'libro', label: 'Accelerate (Forsgren, Humble y Kim)', format: 'papel' },
      ],
    },
    {
      id: 'engineering-manager/liderar-en-cambio',
      name: 'Liderar en la incertidumbre',
      kind: 'skill',
      area: 'gestion-ia',
      x: 32,
      y: 12,
      weight: 2,
      summary: 'Liderar en la incertidumbre es guiar al equipo cuando las reglas cambian bajo los pies (como ahora con la IA). Consiste en dar dirección y calma sin fingir que lo tienes todo claro. Te capacita para sostener a tu gente en la transformación en vez de sufrirla.',
      prereqs: ['engineering-manager/equipos-aumentados-ia'],
      keyPoints: [
        'Habla del elefante: tu equipo se pregunta si la IA amenaza su trabajo; el silencio alimenta el miedo.',
        'Da certezas donde las tengas (valores, criterios de evaluación) y honestidad donde no.',
        'Convierte la ansiedad en agencia: tiempo y presupuesto para que el equipo aprenda y experimente.',
        'Protege la identidad profesional: ayuda a cada persona a redefinir su valor más allá de «tecleo rápido».',
        'Itera tus propias prácticas de gestión: lo que funcionaba en 2020 no es sagrado.',
      ],
      aiFocus:
        'En plena ola de IA, la gestión del cambio deja de ser una skill ocasional y pasa a ser tu día a día. Profundiza en comunicar dirección con honestidad — «esto cambia, así nos preparamos» — porque la alternativa es que cada persona gestione su miedo a solas y con LinkedIn abierto.',
      resources: [
        { kind: 'libro', label: 'Leading Change (John Kotter)', format: 'papel' },
        { kind: 'post', label: 'LeadDev — artículos de engineering leadership', url: 'https://leaddev.com' },
      ],
    },
    {
      id: 'engineering-manager/manager-multiplicador',
      name: 'Manager multiplicador',
      kind: 'milestone',
      area: 'gestion-ia',
      x: 70,
      y: 10,
      weight: 3,
      summary: 'Ser un manager multiplicador es el hito de que tu equipo rinda más y crezca más por tenerte a ti. Consiste en juntar todo lo de la isla: personas, foco, comunicación y criterio. Te capacita para demostrar que lideras de verdad, no que solo gestionas tareas.',
      prereqs: [
        'engineering-manager/medir-productividad-ia',
        'engineering-manager/onboarding',
        'engineering-manager/conversaciones-dificiles',
      ],
      keyPoints: [
        'Tu equipo entrega bien SIN ti en la sala: has construido sistema, no dependencia.',
        'Las personas a tu cargo crecen y son promocionadas: tu cantera habla por ti.',
        'Usas la IA como palanca organizativa consciente, con normas, medición honesta y sin teatro.',
        'Dices no con criterio, comunicas hacia arriba sin sorpresas y proteges el foco del equipo.',
        'Sabes cuál es tu siguiente paso (senior EM, director, o volver a IC) y lo eliges tú.',
      ],
      aiFocus:
        'El milestone del EM en la era IA: un equipo sano y aumentado, donde la máquina hace lo mecánico y las personas ponen criterio, contexto y responsabilidad. Profundiza siempre en lo mismo — multiplicar a otros es el único output tuyo que ninguna IA va a generar.',
      resources: [
        { kind: 'libro', label: 'The Manager’s Path (Camille Fournier)', format: 'papel' },
        { kind: 'libro', label: 'Multipliers (Liz Wiseman)', format: 'papel' },
      ],
    },
  ],
};
