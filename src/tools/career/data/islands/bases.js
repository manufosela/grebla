/**
 * Isla «Bases de software» (doc /careerMap/island) — contenido curado MC-16.
 *
 * ── CONVENCIÓN DE CONTENIDO DE ISLAS (léela antes de escribir la oleada 2) ──
 * Un módulo por isla en src/tools/career/data/islands/{disciplina}.js que
 * exporta el CareerMap COMPLETO de la isla y se registra en ./index.js
 * (ISLAND_CONTENT). Reglas:
 *
 *  1. `id` del mapa = id del doc en /careerMap/{islandId} (el que figura en el
 *     índice del archipiélago, src/tools/career/data/archipelago.js). Ojo: la
 *     isla de inicio tiene id 'island' pero disciplina 'bases'.
 *  2. Ids de ciudad ÚNICOS GLOBALES, prefijados por la DISCIPLINA de la isla:
 *     'bases/git', 'frontend/react'… El journey es global a todo el
 *     archipiélago, así que dos islas no pueden compartir id de ciudad.
 *  3. `prereqs` SOLO dentro de la propia isla (nunca cruzan el mar) y sin
 *     ciclos. Las comarcas de entrada aportan las ciudades raíz (sin prereqs)
 *     y abren el resto de la isla.
 *  4. Posiciones x/y en 0..100, repartidas por comarcas, separadas ≥ 8 entre
 *     sí y ≥ 10 del puerto. El puerto (`startPort`) va al sur: ~(50, 88).
 *  5. Pesos 1..3: 3 = fundamental, 2 = importante, 1 = complementaria.
 *     Los milestones cierran rutas y pesan 3.
 *  6. Contenido en ESPAÑOL, tono cercano pero profesional. Cada ciudad lleva:
 *     - keyPoints: 4-6 puntos concretos y accionables (qué aprender/hacer).
 *     - aiFocus: 2-3 frases ESPECÍFICAS con la lente era-IA — qué hace la IA
 *       por ti en esta ciudad y dónde debes profundizar TÚ. Nada genérico.
 *     - resources: 2-4 recursos REALES (kind: curso|post|libro|doc). Urls
 *       https estables (home o doc raíz, no rutas profundas frágiles);
 *       los libros en papel van sin url y con format 'papel' (u 'online'
 *       si el libro se lee en la web).
 *  7. Todo pasa por normalizeCareerMap/serializeCareerMap sin pérdidas: no
 *     metas campos fuera del modelo City (ver ../../domain/types.js). El test
 *     de la carpeta (islands.test.js) valida 1-6 automáticamente para toda
 *     isla registrada en ISLAND_CONTENT.
 *
 * La isla de inicio está pensada para un dev que trabaja CON IA: roadmap.sh
 * como referencia, pero adaptado — la IA ya hace lo mecánico, así que el mapa
 * pone el peso en criterio, verificación, fundamentos y trabajo en equipo.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const BASES_ISLAND = {
  id: 'island',
  name: 'Bases de software',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'oficio-ia', name: 'El oficio con IA' },
    { id: 'fundamentos', name: 'Fundamentos que la IA no te quita' },
    { id: 'herramientas', name: 'Herramientas del día a día' },
    { id: 'construir', name: 'Construir software' },
    { id: 'equipo', name: 'Trabajar en equipo' },
  ],
  cities: [
    // ── El oficio con IA (comarca de entrada, junto al puerto) ──────────────
    {
      id: 'bases/pensar-con-ia',
      name: 'Pensar con la IA',
      kind: 'skill',
      area: 'oficio-ia',
      x: 50,
      y: 74,
      weight: 3,
      summary: 'Pensar con la IA es usar el modelo como un colaborador al que diriges, no como un oráculo al que obedeces. Consiste en plantear el problema, decidir qué delegar y mantener tú el criterio. Te capacita para ir más rápido sin perder el control de lo que construyes.',
      prereqs: [],
      keyPoints: [
        'Escribe prompts con contexto: objetivo, restricciones, ejemplos y formato de salida esperado.',
        'Divide problemas grandes en peticiones pequeñas y verificables: una cosa por prompt.',
        'Aporta el contexto que el modelo no tiene: código relevante, convenciones del proyecto, el error completo.',
        'Trata la primera respuesta como borrador, no como resultado final: itera.',
        'Detecta cuándo la conversación está perdida y conviene reiniciarla con mejor contexto.',
      ],
      aiFocus:
        'La IA redacta, explica y genera código a partir de tu intención, pero la calidad de la salida depende de la calidad de tu contexto. Profundiza tú en formular problemas: quien mejor describe el problema es quien mejor lo delega.',
      resources: [
        { kind: 'doc', label: 'Prompt Engineering Guide', url: 'https://www.promptingguide.ai' },
        { kind: 'doc', label: 'roadmap.sh — Prompt Engineering', url: 'https://roadmap.sh/prompt-engineering' },
      ],
    },
    {
      id: 'bases/revisar-codigo-ia',
      name: 'Revisar código generado',
      kind: 'skill',
      area: 'oficio-ia',
      x: 38,
      y: 66,
      weight: 3,
      summary: 'Revisar el código que genera la IA es leerlo entero antes de integrarlo, porque tú firmas lo que entra. Consiste en buscar los fallos típicos del modelo: casos borde, APIs inventadas, dependencias de más. Te capacita para aprovechar su velocidad sin heredar sus errores.',
      prereqs: ['bases/pensar-con-ia', 'bases/leer-codigo'],
      keyPoints: [
        'Lee TODO el código generado antes de integrarlo: eres responsable de lo que firmas.',
        'Busca los fallos típicos de la IA: casos borde ignorados, APIs inventadas, dependencias innecesarias.',
        'Comprueba que sigue las convenciones de TU proyecto, no las «genéricas» del modelo.',
        'Ejecuta y prueba antes de dar por bueno: que compile no significa que funcione.',
        'Si no entiendes una línea, no la aceptes: pide explicación o exige una versión más simple.',
      ],
      aiFocus:
        'La IA produce código plausible a gran velocidad; tu valor está en distinguir plausible de correcto. Profundiza en lectura crítica de diffs: detectar el error sutil en un cambio que «parece bien» es la habilidad más cotizada de esta década.',
      resources: [
        { kind: 'post', label: 'Addy Osmani — calidad de código en la era IA', url: 'https://addyosmani.com' },
        { kind: 'doc', label: 'Google Engineering Practices — code review', url: 'https://google.github.io/eng-practices/review/' },
      ],
    },
    {
      id: 'bases/delegar-o-hacer',
      name: 'Delegar vs hacer',
      kind: 'skill',
      area: 'oficio-ia',
      x: 62,
      y: 66,
      weight: 2,
      summary: 'Delegar vs hacer es decidir cuándo pedirle algo a la IA y cuándo resolverlo tú. Consiste en calibrar el coste de explicar y verificar frente al de hacerlo a mano. Te capacita para no perder tiempo delegando lo trivial ni jugártela delegando lo crítico.',
      prereqs: ['bases/pensar-con-ia'],
      keyPoints: [
        'Delega lo mecánico: boilerplate, tests repetitivos, migraciones de sintaxis, borradores.',
        'Reserva para ti las decisiones con coste de cambio alto: arquitectura, modelo de datos, seguridad.',
        'Si la tarea te enseña algo que necesitarás dominar, hazla tú al menos la primera vez.',
        'Mide el coste real: si revisar la salida cuesta más que escribirla, no delegues.',
        'Usa la IA para ir más rápido donde ya sabes juzgar el resultado, no donde no puedes evaluarlo.',
      ],
      aiFocus:
        'La IA resuelve casi cualquier tarea acotada, pero no decide qué merece la pena hacer ni asume las consecuencias. Profundiza en juicio técnico: coste de cambio, reversibilidad y riesgo son tu brújula para decidir qué delegar.',
      resources: [
        { kind: 'libro', label: 'The Pragmatic Programmer (Hunt y Thomas)', format: 'papel' },
        { kind: 'post', label: 'Latent Space — el oficio del AI engineer', url: 'https://www.latent.space' },
        { kind: 'doc', label: 'roadmap.sh — AI Engineer', url: 'https://roadmap.sh/ai-engineer' },
      ],
    },
    {
      id: 'bases/verificar-salida-ia',
      name: 'Verificar la salida de la IA',
      kind: 'skill',
      area: 'oficio-ia',
      x: 50,
      y: 58,
      weight: 3,
      summary: 'Verificar la salida de la IA es comprobar que lo que produce es correcto, no solo que suena bien. Consiste en ejecutar, probar y contrastar contra la realidad antes de darlo por bueno. Te capacita para distinguir plausible de correcto, la habilidad clave de esta década.',
      prereqs: ['bases/pensar-con-ia'],
      keyPoints: [
        'Nunca asumas que la salida es correcta: contrasta con la fuente (doc oficial, ejecución real).',
        'Pide a la IA sus fuentes y compruébalas: las citas también se inventan.',
        'Escribe el test ANTES de pedir el código: tú defines el contrato, la IA rellena la implementación.',
        'Reproduce en local cualquier afirmación sobre comportamiento («esto es más rápido», «esto es seguro»).',
        'Desconfía especialmente de nombres de API, versiones y números concretos: es donde más se alucina.',
      ],
      aiFocus:
        'La IA no distingue entre lo que sabe y lo que suena bien: alucinar forma parte de su diseño. Tú aportas el circuito de verificación — tests, ejecución, contraste con la documentación. Profundiza en construir bucles de feedback baratos y rápidos.',
      resources: [
        { kind: 'post', label: 'Simon Willison — IA aplicada al desarrollo', url: 'https://simonwillison.net' },
        { kind: 'doc', label: 'MDN Web Docs — la fuente contra la que verificar', url: 'https://developer.mozilla.org/es/' },
      ],
    },
    {
      id: 'bases/limites-riesgos-ia',
      name: 'Límites y riesgos de la IA',
      kind: 'skill',
      area: 'oficio-ia',
      x: 70,
      y: 76,
      weight: 2,
      summary: 'Conocer los límites y riesgos de la IA es saber dónde falla: alucina, no razona de verdad, filtra datos sensibles y refleja sus sesgos. Consiste en anticipar esos fallos antes de que te muerdan. Te capacita para usarla con confianza informada, ni fe ciega ni miedo.',
      prereqs: ['bases/pensar-con-ia'],
      keyPoints: [
        'Alucinaciones: el modelo genera texto plausible, no verdad; cuanto más específica la pregunta, más riesgo.',
        'No pegues secretos, datos personales ni código propietario en herramientas no aprobadas por tu organización.',
        'Licencias: el código generado puede reproducir patrones de código con licencias incompatibles con tu proyecto.',
        'Sesgo de automatización: cuanto más acierta la IA, menos la revisas; combátelo con proceso (tests, review).',
        'Conoce el corte de conocimiento del modelo: para librerías recientes, contrasta con el changelog.',
      ],
      aiFocus:
        'La propia IA no te avisará de sus límites: responde con la misma seguridad cuando acierta que cuando inventa. Profundiza en sus modos de fallo (alucinación, inyección de prompts, fuga de datos) para diseñar un flujo de trabajo a prueba de ellos.',
      resources: [
        { kind: 'doc', label: 'OWASP Top 10 para aplicaciones LLM', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
        { kind: 'doc', label: 'Choose a License — licencias de software', url: 'https://choosealicense.com' },
      ],
    },

    // ── Fundamentos que la IA no te quita (oeste) ───────────────────────────
    {
      id: 'bases/logica-descomposicion',
      name: 'Lógica y descomposición',
      kind: 'skill',
      area: 'fundamentos',
      x: 28,
      y: 74,
      weight: 3,
      summary: 'La lógica y la descomposición son partir un problema grande en piezas pequeñas que sí sabes resolver. Consiste en pensar en pasos, condiciones y casos antes de escribir una línea. Te capacita para atacar cualquier problema sin bloquearte ante su tamaño.',
      prereqs: [],
      keyPoints: [
        'Reformula el problema con tus palabras antes de tocar código (o de escribir el prompt).',
        'Divide en subproblemas con entrada y salida claras; resuélvelos por separado y compón.',
        'Resuelve primero el caso simple y generaliza después; los casos borde se enumeran, no se improvisan.',
        'Practica con problemas pequeños SIN IA: es tu gimnasio mental.',
        'Aprende a expresar condiciones e invariantes con precisión: «siempre que», «solo si», «para todo».',
      ],
      aiFocus:
        'La IA resuelve el subproblema que le des, pero trocear el problema grande en piezas correctas sigue siendo cosa tuya — y es justo lo que hace útiles tus prompts. Profundiza en resolver problemas a mano: sin ese músculo no puedes juzgar las soluciones de nadie, humano o máquina.',
      resources: [
        { kind: 'libro', label: 'How to Solve It (George Pólya)', format: 'papel' },
        { kind: 'curso', label: 'Exercism — práctica deliberada por lenguaje', url: 'https://exercism.org' },
        { kind: 'libro', label: 'Think Like a Programmer (V. Anton Spraul)', format: 'papel' },
      ],
    },
    {
      id: 'bases/estructuras-datos',
      name: 'Estructuras de datos',
      kind: 'tech',
      area: 'fundamentos',
      x: 16,
      y: 64,
      weight: 3,
      summary: 'Las estructuras de datos son las formas de organizar la información: listas, mapas, conjuntos, árboles. Consiste en elegir la adecuada para lo que necesitas hacer con los datos. Te capacita para escribir código que va rápido y se lee claro en vez de enrevesado.',
      prereqs: ['bases/logica-descomposicion'],
      keyPoints: [
        'Domina el catálogo esencial: array, mapa/diccionario, conjunto, pila, cola, árbol.',
        'La pregunta clave es CUÁNDO usar cada una, no cómo implementarlas de memoria.',
        'Entiende el coste de las operaciones típicas: buscar, insertar, borrar, recorrer.',
        'Modelar bien los datos simplifica el código: media vida de bugs viene de estructuras mal elegidas.',
        'Practica transformaciones habituales: de lista a mapa, agrupar, indexar, deduplicar.',
      ],
      aiFocus:
        'Implementar un árbol balanceado de memoria ya no te lo pedirá nadie: la IA lo escribe en segundos. Lo que no elige por ti es la estructura adecuada para TU problema y TU volumen de datos. Profundiza en reconocer patrones: «esto es un mapa», «esto pide un conjunto».',
      resources: [
        { kind: 'libro', label: 'Grokking Algorithms (Aditya Bhargava)', format: 'papel' },
        { kind: 'doc', label: 'roadmap.sh — Computer Science', url: 'https://roadmap.sh/computer-science' },
        { kind: 'doc', label: 'VisuAlgo — estructuras y algoritmos visualizados', url: 'https://visualgo.net' },
      ],
    },
    {
      id: 'bases/complejidad',
      name: 'Intuición de coste',
      kind: 'skill',
      area: 'fundamentos',
      x: 6,
      y: 54,
      weight: 2,
      summary: 'La intuición de coste es notar cuándo un código se va a poner lento al crecer los datos. Consiste en distinguir de un vistazo lo que escala de lo que no (bucles anidados, búsquedas repetidas). Te capacita para evitar el cuello de botella antes de que llegue a producción.',
      prereqs: ['bases/estructuras-datos'],
      keyPoints: [
        'Big-O como intuición: ¿qué le pasa a este código si los datos crecen ×10 o ×1000?',
        'Reconoce las clases que importan en el día a día: O(1), O(log n), O(n), O(n²).',
        'El bucle dentro de un bucle sobre los mismos datos es la alarma más común.',
        'Mide antes de optimizar: la intuición te dice dónde mirar; el profiler, dónde actuar.',
        'En la práctica el coste suele estar en la IO (red, disco, base de datos), no en la CPU.',
      ],
      aiFocus:
        'La IA estima la complejidad de una función que le pases, pero no ve el contexto: cuántos datos habrá en producción ni cada cuánto se ejecuta. Profundiza en la intuición de escala — es lo que te permite oler el código generado que funciona en la demo y muere con datos reales.',
      resources: [
        { kind: 'doc', label: 'Big-O Cheat Sheet', url: 'https://www.bigocheatsheet.com' },
        { kind: 'curso', label: 'Khan Academy — Algorithms', url: 'https://www.khanacademy.org/computing/computer-science/algorithms' },
      ],
    },
    {
      id: 'bases/depuracion',
      name: 'Depuración sistemática',
      kind: 'skill',
      area: 'fundamentos',
      x: 20,
      y: 48,
      weight: 3,
      summary: 'La depuración sistemática es encontrar la causa de un fallo con método en vez de a base de suerte. Consiste en reproducir, aislar, formular hipótesis y comprobarlas una a una. Te capacita para resolver cualquier bug sin dar palos de ciego durante horas.',
      prereqs: ['bases/logica-descomposicion'],
      keyPoints: [
        'Reproduce el fallo de forma fiable antes de intentar arreglarlo.',
        'Depurar es el método científico: formula hipótesis y descártalas con evidencia.',
        'Divide y vencerás: aísla la mitad del sistema donde seguro que NO está el bug.',
        'Lee el mensaje de error entero, incluida la traza: la respuesta suele estar ahí.',
        'Cuando lo arregles, entiende POR QUÉ fallaba: un fix sin causa raíz es deuda.',
      ],
      aiFocus:
        'La IA es un patito de goma excelente: explica errores, propone hipótesis y lee trazas al instante. Pero solo tú puedes observar el sistema real (logs, datos, timing). Profundiza en aislar y reproducir: dale a la IA un fallo acotado y lo resolverá; dale síntomas vagos y alucinaréis juntos.',
      resources: [
        { kind: 'libro', label: 'Debugging: The 9 Indispensable Rules (David J. Agans)', format: 'papel' },
        { kind: 'post', label: 'Julia Evans — zines y posts sobre depuración', url: 'https://jvns.ca' },
        { kind: 'doc', label: 'Chrome DevTools — documentación oficial', url: 'https://developer.chrome.com/docs/devtools' },
      ],
    },
    {
      id: 'bases/leer-codigo',
      name: 'Leer código ajeno',
      kind: 'skill',
      area: 'fundamentos',
      x: 30,
      y: 40,
      weight: 3,
      summary: 'Leer código ajeno es entender un programa que no escribiste tú, que es la mayor parte del trabajo real. Consiste en seguir el flujo, identificar lo importante y no perderte en el detalle. Te capacita para incorporarte a cualquier proyecto sin tener que reescribirlo.',
      prereqs: ['bases/logica-descomposicion'],
      keyPoints: [
        'Empieza por los puntos de entrada y sigue el flujo de un caso de uso concreto.',
        'Lee los tests: son la documentación ejecutable de la intención.',
        'Usa la búsqueda del editor y el historial de git: «¿por qué se cambió esto?».',
        'Resume con tus palabras qué hace un módulo antes de modificarlo.',
        'Acostúmbrate a leer diffs: es el formato en el que llega casi todo el código que revisarás.',
      ],
      aiFocus:
        'La IA resume código y responde preguntas sobre una base de código mejor que cualquier wiki. Aun así, leer código sigue siendo tu herramienta de verificación: cuando la explicación de la IA y el código discrepan, gana el código. Profundiza en leer diffs con ojo crítico.',
      resources: [
        { kind: 'libro', label: 'The Programmer’s Brain (Felienne Hermans)', format: 'papel' },
        { kind: 'post', label: 'Understand Legacy Code (Nicolas Carlo)', url: 'https://understandlegacycode.com' },
      ],
    },

    // ── Herramientas del día a día (este) ───────────────────────────────────
    {
      id: 'bases/git',
      name: 'Git',
      kind: 'tech',
      area: 'herramientas',
      x: 80,
      y: 66,
      weight: 3,
      summary: 'Git es el control de versiones estándar: guarda la historia de tu código en commits y permite trabajar en paralelo con ramas. Consiste en confirmar, ramificar, fusionar y resolver conflictos sin pánico. Te capacita para colaborar sin pisar el trabajo de nadie y sin miedo a romper.',
      prereqs: [],
      keyPoints: [
        'Flujo básico con soltura: rama, commit, push, pull request, merge.',
        'Commits pequeños y atómicos, con mensajes que explican el porqué.',
        'Resuelve conflictos sin pánico: entiende qué cambió en cada rama antes de elegir.',
        'Usa el historial como herramienta de investigación: log, blame, bisect.',
        'Sabe deshacer: restore, revert, reset — y cuándo usar cada uno.',
      ],
      aiFocus:
        'La IA te da el comando exacto para casi cualquier apuro de git: ya no hace falta memorizar flags. Lo que no puede es decidir tu estrategia de ramas ni salvarte si ejecutas a ciegas un comando destructivo. Profundiza en el modelo mental (commit, rama, stage): con él, cualquier receta se vuelve obvia.',
      resources: [
        { kind: 'doc', label: 'Pro Git — el libro oficial, en español', url: 'https://git-scm.com/book/es/v2' },
        { kind: 'doc', label: 'roadmap.sh — Git y GitHub', url: 'https://roadmap.sh/git-github' },
        { kind: 'post', label: 'Oh Shit, Git!?! — recetas para salir de líos', url: 'https://ohshitgit.com' },
      ],
    },
    {
      id: 'bases/terminal',
      name: 'Terminal y shell',
      kind: 'tech',
      area: 'herramientas',
      x: 92,
      y: 58,
      weight: 2,
      summary: 'La terminal y el shell son la vía directa para hablar con tu máquina sin ratón. Consiste en moverte por ficheros, encadenar comandos y automatizar tareas repetitivas con scripts. Te capacita para trabajar más rápido y para manejar servidores donde no hay interfaz gráfica.',
      prereqs: [],
      keyPoints: [
        'Muévete con soltura: navegar, buscar ficheros, ver logs, matar procesos.',
        'Encadena comandos con pipes y redirecciones: la shell es pegamento universal.',
        'Variables de entorno y PATH: ahí vive la mitad de los «en mi máquina funciona».',
        'Aprende un puñado de herramientas potentes: grep, find, curl, tail.',
        'Un script de más de diez líneas merece un fichero versionado, no un one-liner heroico.',
      ],
      aiFocus:
        'La IA escribe one-liners y scripts de shell mejor que la mayoría de humanos. Tu trabajo es entender qué hace un comando ANTES de ejecutarlo — sobre todo con sudo, rm o pipes a bash. Profundiza en leer comandos ajenos: es tu cinturón de seguridad.',
      resources: [
        { kind: 'curso', label: 'The Missing Semester of Your CS Education (MIT)', url: 'https://missing.csail.mit.edu' },
        { kind: 'doc', label: 'Manual de GNU Bash', url: 'https://www.gnu.org/software/bash/manual/' },
      ],
    },
    {
      id: 'bases/editor-asistentes',
      name: 'Editor y asistentes IA',
      kind: 'tech',
      area: 'herramientas',
      x: 82,
      y: 46,
      weight: 2,
      summary: 'Dominar tu editor y sus asistentes de IA es sacarle partido a la herramienta donde pasas el día. Consiste en atajos, navegación, refactors y usar el copiloto sin que te lleve él a ti. Te capacita para editar a la velocidad del pensamiento en vez de pelearte con el editor.',
      prereqs: ['bases/pensar-con-ia'],
      keyPoints: [
        'Domina TU editor: navegación por símbolos, multi-cursor, refactor básico, depurador integrado.',
        'Configura el asistente con el contexto del proyecto: reglas, convenciones, ficheros clave.',
        'Distingue los modos de uso: autocompletado, chat sobre el código, agentes que editan por ti.',
        'Revisa los diffs del asistente igual que revisarías el PR de un compañero.',
        'Automatiza lo repetitivo con tooling (snippets, format-on-save, linters): el asistente no lo sustituye.',
      ],
      aiFocus:
        'El asistente elimina el «¿cómo se escribía esto?» del día a día. Usarlo bien depende del contexto que le das y del control que mantienes: sesiones acotadas, diffs revisados, tests que lo vigilan. Profundiza en tu flujo de trabajo, no en el hype de cada herramienta nueva.',
      resources: [
        { kind: 'doc', label: 'Visual Studio Code — documentación', url: 'https://code.visualstudio.com/docs' },
        { kind: 'post', label: 'Armin Ronacher — flujo de trabajo con agentes', url: 'https://lucumr.pocoo.org' },
      ],
    },
    {
      id: 'bases/busqueda-efectiva',
      name: 'Búsqueda efectiva',
      kind: 'skill',
      area: 'herramientas',
      x: 68,
      y: 54,
      weight: 2,
      summary: 'La búsqueda efectiva es encontrar la respuesta buena rápido, ya sea en Google, la documentación o preguntando a la IA. Consiste en formular bien la pregunta y saber juzgar la fuente. Te capacita para desatascarte solo en minutos en vez de quedarte parado.',
      prereqs: [],
      keyPoints: [
        'La documentación oficial es la fuente primaria; posts, foros e IA son fuentes secundarias.',
        'Busca el error literal entre comillas y quita las partes específicas de tu máquina.',
        'Aprende a buscar dentro del repo: issues del proyecto, changelog, el propio código fuente.',
        'Contrasta la fecha: una respuesta de hace cinco años puede describir una API muerta.',
        'Cuando la IA te responda, pídele términos y fuentes para verificarlo en la doc oficial.',
      ],
      aiFocus:
        'La IA ha sustituido al 90% de las búsquedas: preguntas y tienes una respuesta sintetizada. El 10% restante es donde te juegas el rigor — versiones concretas, breaking changes, bugs abiertos. Profundiza en localizar y leer fuentes primarias: changelogs, issues y docs oficiales.',
      resources: [
        { kind: 'doc', label: 'DevDocs — todas las docs oficiales en un buscador', url: 'https://devdocs.io' },
        { kind: 'doc', label: 'Stack Overflow — cómo preguntar bien', url: 'https://stackoverflow.com/help/how-to-ask' },
      ],
    },

    // ── Construir software (norte-centro) ───────────────────────────────────
    {
      id: 'bases/http-apis',
      name: 'HTTP y APIs',
      kind: 'tech',
      area: 'construir',
      x: 50,
      y: 28,
      weight: 3,
      summary: 'HTTP y las APIs son cómo se hablan los programas por la red: peticiones, respuestas, métodos y códigos de estado. Consiste en entender qué se pide, qué se devuelve y qué significa cada error. Te capacita para conectar tu software con cualquier servicio del mundo.',
      prereqs: ['bases/logica-descomposicion'],
      keyPoints: [
        'El ciclo petición/respuesta: métodos, códigos de estado, cabeceras, cuerpo.',
        'Consume APIs con soltura: autenticación, paginación, manejo de errores y reintentos.',
        'Diseña endpoints básicos coherentes: recursos claros, verbos correctos, errores útiles.',
        'Entiende qué viaja por la red: JSON sobre HTTPS, latencia, timeouts.',
        'Inspecciona cualquier API con las DevTools (pestaña Network) y con curl.',
      ],
      aiFocus:
        'La IA genera clientes y endpoints enteros a partir de una frase. Lo que no decide es el contrato: qué expone tu API, cómo versiona y cómo falla. Profundiza en leer APIs ajenas con ojo crítico y en diseñar contratos que no te arrepientas de mantener.',
      resources: [
        { kind: 'doc', label: 'MDN — HTTP', url: 'https://developer.mozilla.org/es/docs/Web/HTTP' },
        { kind: 'doc', label: 'roadmap.sh — API Design', url: 'https://roadmap.sh/api-design' },
      ],
    },
    {
      id: 'bases/json-datos',
      name: 'JSON y datos',
      kind: 'tech',
      area: 'construir',
      x: 36,
      y: 20,
      weight: 1,
      summary: 'JSON es el formato en el que viajan casi todos los datos entre sistemas: objetos, listas y valores. Consiste en leerlo, construirlo y validar que tiene la forma esperada. Te capacita para intercambiar información entre tu código y cualquier API sin liarte.',
      prereqs: ['bases/estructuras-datos'],
      keyPoints: [
        'JSON como lengua franca: tipos, anidamiento y sus límites (fechas, números grandes).',
        'Serializa y parsea con seguridad: valida lo que entra, no confíes en la forma.',
        'Transforma datos con criterio: mapear, filtrar y agrupar sin mutar la fuente.',
        'Conoce los formatos vecinos y cuándo aparecen: CSV, YAML, form-data.',
      ],
      aiFocus:
        'Escribir transformaciones de datos es trabajo que la IA borda. Tu parte es conocer los datos reales: qué campos pueden faltar, qué formatos llegan rotos y qué significa cada campo en el negocio. Profundiza en validar en las fronteras del sistema.',
      resources: [
        { kind: 'doc', label: 'json.org — introducción a JSON, en español', url: 'https://www.json.org/json-es.html' },
        { kind: 'doc', label: 'MDN — JavaScript (JSON y datos)', url: 'https://developer.mozilla.org/es/docs/Web/JavaScript' },
      ],
    },
    {
      id: 'bases/testing',
      name: 'Testing',
      kind: 'skill',
      area: 'construir',
      x: 62,
      y: 36,
      weight: 3,
      summary: 'El testing es escribir código que comprueba que tu código funciona, hoy y cuando lo cambies mañana. Consiste en cubrir los casos importantes y ejecutar las pruebas a menudo. Te capacita para refactorizar y entregar con la red de seguridad puesta, sin miedo a romper.',
      prereqs: ['bases/verificar-salida-ia', 'bases/depuracion'],
      keyPoints: [
        'La pirámide: muchos tests unitarios, algunos de integración, pocos end-to-end.',
        'Un buen test fija COMPORTAMIENTO, no implementación: debe sobrevivir a un refactor.',
        'Escribe primero el caso feliz y luego los bordes: vacío, null, límites, errores.',
        'Tests deterministas y rápidos, o el equipo dejará de ejecutarlos.',
        'Con IA: define tú los casos y deja que genere el andamiaje; nunca al revés.',
      ],
      aiFocus:
        'La IA genera suites de tests en segundos — incluidos tests inútiles que pasan siempre. Decidir qué merece test y detectar asserts vacíos es tu criterio. Profundiza en diseñar casos: el test que tú especificas es además tu red de seguridad frente al propio código generado.',
      resources: [
        { kind: 'post', label: 'Martin Fowler — The Practical Test Pyramid', url: 'https://martinfowler.com/articles/practical-test-pyramid.html' },
        { kind: 'doc', label: 'Vitest — documentación oficial', url: 'https://vitest.dev' },
      ],
    },
    {
      id: 'bases/clean-code',
      name: 'Código legible',
      kind: 'skill',
      area: 'construir',
      x: 42,
      y: 36,
      weight: 3,
      summary: 'El código legible es el que la próxima persona (o tú en tres meses) entiende sin sufrir. Consiste en buenos nombres, funciones pequeñas y quitar lo que sobra. Te capacita para trabajar en equipo sobre una base que se mantiene en vez de pudrirse.',
      prereqs: ['bases/leer-codigo', 'bases/revisar-codigo-ia'],
      keyPoints: [
        'Optimiza para quien lee: nombres que cuentan la intención, funciones cortas, una responsabilidad.',
        'La legibilidad gana a la astucia: si necesitas un comentario para explicar el «cómo», simplifica.',
        'Refactoriza en pasos pequeños y con los tests en verde.',
        'Duplicar dos veces está bien; a la tercera, extrae.',
        'Consistencia sobre gusto personal: sigue el estilo del proyecto y automatízalo (linter, formatter).',
      ],
      aiFocus:
        'La IA escribe código correcto pero con tendencia a la sobreingeniería: capas, opciones y abstracciones que nadie pidió. Tu papel es podar: exigir la versión más simple que funcione. Profundiza en refactoring y en oler la complejidad accidental — YAGNI vale más que nunca.',
      resources: [
        { kind: 'libro', label: 'Clean Code (Robert C. Martin)', format: 'papel' },
        { kind: 'libro', label: 'Refactoring (Martin Fowler)', format: 'papel' },
        { kind: 'doc', label: 'Refactoring Guru — en español', url: 'https://refactoring.guru/es' },
      ],
    },
    {
      id: 'bases/seguridad-basica',
      name: 'Seguridad básica',
      kind: 'skill',
      area: 'construir',
      x: 66,
      y: 22,
      weight: 3,
      summary: 'La seguridad básica es no dejar la puerta abierta: validar entradas, no confiar en el cliente y proteger secretos. Consiste en conocer los fallos más comunes (inyección, XSS, credenciales expuestas) y cerrarlos. Te capacita para entregar software que no sea un regalo para el primer atacante.',
      prereqs: ['bases/http-apis', 'bases/limites-riesgos-ia'],
      keyPoints: [
        'Nunca en el código: secretos, claves y tokens van en variables de entorno o gestores de secretos.',
        'Valida y sanea TODA entrada externa (usuarios, APIs, ficheros) en la frontera, no dentro.',
        'Conoce el OWASP Top 10: inyección, autenticación rota y XSS los verás en tu primer año.',
        'HTTPS siempre; contraseñas con hash lento (bcrypt/argon2), jamás en claro.',
        'Principio de mínimo privilegio: cada pieza con los permisos justos.',
      ],
      aiFocus:
        'La IA repite los errores de seguridad que vio en su entrenamiento: ejemplos con secretos hardcodeados, SQL concatenado, CORS abierto. Nunca asumas que el código generado es seguro por defecto. Profundiza en el OWASP Top 10 y revisa la salida de la IA con esa lista en la cabeza.',
      resources: [
        { kind: 'doc', label: 'OWASP Top Ten', url: 'https://owasp.org/www-project-top-ten/' },
        { kind: 'doc', label: 'OWASP Cheat Sheet Series', url: 'https://cheatsheetseries.owasp.org' },
        { kind: 'doc', label: 'MDN — seguridad web', url: 'https://developer.mozilla.org/es/docs/Web/Security' },
      ],
    },
    {
      id: 'bases/primer-producto',
      name: 'Entregar software que funciona',
      kind: 'milestone',
      area: 'construir',
      x: 52,
      y: 12,
      weight: 3,
      summary: 'Entregar software que funciona es el hito de llevar algo pequeño de la idea a manos de un usuario real. Consiste en juntar todo lo aprendido en un producto completo, por humilde que sea. Te capacita para demostrarte que sabes cerrar, no solo empezar.',
      prereqs: ['bases/testing', 'bases/clean-code', 'bases/git'],
      keyPoints: [
        'Cierra el ciclo completo: idea → código → tests → PR → desplegado y usado por alguien.',
        'Termina cosas: un proyecto pequeño ACABADO enseña más que tres a medias.',
        'Lo que no está en producción no existe: aprende lo mínimo de desplegar y monitorizar.',
        'Recorta alcance, no calidad: la versión 1 es pequeña, correcta y mejorable.',
      ],
      aiFocus:
        'Con IA, montar un prototipo cuesta una tarde; la diferencia profesional está en convertirlo en algo mantenible: tests, despliegue, errores controlados. Profundiza en terminar y publicar — el criterio de «esto está listo» no se puede delegar.',
      resources: [
        { kind: 'libro', label: 'Shape Up (Basecamp) — gratis en la web', url: 'https://basecamp.com/shapeup', format: 'online' },
        { kind: 'doc', label: 'roadmap.sh — elige tu siguiente isla', url: 'https://roadmap.sh' },
      ],
    },

    // ── Trabajar en equipo (noroeste) ───────────────────────────────────────
    {
      id: 'bases/code-review',
      name: 'Code review',
      kind: 'skill',
      area: 'equipo',
      x: 22,
      y: 28,
      weight: 3,
      summary: 'El code review es revisar (y que te revisen) los cambios antes de que entren, mejorando el código y el criterio de ambos. Consiste en dar feedback claro y recibirlo sin ego. Te capacita para elevar la calidad del equipo y aprender de cada revisión.',
      prereqs: ['bases/revisar-codigo-ia', 'bases/git'],
      keyPoints: [
        'Al revisar: entiende el propósito del cambio antes de comentar líneas.',
        'Comenta sobre el código, nunca sobre la persona; propone en vez de imponer.',
        'Al recibir: los comentarios van sobre el diff, no sobre ti; agradece el que te salva un bug.',
        'PRs pequeñas: nadie revisa bien 800 líneas.',
        'Separa lo importante (bugs, seguridad, diseño) del estilo — el estilo lo automatiza el linter.',
      ],
      aiFocus:
        'La IA hace una primera pasada útil (bugs obvios, estilo, typos) y deja la revisión humana para lo que importa: ¿resuelve el problema correcto?, ¿encaja en la arquitectura?, ¿se entenderá en seis meses? Profundiza en dar feedback claro y amable: es una habilidad de carrera, no solo de código.',
      resources: [
        { kind: 'doc', label: 'Google Engineering Practices — guía de code review', url: 'https://google.github.io/eng-practices/review/' },
        { kind: 'post', label: 'How to Do Code Reviews Like a Human (Michael Lynch)', url: 'https://mtlynch.io/human-code-reviews-1/' },
      ],
    },
    {
      id: 'bases/documentacion',
      name: 'Documentación útil',
      kind: 'skill',
      area: 'equipo',
      x: 10,
      y: 20,
      weight: 2,
      summary: 'La documentación útil es la mínima que hace falta para que otro use tu trabajo sin preguntarte: un README claro, decisiones anotadas. Consiste en escribir lo que no se deduce del código. Te capacita para que tu trabajo sobreviva sin ti pegado al lado.',
      prereqs: ['bases/clean-code'],
      keyPoints: [
        'Documenta el PORQUÉ (decisiones, restricciones); el qué ya lo cuenta el código.',
        'README mínimo: qué es, cómo arrancarlo, cómo probarlo — y mantenido como el código.',
        'Escribe para quien acaba de llegar (tu yo de dentro de seis meses).',
        'Documentación cerca del código: la wiki que nadie ve en el PR acaba muriendo.',
        'Cada necesidad tiene su tipo de doc: tutorial, guía, referencia, explicación.',
      ],
      aiFocus:
        'La IA redacta borradores de README y docstrings al instante — y también relleno pomposo que nadie leerá. Tu trabajo es decidir qué merece documentarse y verificar que lo escrito sea cierto. Profundiza en documentar decisiones (ADRs): eso la IA no puede inventarlo por ti.',
      resources: [
        { kind: 'doc', label: 'Diátaxis — los cuatro tipos de documentación', url: 'https://diataxis.fr' },
        { kind: 'doc', label: 'Write the Docs — guías de la comunidad', url: 'https://www.writethedocs.org' },
      ],
    },
    {
      id: 'bases/comunicacion-async',
      name: 'Comunicación asíncrona',
      kind: 'skill',
      area: 'equipo',
      x: 18,
      y: 10,
      weight: 2,
      summary: 'La comunicación asíncrona es dejar las cosas escritas de forma que se entiendan sin ti delante: mensajes, tickets, propuestas. Consiste en dar contexto, ser conciso y no obligar a una reunión. Te capacita para trabajar con equipos distribuidos y por husos horarios.',
      prereqs: ['bases/documentacion'],
      keyPoints: [
        'Mensajes autocontenidos: contexto, qué necesitas y para cuándo — evita el «hola» a secas.',
        'Elige el canal por permanencia: decisión → issue/PR; duda rápida → chat. Nunca al revés.',
        'Haz visible tu trabajo sin que te pregunten: updates cortos y frecuentes.',
        'Desacuerdo por escrito: expón opciones y trade-offs, no vencedores.',
        'Un buen reporte de bug (pasos, esperado, obtenido) ahorra tres rondas de preguntas.',
      ],
      aiFocus:
        'La IA pule tu redacción y resume hilos eternos, pero no sabe qué contexto tiene tu interlocutor ni qué asunto es delicado. Profundiza en empatía comunicativa: anticipar qué necesita saber la otra persona es criterio humano puro.',
      resources: [
        { kind: 'post', label: 'Basecamp — The Guide to Internal Communication', url: 'https://basecamp.com/guides/how-we-communicate' },
        { kind: 'doc', label: 'GitLab Handbook — trabajo remoto y asíncrono', url: 'https://handbook.gitlab.com' },
      ],
    },
    {
      id: 'bases/estimacion',
      name: 'Estimación honesta',
      kind: 'skill',
      area: 'equipo',
      x: 6,
      y: 36,
      weight: 2,
      summary: 'La estimación honesta es dar un plazo en el que tú mismo confías, con su margen de incertidumbre. Consiste en descomponer el trabajo, reconocer lo que no sabes y no prometer de más. Te capacita para que confíen en tu palabra y para planificar sin dramas.',
      prereqs: ['bases/delegar-o-hacer'],
      keyPoints: [
        'Estima en rangos, no en fechas exactas: la incertidumbre también es información.',
        'Descompón antes de estimar: lo que no sabes dividir, no lo sabes estimar.',
        'Separa esfuerzo de plazo: tres días de trabajo no es «para el jueves».',
        'Comunica los riesgos al dar la cifra, no cuando ya vas tarde.',
        'Apunta tus estimaciones y compáralas con la realidad: es la única forma de calibrarte.',
      ],
      aiFocus:
        'La IA acelera tanto algunas tareas que rompe tu calibración histórica — y no acelera nada la integración, las revisiones ni los imprevistos. Profundiza en recalibrarte en la era IA: mide qué partes de tu trabajo se han acelerado de verdad y cuáles no.',
      resources: [
        { kind: 'libro', label: 'Software Estimation: Demystifying the Black Art (Steve McConnell)', format: 'papel' },
        { kind: 'post', label: 'Jacob Kaplan-Moss — serie sobre estimación', url: 'https://jacobian.org' },
      ],
    },
    {
      id: 'bases/profesional-ia',
      name: 'Profesional en la era IA',
      kind: 'milestone',
      area: 'equipo',
      x: 34,
      y: 6,
      weight: 3,
      summary: 'Ser profesional en la era IA es el hito de trabajar como ingeniero de verdad: entregas valor, colaboras y usas la IA con criterio. Consiste en juntar oficio, comunicación y juicio, no solo teclear. Te capacita para ser alguien en quien un equipo se apoya, no un generador de código más.',
      prereqs: ['bases/primer-producto', 'bases/code-review', 'bases/seguridad-basica', 'bases/estimacion'],
      keyPoints: [
        'Integras todo: delegas con criterio, verificas lo delegado y respondes por el resultado.',
        'Tu valor ya no es teclear rápido: es criterio, contexto y responsabilidad.',
        'Sigues aprendiendo fundamentos: cada abstracción que entiendes multiplica lo que puedes delegar.',
        'Construyes reputación de fiabilidad: entregas verificadas, comunicación clara, estimaciones honestas.',
      ],
      aiFocus:
        'Has llegado al puerto de salida real: la IA como multiplicador, no como muleta. A partir de aquí elige una disciplina (las otras islas) y aplica el mismo método: fundamentos, criterio y verificación. Lo que la IA hace barato lo hace barato para todos; tu diferencia está en lo que sabes juzgar.',
      resources: [
        { kind: 'libro', label: 'The Missing README (Riccomini y Ryaboy)', format: 'papel' },
        { kind: 'post', label: 'The Pragmatic Engineer (Gergely Orosz)', url: 'https://blog.pragmaticengineer.com' },
      ],
    },
  ],
};
