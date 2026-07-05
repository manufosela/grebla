/**
 * Isla «Product Manager» (doc /careerMap/product-manager) — MC-16, oleada 2.
 *
 * Sigue la convención de contenido de islas descrita en ./bases.js: ids de
 * ciudad prefijados por la disciplina ('product-manager/'), prereqs solo
 * intra-isla y sin ciclos, posiciones 0..100 separadas, pesos 1..3 y cada
 * ciudad con keyPoints, aiFocus y recursos reales. Basada en el roadmap de
 * product manager de roadmap.sh, adaptada a la era IA: prototipar con IA,
 * sintetizar feedback a escala y decidir con datos + criterio — porque
 * construir es cada vez más barato y elegir bien, cada vez más valioso.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const PRODUCT_MANAGER_ISLAND = {
  id: 'product-manager',
  name: 'Isla Product Manager',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'oficio', name: 'El oficio de producto' },
    { id: 'discovery', name: 'Discovery continuo' },
    { id: 'priorizacion', name: 'Priorización y roadmaps' },
    { id: 'metricas', name: 'Métricas de producto' },
    { id: 'entrega', name: 'Entrega con ingeniería' },
    { id: 'pm-ia', name: 'PM en la era IA' },
  ],
  cities: [
    // ── El oficio de producto (comarca de entrada, junto al puerto) ──────────
    {
      id: 'product-manager/rol-del-pm',
      name: 'El rol del PM',
      kind: 'skill',
      area: 'oficio',
      x: 50,
      y: 72,
      weight: 3,
      summary: 'El rol del PM es descubrir qué construir y por qué, para que el equipo haga lo correcto, no solo mucho. Consiste en representar al usuario y al negocio a la vez. Te capacita para que el esfuerzo de ingeniería se convierta en valor real y no en features que nadie usa.',
      prereqs: [],
      keyPoints: [
        'El PM responde por el valor: producto que merece existir, es usable, viable y construible.',
        'No eres el CEO del producto ni el jefe de nadie: lideras con contexto y evidencia, no con autoridad.',
        'Vives en la intersección: negocio, usuarios y tecnología — necesitas conversación fluida con los tres.',
        'Diferencia output de outcome: entregar features no es el objetivo, cambiar comportamientos sí.',
        'Tu herramienta principal es decidir qué NO se hace y poder explicar por qué.',
      ],
      aiFocus:
        'Cuando la IA abarata construir, el trabajo del PM se revaloriza: la pregunta ya no es «¿podemos?» sino «¿deberíamos, para quién y por qué ahora?». Profundiza en juicio de producto — es la parte del rol que no se genera con un prompt.',
      resources: [
        { kind: 'libro', label: 'Inspired (Marty Cagan)', format: 'papel' },
        { kind: 'doc', label: 'roadmap.sh — Product Manager', url: 'https://roadmap.sh/product-manager' },
        { kind: 'post', label: 'SVPG — blog de Silicon Valley Product Group', url: 'https://www.svpg.com' },
      ],
    },
    {
      id: 'product-manager/pensamiento-de-producto',
      name: 'Pensamiento de producto',
      kind: 'skill',
      area: 'oficio',
      x: 36,
      y: 64,
      weight: 3,
      summary: 'El pensamiento de producto es enfocarse en el problema del usuario antes que en la solución. Consiste en preguntar por qué y para quién antes de decidir el qué. Te capacita para construir cosas que la gente quiere en vez de las que a ti se te ocurrieron.',
      prereqs: ['product-manager/rol-del-pm'],
      keyPoints: [
        'Enamórate del problema, no de tu solución: la solución es una hipótesis, el problema es el ancla.',
        'Formula el job-to-be-done: qué progreso busca el usuario cuando «contrata» tu producto.',
        'Piensa en apuestas, no en certezas: cada feature es una inversión con riesgo y retorno esperado.',
        'Busca el value exchange: qué gana el usuario y qué gana el negocio — si falta un lado, no hay producto.',
        'Estudia productos que amas y odias: entrena el ojo desmontando decisiones ajenas.',
      ],
      aiFocus:
        'La IA te da respuestas instantáneas sobre mercados y competidores, pero la síntesis en una tesis de producto — este problema, este usuario, esta apuesta — es tuya. Profundiza en formular problemas con precisión: es también lo que convierte a la IA en buena colaboradora.',
      resources: [
        { kind: 'libro', label: 'Escaping the Build Trap (Melissa Perri)', format: 'papel' },
        { kind: 'libro', label: 'The Design of Everyday Things (Don Norman)', format: 'papel' },
      ],
    },
    {
      id: 'product-manager/conocer-el-negocio',
      name: 'Conocer el negocio',
      kind: 'skill',
      area: 'oficio',
      x: 64,
      y: 64,
      weight: 2,
      summary: 'Conocer el negocio es entender cómo gana dinero tu empresa y qué mueve la aguja de verdad. Consiste en conectar cada decisión de producto con su impacto económico. Te capacita para priorizar lo que importa al negocio y hablar el idioma de quien decide.',
      prereqs: ['product-manager/rol-del-pm'],
      keyPoints: [
        'Entiende el modelo de negocio: cómo entra el dinero, qué lo hace crecer y qué lo pone en riesgo.',
        'Conoce la unit economics de tu producto: CAC, LTV, márgenes y dónde aprieta el zapato.',
        'Mapea el mercado: competidores, alternativas (incluido «no hacer nada») y tu diferencia defendible.',
        'Habla el idioma de ventas, soporte y marketing: son tus sensores en el terreno.',
        'Alinea cada iniciativa con la estrategia de la empresa — y si no hay estrategia clara, pregunta hasta que duela.',
      ],
      aiFocus:
        'La IA resume informes de mercado, transcripciones de ventas y llamadas de soporte en minutos: úsala para tener contexto de negocio siempre fresco. Profundiza en pensar estratégicamente con ese material — detectar la oportunidad que el resumen no subraya sigue siendo tu partido.',
      resources: [
        { kind: 'libro', label: 'Good Strategy Bad Strategy (Richard Rumelt)', format: 'papel' },
        { kind: 'post', label: 'Stratechery (Ben Thompson)', url: 'https://stratechery.com' },
      ],
    },

    // ── Discovery continuo (oeste) ───────────────────────────────────────────
    {
      id: 'product-manager/entrevistas-usuarios',
      name: 'Entrevistas con usuarios',
      kind: 'skill',
      area: 'discovery',
      x: 24,
      y: 54,
      weight: 3,
      summary: 'Las entrevistas con usuarios son hablar con la gente real para entender sus problemas sin sesgar la respuesta. Consiste en preguntar por comportamientos y no por opiniones. Te capacita para decidir con lo que la gente hace, no con lo que dice que haría.',
      prereqs: ['product-manager/pensamiento-de-producto'],
      keyPoints: [
        'Pregunta por comportamiento pasado, no por intenciones futuras: «¿qué hiciste?» vale, «¿lo usarías?» no.',
        'The Mom Test: haz preguntas que ni tu madre pueda responder con halagos.',
        'Cadencia semanal: una entrevista a la semana vale más que un estudio grande al trimestre.',
        'Escucha el problema detrás de la petición: cuando piden una feature, pregunta qué intentaban lograr.',
        'Graba (con permiso) y comparte los hallazgos crudos con el equipo: el contacto directo no se delega entero.',
      ],
      aiFocus:
        'La IA transcribe, resume y etiqueta entrevistas al momento, liberándote para escuchar de verdad en vez de tomar notas. Profundiza en el arte de preguntar y en detectar lo no dicho — el gesto de frustración y el silencio incómodo no salen en la transcripción.',
      resources: [
        { kind: 'libro', label: 'The Mom Test (Rob Fitzpatrick)', format: 'papel' },
        { kind: 'libro', label: 'Continuous Discovery Habits (Teresa Torres)', format: 'papel' },
      ],
    },
    {
      id: 'product-manager/hipotesis-experimentos',
      name: 'Hipótesis y experimentos',
      kind: 'skill',
      area: 'discovery',
      x: 36,
      y: 44,
      weight: 3,
      summary: 'Las hipótesis y los experimentos son tratar tus ideas como apuestas a validar, no verdades. Consiste en formular qué esperas, probarlo barato y aprender del resultado. Te capacita para reducir el riesgo de construir algo grande que nadie quería.',
      prereqs: ['product-manager/entrevistas-usuarios'],
      keyPoints: [
        'Escribe la hipótesis antes de construir: «creemos que X provocará Y, lo sabremos si Z».',
        'Testea los cuatro riesgos: valor, usabilidad, viabilidad y factibilidad — el orden depende del mayor.',
        'Elige el experimento más barato que reduzca el riesgo: landing falsa, prototipo, Wizard of Oz.',
        'Define el criterio de éxito ANTES de mirar los datos: si no, siempre «ganarás».',
        'Mata ideas con orgullo: un experimento que invalida una apuesta cara es una victoria.',
      ],
      aiFocus:
        'Con IA montas el experimento en horas — landing, prototipo, copy en tres variantes — así que el cuello de botella pasa a ser la calidad de la hipótesis. Profundiza en diseñar experimentos que de verdad discriminan: rapidez para construir no arregla una pregunta mal planteada.',
      resources: [
        { kind: 'libro', label: 'Continuous Discovery Habits (Teresa Torres)', format: 'papel' },
        { kind: 'libro', label: 'Testing Business Ideas (Bland y Osterwalder)', format: 'papel' },
      ],
    },
    {
      id: 'product-manager/continuous-discovery',
      name: 'Discovery continuo',
      kind: 'skill',
      area: 'discovery',
      x: 14,
      y: 42,
      weight: 2,
      summary: 'El discovery continuo es hablar con usuarios de forma habitual, no solo al principio de un proyecto. Consiste en mantener un contacto constante con el problema mientras construyes. Te capacita para corregir el rumbo pronto en vez de descubrir el error al lanzar.',
      prereqs: ['product-manager/entrevistas-usuarios'],
      keyPoints: [
        'Discovery no es una fase, es un hábito semanal del trío producto-diseño-ingeniería.',
        'Usa opportunity solution trees: del outcome deseado a oportunidades, y de ahí a soluciones.',
        'Involucra a ingeniería en el discovery: quien construye descubre soluciones que tú no ves.',
        'Mantén un flujo constante de contacto con clientes; la agenda se defiende como cualquier otra reunión.',
        'Conecta cada solución en el backlog con la oportunidad y el outcome del que nació.',
      ],
      aiFocus:
        'La IA mantiene vivo el mapa de oportunidades: agrega señales de entrevistas, tickets y reviews de forma continua en vez de en estudios puntuales. Profundiza en la disciplina del hábito — la herramienta sintetiza, pero salir a hablar con usuarios cada semana es una decisión tuya y del trío.',
      resources: [
        { kind: 'libro', label: 'Continuous Discovery Habits (Teresa Torres)', format: 'papel' },
        { kind: 'post', label: 'Product Talk (Teresa Torres)', url: 'https://www.producttalk.org' },
      ],
    },
    {
      id: 'product-manager/prototipado',
      name: 'Prototipado',
      kind: 'skill',
      area: 'discovery',
      x: 26,
      y: 32,
      weight: 2,
      summary: 'El prototipado es materializar una idea en algo que se pueda ver y tocar antes de construirla. Consiste en hacer versiones rápidas para validar con usuarios y equipo. Te capacita para alinear a todos y detectar problemas cuando cambiarlos aún es barato.',
      prereqs: ['product-manager/hipotesis-experimentos'],
      keyPoints: [
        'Prototipa al nivel de fidelidad que pide la pregunta: papel para flujo, clicable para usabilidad.',
        'El prototipo es para aprender, no para presumir: enséñalo feo y pronto.',
        'Testea con 5 usuarios: encuentra el 80% de los problemas gordos de usabilidad.',
        'Define qué quieres observar antes de la sesión: tareas concretas, no paseos guiados.',
        'Tira el prototipo sin pena: su valor era la respuesta, no el artefacto.',
      ],
      aiFocus:
        'Las herramientas de IA convierten una idea en prototipo funcional en una tarde, sin esperar a diseño ni a ingeniería: úsalo para multiplicar lo que testeas. Profundiza en qué preguntas hacerle a cada prototipo — la fidelidad ya no es el límite, tu claridad sobre qué aprender sí.',
      resources: [
        { kind: 'libro', label: 'Sprint (Jake Knapp)', format: 'papel' },
        { kind: 'doc', label: 'Nielsen Norman Group — investigación UX', url: 'https://www.nngroup.com' },
      ],
    },

    // ── Priorización y roadmaps (centro-este) ────────────────────────────────
    {
      id: 'product-manager/priorizar-impacto-esfuerzo',
      name: 'Priorizar: impacto vs esfuerzo',
      kind: 'skill',
      area: 'priorizacion',
      x: 52,
      y: 50,
      weight: 3,
      summary: 'Priorizar por impacto vs esfuerzo es decidir qué hacer antes cuando todo parece importante. Consiste en estimar el valor y el coste de cada cosa y elegir con criterio. Te capacita para que el equipo trabaje en lo que más mueve la aguja, no en lo más ruidoso.',
      prereqs: ['product-manager/hipotesis-experimentos'],
      keyPoints: [
        'Estima impacto y esfuerzo en órdenes de magnitud: precisión falsa es peor que rangos honestos.',
        'Usa marcos (RICE, ICE, coste de retraso) como conversación estructurada, no como oráculo.',
        'El coste de oportunidad es la métrica escondida: cada sí es un no a otra cosa.',
        'Puntúa en grupo con criterios explícitos: la priorización a puerta cerrada genera lobby, no alineamiento.',
        'Repriorizar con nueva evidencia es virtud; hacerlo por la opinión más reciente del jefe (HiPPO), no.',
      ],
      aiFocus:
        'La IA rellena la tabla RICE con datos de analítica y estimaciones preliminares en minutos: el marco se vuelve barato. Profundiza en desafiar los números — el valor del PM está en detectar la suposición inflada dentro de una puntuación que parece objetiva.',
      resources: [
        { kind: 'libro', label: 'Escaping the Build Trap (Melissa Perri)', format: 'papel' },
        { kind: 'post', label: 'Lenny’s Newsletter — producto y crecimiento', url: 'https://www.lennysnewsletter.com' },
      ],
    },
    {
      id: 'product-manager/decir-que-no',
      name: 'Decir que no',
      kind: 'skill',
      area: 'priorizacion',
      x: 64,
      y: 42,
      weight: 2,
      summary: 'Decir que no es proteger el foco del producto rechazando lo que no encaja, aunque duela. Consiste en explicar el porqué y ofrecer alternativas sin cerrar puertas. Te capacita para que el producto tenga una dirección clara en vez de ser un cajón de sastre.',
      prereqs: ['product-manager/priorizar-impacto-esfuerzo'],
      keyPoints: [
        'Di no al qué, no al porqué: reconoce el problema aunque rechaces la solución propuesta.',
        'Explica el coste del sí: qué saldría del roadmap para que esto entre.',
        'Ten criterios públicos de priorización: el no impersonal duele menos y escala más.',
        'Cuidado con el sí lento (lo apunto para Q3): es un no cobarde que genera deuda de confianza.',
        'Guarda las peticiones rechazadas con su razón: son datos de discovery, no basura.',
      ],
      aiFocus:
        'Cuando todo el mundo sabe que «con IA se hace en dos días», las peticiones se multiplican y decir no se vuelve el músculo central del PM. Profundiza en argumentar con coste de oportunidad y estrategia — la facilidad de construir nunca convierte una mala idea en buena.',
      resources: [
        { kind: 'libro', label: 'Good Strategy Bad Strategy (Richard Rumelt)', format: 'papel' },
        { kind: 'post', label: 'SVPG — blog de Silicon Valley Product Group', url: 'https://www.svpg.com' },
      ],
    },
    {
      id: 'product-manager/roadmaps',
      name: 'Roadmaps que no mienten',
      kind: 'skill',
      area: 'priorizacion',
      x: 78,
      y: 50,
      weight: 2,
      summary: 'Los roadmaps que no mienten son planes que comunican dirección sin prometer fechas que no puedes cumplir. Consiste en hablar de problemas y resultados, no de una lista de features con calendario. Te capacita para alinear a todos sin quedar como un mentiroso.',
      prereqs: ['product-manager/priorizar-impacto-esfuerzo'],
      keyPoints: [
        'Roadmap por outcomes y horizontes (now/next/later), no lista de features con fechas inventadas.',
        'Comunica el nivel de certeza: lo de «now» está comprometido, lo de «later» es dirección.',
        'El roadmap es una herramienta de comunicación estratégica, no un contrato de entregas.',
        'Versiónalo por audiencia: dirección, equipo y clientes necesitan zoom distinto del mismo mapa.',
        'Revisa y poda con cadencia fija: un roadmap desactualizado destruye credibilidad.',
      ],
      aiFocus:
        'La IA genera las variantes del roadmap por audiencia y detecta inconsistencias entre lo prometido y el estado real del backlog. Profundiza en la narrativa: un roadmap es una historia sobre por qué este orden y no otro — y esa historia la defines y la defiendes tú.',
      resources: [
        { kind: 'libro', label: 'Product Roadmaps Relaunched (Lombardo et al.)', format: 'papel' },
        { kind: 'post', label: 'Lenny’s Newsletter — producto y crecimiento', url: 'https://www.lennysnewsletter.com' },
      ],
    },

    // ── Métricas de producto (este-norte) ────────────────────────────────────
    {
      id: 'product-manager/metricas-activacion-retencion',
      name: 'Activación y retención',
      kind: 'skill',
      area: 'metricas',
      x: 76,
      y: 32,
      weight: 3,
      summary: 'La activación y la retención son las métricas que dicen si la gente empieza a usar tu producto y se queda. Consiste en medir el momento «ajá» y la vuelta recurrente. Te capacita para saber si tu producto aporta valor de verdad o solo atrae y pierde usuarios.',
      prereqs: ['product-manager/hipotesis-experimentos'],
      keyPoints: [
        'Define el momento de activación: la primera vez que el usuario recibe el valor prometido.',
        'La retención es la métrica reina: sin curva de retención que se aplana, no hay producto.',
        'Analiza por cohortes: los promedios agregados esconden lo que las cohortes revelan.',
        'Mapea el funnel AARRR (adquisición, activación, retención, ingresos, referencia) y encuentra tu cuello.',
        'Distingue métricas de vanidad (descargas, registros) de métricas de valor (uso repetido, outcome logrado).',
      ],
      aiFocus:
        'La IA explora tus datos de producto conversando: «¿qué cohorte retiene peor y qué hicieron distinto?» deja de requerir un analista para cada pregunta. Profundiza en definir QUÉ medir — el momento de activación correcto es una decisión de producto, no un query.',
      resources: [
        { kind: 'libro', label: 'Lean Analytics (Croll y Yoskovitz)', format: 'papel' },
        { kind: 'doc', label: 'Amplitude — guías de analítica de producto', url: 'https://amplitude.com' },
      ],
    },
    {
      id: 'product-manager/ab-testing',
      name: 'Experimentación y A/B',
      kind: 'skill',
      area: 'metricas',
      x: 88,
      y: 40,
      weight: 2,
      summary: 'La experimentación y los A/B tests son comparar variantes con datos reales para decidir cuál funciona mejor. Consiste en medir de forma rigurosa y sacar conclusiones válidas. Te capacita para mejorar el producto con evidencia en vez de con opiniones o corazonadas.',
      prereqs: ['product-manager/metricas-activacion-retencion'],
      keyPoints: [
        'Un A/B test necesita hipótesis, métrica primaria y tamaño de muestra decididos ANTES de lanzar.',
        'Entiende significancia y potencia estadística lo justo para no declarar victorias falsas.',
        'Vigila las métricas guardarraíl: ganar conversión rompiendo retención es perder.',
        'No todo se A/B-testea: con poco tráfico o cambios estructurales, usa otros métodos de evidencia.',
        'Los tests no sustituyen la visión: optimizan el mínimo local; el salto de curva lo decides tú.',
      ],
      aiFocus:
        'La IA diseña variantes, calcula muestras y hasta detecta efectos raros en los resultados — el coste operativo del experimento se desploma. Profundiza en la interpretación honesta: p-hacking asistido por IA sigue siendo p-hacking, solo que más rápido.',
      resources: [
        { kind: 'libro', label: 'Trustworthy Online Controlled Experiments (Kohavi et al.)', format: 'papel' },
        { kind: 'post', label: 'Statsig — blog de experimentación', url: 'https://statsig.com/blog' },
      ],
    },
    {
      id: 'product-manager/north-star',
      name: 'North Star y árbol de métricas',
      kind: 'skill',
      area: 'metricas',
      x: 88,
      y: 22,
      weight: 2,
      summary: 'El North Star y el árbol de métricas son elegir la métrica que resume el valor que entregas y descomponerla en palancas. Consiste en alinear a todo el equipo tras un norte común. Te capacita para que las decisiones diarias remen todas hacia el mismo sitio.',
      prereqs: ['product-manager/metricas-activacion-retencion'],
      keyPoints: [
        'Elige una North Star que capture valor entregado al usuario y correlacione con el negocio.',
        'Construye el árbol: qué inputs mueven la North Star y qué equipo es dueño de cada input.',
        'Ley de Goodhart también en producto: toda métrica objetivo será gamificada; ponle contrapesos.',
        'Revisa la North Star cuando cambia la estrategia: la métrica correcta de ayer puede desviarte hoy.',
        'Usa OKRs para conectar métricas con trabajo trimestral sin convertirlos en lista de tareas.',
      ],
      aiFocus:
        'La IA simula escenarios sobre tu árbol de métricas: «si activación sube 5%, ¿qué pasa con ingresos?» se responde en minutos. Profundiza en elegir la métrica que representa valor REAL — un árbol perfecto sobre una North Star equivocada solo te lleva más rápido al sitio equivocado.',
      resources: [
        { kind: 'doc', label: 'Amplitude — North Star framework', url: 'https://amplitude.com' },
        { kind: 'libro', label: 'Measure What Matters (John Doerr)', format: 'papel' },
      ],
    },

    // ── Entrega con ingeniería (centro-norte) ────────────────────────────────
    {
      id: 'product-manager/stakeholders',
      name: 'Gestión de stakeholders',
      kind: 'skill',
      area: 'entrega',
      x: 66,
      y: 26,
      weight: 3,
      summary: 'La gestión de stakeholders es alinear a jefes, ventas, soporte y demás intereses alrededor del producto. Consiste en comunicar, negociar y gestionar expectativas en muchas direcciones. Te capacita para avanzar con la organización a favor en vez de peleándote con ella.',
      prereqs: ['product-manager/roadmaps'],
      keyPoints: [
        'Mapea a tus stakeholders por interés e influencia, y decide la cadencia de comunicación de cada uno.',
        'Sin sorpresas: las malas noticias viajan primero y con plan; la confianza se gana en las crisis.',
        'Escucha la petición del stakeholder como señal de su problema, igual que con los usuarios.',
        'Comparte contexto y evidencia continuamente: los stakeholders alineados discuten menos decisiones.',
        'Aprende a escalar bien: cuándo resolver tú, cuándo subir la decisión y cómo presentarla.',
      ],
      aiFocus:
        'La IA redacta los updates por audiencia y resume el sentimiento de cada área antes de la reunión difícil. Profundiza en la política sana: leer intereses, construir alianzas y negociar es trabajo de personas con personas — y decide más roadmaps que cualquier framework.',
      resources: [
        { kind: 'libro', label: 'Influence (Robert Cialdini)', format: 'papel' },
        { kind: 'post', label: 'SVPG — blog de Silicon Valley Product Group', url: 'https://www.svpg.com' },
      ],
    },
    {
      id: 'product-manager/trabajar-con-ingenieria',
      name: 'Trabajar con ingeniería',
      kind: 'skill',
      area: 'entrega',
      x: 52,
      y: 32,
      weight: 3,
      summary: 'Trabajar con ingeniería es colaborar con quien construye para tomar mejores decisiones juntos. Consiste en dar contexto y el porqué, no especificaciones cerradas, y escuchar. Te capacita para que ingeniería aporte soluciones y no solo ejecute, y para llegar más lejos.',
      prereqs: ['product-manager/priorizar-impacto-esfuerzo'],
      keyPoints: [
        'Lleva problemas y contexto, no especificaciones cerradas: ingeniería descubre soluciones mejores que tu spec.',
        'Aprende lo técnico básico: cómo fluye un despliegue, qué es deuda técnica, por qué «pequeño» puede ser grande.',
        'Respeta la capacidad: colarse en el sprint por la puerta de atrás rompe la confianza y la velocidad.',
        'Defiende el tiempo de plataforma y deuda: producto sano corre sobre ingeniería sana.',
        'Historias con criterios de aceptación claros y comprobables: la ambigüedad se paga doble en QA.',
      ],
      aiFocus:
        'Con equipos que usan IA, el ciclo se acelera: tus criterios de aceptación alimentan directamente tests y primeras implementaciones, y la claridad de tu redacción se convierte en velocidad real. Profundiza en escribir historias precisas — el PM ambiguo es ahora el cuello de botella del equipo.',
      resources: [
        { kind: 'libro', label: 'Inspired (Marty Cagan)', format: 'papel' },
        { kind: 'libro', label: 'The Phoenix Project (Kim, Behr y Spafford)', format: 'papel' },
      ],
    },
    {
      id: 'product-manager/lanzamientos',
      name: 'Lanzamientos y ciclo de vida',
      kind: 'skill',
      area: 'entrega',
      x: 54,
      y: 18,
      weight: 2,
      summary: 'Los lanzamientos y el ciclo de vida son sacar algo al mundo bien y acompañarlo después. Consiste en coordinar el go-to-market, medir la adopción y iterar. Te capacita para que un lanzamiento genere valor de verdad y no sea un fuego artificial que se apaga.',
      prereqs: ['product-manager/trabajar-con-ingenieria'],
      keyPoints: [
        'Separa release de launch: desplegar en oscuro y lanzar cuando el negocio esté listo.',
        'Prepara el go-to-market con marketing, ventas y soporte: el producto no se vende solo.',
        'Lanza por fases (beta, porcentaje, general) con criterios de avance y de rollback.',
        'Mide contra la hipótesis del lanzamiento, no contra el aplauso interno.',
        'Cierra el ciclo: itera, escala o mata la feature — el post-launch abandonado es el cementerio del valor.',
      ],
      aiFocus:
        'La IA genera los materiales del lanzamiento (notas, FAQs, formación de soporte) desde la spec, y monitoriza el feedback de los primeros usuarios en tiempo real. Profundiza en la decisión post-lanzamiento — iterar, escalar o matar exige leer señales mezcladas con honestidad.',
      resources: [
        { kind: 'post', label: 'Lenny’s Newsletter — producto y crecimiento', url: 'https://www.lennysnewsletter.com' },
        { kind: 'post', label: 'First Round Review — producto y go-to-market', url: 'https://review.firstround.com' },
      ],
    },

    // ── PM en la era IA (noroeste) ───────────────────────────────────────────
    {
      id: 'product-manager/prototipar-con-ia',
      name: 'Prototipar con IA',
      kind: 'skill',
      area: 'pm-ia',
      x: 38,
      y: 22,
      weight: 3,
      summary: 'Prototipar con IA es usar el modelo para pasar de idea a algo tangible en horas, sin depender de ingeniería. Consiste en generar prototipos rápidos para validar antes de comprometer recursos. Te capacita para explorar muchas más opciones y decidir con evidencia temprana.',
      prereqs: ['product-manager/prototipado'],
      keyPoints: [
        'Aprende una herramienta de prototipado con IA y úsala: el PM que enseña un prototipo gana la discusión del documento.',
        'Del insight al prototipo testeable en un día: valida dirección antes de gastar sprint de ingeniería.',
        'Prototipa TÚ las ideas arriesgadas: pedirlo al equipo tiene coste; pedírselo a la IA, casi ninguno.',
        'El prototipo IA es desechable por diseño: ni una línea va a producción sin pasar por ingeniería.',
        'Enseña prototipos a usuarios reales, no solo a stakeholders: la validación interna es un espejismo.',
      ],
      aiFocus:
        'Prototipar deja de necesitar permiso: un PM con herramientas de IA convierte una hipótesis en algo clicable esa misma tarde. Profundiza en usar este superpoder con disciplina — más prototipos solo valen si cada uno responde una pregunta de discovery concreta.',
      resources: [
        { kind: 'post', label: 'Lenny’s Newsletter — IA para PMs', url: 'https://www.lennysnewsletter.com' },
        { kind: 'doc', label: 'v0 by Vercel — prototipado con IA', url: 'https://v0.dev' },
      ],
    },
    {
      id: 'product-manager/sintetizar-feedback-ia',
      name: 'Sintetizar feedback con IA',
      kind: 'skill',
      area: 'pm-ia',
      x: 24,
      y: 14,
      weight: 2,
      summary: 'Sintetizar feedback con IA es usar el modelo para digerir montañas de opiniones de usuarios y sacar patrones. Consiste en apoyarte en la IA para resumir sin perder los matices. Te capacita para escuchar a muchos más usuarios de los que podrías leer a mano.',
      prereqs: ['product-manager/prototipar-con-ia'],
      keyPoints: [
        'Agrega TODAS las fuentes: entrevistas, tickets, reviews, NPS, llamadas de ventas — la IA las cruza por ti.',
        'Pide temas con evidencia: cada patrón detectado debe citar los verbatims que lo sostienen.',
        'Contrasta la síntesis contra la fuente: las alucinaciones también inventan «lo que dicen los usuarios».',
        'Cuantifica lo cualitativo con cuidado: 40 menciones de un tema no implican que sea lo más valioso.',
        'Mantén contacto directo con usuarios aunque la IA resuma: la empatía no se subcontrata.',
      ],
      aiFocus:
        'Lo que antes era un mes de análisis de feedback ahora es una tarde: la IA encuentra patrones en miles de señales que ningún PM podía leer entero. Profundiza en hacer las preguntas correctas al corpus y en verificar los hallazgos — la síntesis es barata, el criterio sobre qué hacer con ella no.',
      resources: [
        { kind: 'libro', label: 'Continuous Discovery Habits (Teresa Torres)', format: 'papel' },
        { kind: 'post', label: 'Product Talk (Teresa Torres)', url: 'https://www.producttalk.org' },
      ],
    },
    {
      id: 'product-manager/decidir-con-datos-ia',
      name: 'Decidir con datos + criterio',
      kind: 'skill',
      area: 'pm-ia',
      x: 10,
      y: 24,
      weight: 2,
      summary: 'Decidir con datos y criterio es usar la IA y los números como apoyo sin delegarles el juicio. Consiste en combinar lo que dicen los datos con el contexto que solo tú tienes. Te capacita para decidir mejor y más rápido sin volverte esclavo de una métrica o de un modelo.',
      prereqs: ['product-manager/continuous-discovery'],
      keyPoints: [
        'Datos para decidir, no para justificar lo ya decidido: escribe la pregunta antes de mirar el dashboard.',
        'Combina señales: cuantitativo dice qué pasa, cualitativo dice por qué — decidir necesita ambos.',
        'Explicita tus supuestos y su nivel de confianza: las decisiones son apuestas documentables.',
        'Cuando los datos no alcanzan (mercados nuevos, saltos de visión), reconócelo y decide con principios.',
        'Registra decisiones y revisa aciertos a posteriori: calibrar tu juicio es entrenable.',
      ],
      aiFocus:
        'La IA te da análisis instantáneo y argumentos convincentes para CUALQUIER postura — el riesgo nuevo es la decisión racionalizada en vez de razonada. Profundiza en tu proceso de decisión: hipótesis previa, evidencia a favor y en contra, y la humildad de dejar que los datos te cambien de opinión.',
      resources: [
        { kind: 'libro', label: 'Thinking in Bets (Annie Duke)', format: 'papel' },
        { kind: 'libro', label: 'Lean Analytics (Croll y Yoskovitz)', format: 'papel' },
      ],
    },
    {
      id: 'product-manager/pm-era-ia',
      name: 'PM de la era IA',
      kind: 'milestone',
      area: 'pm-ia',
      x: 40,
      y: 8,
      weight: 3,
      summary: 'Ser PM de la era IA es el hito de dirigir producto cuando la IA cambia qué se puede construir y cómo. Consiste en juntar todo lo de la isla y sumarle criterio sobre las posibilidades de la IA. Te capacita para ser el PM que descubre y entrega valor en el nuevo tablero.',
      prereqs: ['product-manager/sintetizar-feedback-ia', 'product-manager/lanzamientos'],
      keyPoints: [
        'Descubres cada semana, prototipas en horas y decides con datos verificados y criterio propio.',
        'Tu roadmap cuenta una estrategia por outcomes que dirección, equipo y clientes entienden.',
        'Usas IA en todo el ciclo (research, prototipo, síntesis, comunicación) sin delegarle el juicio.',
        'Dices no con contexto y mantienes la confianza de stakeholders e ingeniería a la vez.',
        'Tu producto retiene usuarios porque resuelve un problema real — y puedes demostrarlo con métricas.',
      ],
      aiFocus:
        'El milestone del PM: cuando construir es barato, el PM que elige bien QUÉ construir se convierte en el multiplicador de todo el equipo. Profundiza siempre en el criterio — la IA acelera cada paso del ciclo de producto, pero la responsabilidad de la apuesta sigue firmándose con tu nombre.',
      resources: [
        { kind: 'libro', label: 'Inspired (Marty Cagan)', format: 'papel' },
        { kind: 'libro', label: 'Empowered (Cagan y Jones)', format: 'papel' },
      ],
    },
  ],
};
