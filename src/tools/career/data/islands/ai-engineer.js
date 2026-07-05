/**
 * Isla «AI Engineer» (doc /careerMap/ai-engineer) — contenido curado MC-16,
 * oleada 2.
 *
 * Sigue la convención de contenido de islas (ver cabecera de ./bases.js):
 * ids de ciudad prefijados 'ai-engineer/', prereqs internos sin ciclos,
 * posiciones 0..100 separadas, pesos 1..3 y contenido en español.
 * Referencia temática: roadmap.sh/ai-engineer. Esta isla ES la era IA: aquí
 * no aprendes a programar con ayuda de modelos, aprendes a CONSTRUIR
 * productos sobre modelos — y el aiFocus de cada ciudad marca esa diferencia
 * entre usar IA y construir con IA.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const AI_ENGINEER_ISLAND = {
  id: 'ai-engineer',
  name: 'Isla AI Engineer',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'fundamentos', name: 'Fundamentos de LLMs' },
    { id: 'contexto', name: 'Prompting y contexto' },
    { id: 'rag', name: 'RAG y conocimiento' },
    { id: 'agentes', name: 'Agentes y herramientas' },
    { id: 'calidad', name: 'Evaluación y seguridad' },
    { id: 'produccion', name: 'Producto y producción' },
  ],
  cities: [
    // ── Fundamentos de LLMs (sur, comarca de entrada) ───────────────────────
    {
      id: 'ai-engineer/como-funciona-llm',
      name: 'Cómo funciona un LLM',
      kind: 'skill',
      area: 'fundamentos',
      x: 42,
      y: 76,
      weight: 3,
      summary: 'Entender cómo funciona un LLM es saber qué hace por dentro: predice el siguiente token a partir de patrones, no razona ni consulta una verdad. Consiste en tener el modelo mental correcto de sus tripas. Te capacita para usarlo bien y no sorprenderte de sus aciertos ni de sus fallos.',
      prereqs: [],
      keyPoints: [
        'Tokens, no palabras: todo (coste, límites, rarezas al contar letras) se explica desde ahí.',
        'Predicción del siguiente token: el modelo continúa texto plausible, no consulta una base de datos.',
        'Pre-entrenamiento, fine-tuning e instrucciones: de dónde sale el comportamiento del modelo.',
        'Temperatura y sampling: por qué la misma pregunta da respuestas distintas.',
        'La ventana de contexto es la memoria de trabajo: fuera de ella, el modelo no sabe nada de ti.',
      ],
      aiFocus:
        'Usar IA es escribir prompts; construir con IA exige saber qué hay debajo: por qué alucina, por qué el coste va por tokens, por qué se degrada con contextos largos. Profundiza en el modelo mental de la predicción de tokens — cada decisión de diseño de esta isla se apoya en él.',
      resources: [
        { kind: 'curso', label: 'Neural Networks: Zero to Hero (Andrej Karpathy)', url: 'https://karpathy.ai/zero-to-hero.html' },
        { kind: 'doc', label: 'LLM Visualization (Brendan Bycroft)', url: 'https://bbycroft.net/llm' },
        { kind: 'doc', label: 'roadmap.sh — AI Engineer', url: 'https://roadmap.sh/ai-engineer' },
      ],
    },
    {
      id: 'ai-engineer/limites-modelos',
      name: 'Límites de los modelos',
      kind: 'skill',
      area: 'fundamentos',
      x: 42,
      y: 66,
      weight: 3,
      summary: 'Conocer los límites de los modelos es saber dónde flaquean: alucinan, no saben lo reciente, se pierden en contextos largos y no calculan bien. Consiste en anticipar esos fallos por diseño. Te capacita para construir productos que funcionan pese a las limitaciones, no a pesar de ignorarlas.',
      prereqs: ['ai-engineer/como-funciona-llm'],
      keyPoints: [
        'Alucinación por diseño: el modelo no distingue entre lo que sabe y lo que suena bien.',
        'Corte de conocimiento: todo lo posterior al entrenamiento requiere darle la información tú.',
        'Contexto largo no es contexto entendido: lo del medio se pierde («lost in the middle»).',
        'No determinismo: la misma entrada puede dar salidas distintas; diseña asumiéndolo.',
        'Capacidades irregulares: brillante en código, torpe en aritmética; mide, no supongas.',
      ],
      aiFocus:
        'Como usuario, los límites del modelo te incomodan; como constructor, definen tu arquitectura: qué verificas, qué recuperas de fuentes externas, qué no debes prometer al usuario. Profundiza en los modos de fallo concretos del modelo que uses — tu producto es tan fiable como tu manejo de sus fallos.',
      resources: [
        { kind: 'post', label: 'Simon Willison — IA aplicada', url: 'https://simonwillison.net' },
        { kind: 'post', label: 'Chip Huyen — ML y sistemas', url: 'https://huyenchip.com' },
      ],
    },
    {
      id: 'ai-engineer/apis-modelos',
      name: 'APIs de modelos',
      kind: 'tech',
      area: 'fundamentos',
      x: 54,
      y: 76,
      weight: 3,
      summary: 'Las APIs de modelos son cómo llamas a un LLM desde tu código: mensajes, parámetros, streaming y costes. Consiste en dominar la interfaz de los proveedores y sus opciones. Te capacita para integrar IA en cualquier aplicación de forma controlada.',
      prereqs: ['ai-engineer/como-funciona-llm'],
      keyPoints: [
        'La llamada básica: mensajes con roles (system, user, assistant), parámetros y respuesta.',
        'Streaming: tokens según se generan — imprescindible para que la UX no parezca colgada.',
        'Maneja errores reales: rate limits, timeouts y reintentos con backoff desde el día uno.',
        'Cuenta tokens y costes por petición: la factura crece con el uso, no con el despliegue.',
        'Abstrae el proveedor con una capa fina: los modelos se intercambian, tu producto queda.',
      ],
      aiFocus:
        'Primera frontera entre usar y construir: dejas el chat y llamas al modelo desde TU código, con tu manejo de errores y tu presupuesto. Profundiza en streaming, reintentos y contabilidad de tokens — es la fontanería que separa una demo de algo que aguanta usuarios.',
      resources: [
        { kind: 'doc', label: 'Anthropic — documentación de la API', url: 'https://docs.anthropic.com' },
        { kind: 'doc', label: 'OpenAI — documentación de la API', url: 'https://platform.openai.com/docs' },
        { kind: 'doc', label: 'Google AI for Developers', url: 'https://ai.google.dev' },
      ],
    },
    {
      id: 'ai-engineer/modelos-abiertos',
      name: 'Modelos abiertos y locales',
      kind: 'tech',
      area: 'fundamentos',
      x: 66,
      y: 76,
      weight: 1,
      summary: 'Los modelos abiertos y locales son alternativas que puedes ejecutar tú mismo, sin depender de un proveedor. Consiste en saber cuándo compensan por coste, privacidad o control. Te capacita para elegir entre API y modelo propio según lo que el proyecto necesite.',
      prereqs: ['ai-engineer/apis-modelos'],
      keyPoints: [
        'El ecosistema open weights: qué se publica, con qué licencias y qué puedes hacer con ello.',
        'Correr un modelo en local (Ollama y similares): útil para privacidad, coste y experimentar.',
        'Cuantización: el trade-off entre tamaño, velocidad y calidad.',
        'Cuándo compensa lo abierto: datos que no pueden salir, volumen alto, control total.',
        'Los benchmarks públicos orientan; tu caso de uso decide.',
      ],
      aiFocus:
        'Construir con IA incluye decidir DÓNDE corre el modelo: API de terceros, abierto autohospedado o híbrido. Es una decisión de privacidad, coste y operación, no de ideología. Profundiza en evaluar modelos abiertos contra TU tarea — el ranking público no conoce tu producto.',
      resources: [
        { kind: 'doc', label: 'Hugging Face — documentación', url: 'https://huggingface.co/docs' },
        { kind: 'doc', label: 'Ollama — modelos en local', url: 'https://ollama.com' },
      ],
    },

    // ── Prompting y contexto (oeste) ────────────────────────────────────────
    {
      id: 'ai-engineer/prompting',
      name: 'Prompting con método',
      kind: 'skill',
      area: 'contexto',
      x: 30,
      y: 66,
      weight: 3,
      summary: 'El prompting con método es dirigir al modelo con instrucciones claras en vez de a base de suerte. Consiste en dar contexto, formato y ejemplos, e iterar midiendo. Te capacita para sacar resultados fiables y repetibles del modelo, no ocurrencias.',
      prereqs: ['ai-engineer/como-funciona-llm'],
      keyPoints: [
        'System prompt como especificación: rol, reglas, formato de salida y casos límite.',
        'Few-shot: dos ejemplos buenos rinden más que tres párrafos de instrucciones.',
        'Deja razonar al modelo antes de responder en tareas complejas; pide la respuesta al final.',
        'Los prompts de producción se versionan, se testean y se revisan como código.',
        'Un cambio de modelo puede romper tus prompts: re-evalúa al migrar.',
      ],
      aiFocus:
        'Aquí el prompt deja de ser una conversación y pasa a ser un artefacto de ingeniería: correrá miles de veces contra entradas que no controlas. Profundiza en escribir especificaciones no ambiguas y en versionarlas con tests — la diferencia entre prompt de usuario y prompt de producto es la misma que entre script y sistema.',
      resources: [
        { kind: 'doc', label: 'Prompt Engineering Guide', url: 'https://www.promptingguide.ai' },
        { kind: 'doc', label: 'roadmap.sh — Prompt Engineering', url: 'https://roadmap.sh/prompt-engineering' },
      ],
    },
    {
      id: 'ai-engineer/context-engineering',
      name: 'Context engineering',
      kind: 'skill',
      area: 'contexto',
      x: 30,
      y: 56,
      weight: 3,
      summary: 'El context engineering es decidir qué información entra en la ventana del modelo y cómo. Consiste en seleccionar, resumir y ordenar el contexto para que el modelo trabaje sobre lo relevante. Te capacita para que el modelo responda con precisión en vez de ahogado en ruido.',
      prereqs: ['ai-engineer/prompting'],
      keyPoints: [
        'La disciplina real: decidir QUÉ entra en la ventana de contexto en cada llamada, y qué no.',
        'El contexto es un presupuesto: cada token compite; más no es mejor, relevante es mejor.',
        'Estructura el contexto: instrucciones, documentos recuperados, historial — con fronteras claras.',
        'Memoria conversacional: resumir, truncar o recuperar; el historial infinito no existe.',
        'Distingue las fuentes: lo que dice el usuario, lo que dicen tus datos y lo que pide el sistema.',
      ],
      aiFocus:
        'Cuando usas un asistente, alguien diseñó qué ve el modelo en cada turno; ahora ese alguien eres tú. Profundiza en presupuestar y estructurar el contexto — la mayoría de los fallos «del modelo» en producción son en realidad fallos del contexto que le montaste.',
      resources: [
        { kind: 'post', label: 'Simon Willison — context engineering', url: 'https://simonwillison.net' },
        { kind: 'post', label: 'Latent Space — el oficio del AI engineer', url: 'https://www.latent.space' },
      ],
    },
    {
      id: 'ai-engineer/salida-estructurada',
      name: 'Salida estructurada',
      kind: 'tech',
      area: 'contexto',
      x: 18,
      y: 56,
      weight: 2,
      summary: 'La salida estructurada es forzar al modelo a devolver datos con una forma fija (JSON, esquema) en vez de texto libre. Consiste en usar esquemas y validación de la respuesta. Te capacita para conectar la IA con tu código sin parsear a mano lo que dijo.',
      prereqs: ['ai-engineer/apis-modelos', 'ai-engineer/prompting'],
      keyPoints: [
        'JSON con esquema: structured outputs o tool use para que la salida sea parseable siempre.',
        'Valida en la frontera igualmente: esquema correcto no significa contenido correcto.',
        'Enums y campos cerrados reducen la alucinación: menos libertad, menos inventos.',
        'Diseña el «no lo sé»: un campo para la incertidumbre evita respuestas forzadas.',
        'Reintentos con feedback del error de validación: el modelo corrige si le dices qué falló.',
      ],
      aiFocus:
        'Para que un LLM sea una pieza de software y no un chat, su salida debe ser un contrato que tu código consuma. Profundiza en diseñar esquemas y validación en la frontera — es lo que convierte texto probabilístico en datos con los que se puede programar.',
      resources: [
        { kind: 'doc', label: 'JSON Schema', url: 'https://json-schema.org' },
        { kind: 'doc', label: 'Pydantic — validación en Python', url: 'https://docs.pydantic.dev' },
      ],
    },

    // ── RAG y conocimiento (oeste-norte) ────────────────────────────────────
    {
      id: 'ai-engineer/embeddings',
      name: 'Embeddings y búsqueda semántica',
      kind: 'tech',
      area: 'rag',
      x: 30,
      y: 46,
      weight: 3,
      summary: 'Los embeddings y la búsqueda semántica son convertir texto en vectores para buscar por significado, no por palabras exactas. Consiste en generar embeddings y comparar por similitud. Te capacita para encontrar contenido relevante aunque no coincidan las palabras.',
      prereqs: ['ai-engineer/apis-modelos'],
      keyPoints: [
        'Texto a vectores: cercanía en el espacio = similitud de significado.',
        'Similitud coseno y vecinos más próximos: la mecánica de la búsqueda semántica.',
        'Bases vectoriales: cuándo basta un índice en memoria o pgvector y cuándo no.',
        'El modelo de embedding importa: cambiarlo obliga a reindexar todo.',
        'Semántica no es magia: «no funciona» y «funciona» son cercanos; mide con tus queries.',
      ],
      aiFocus:
        'Los embeddings son tu primera pieza de IA que no genera texto: infraestructura de significado sobre la que construir búsqueda, RAG y deduplicación. Profundiza en evaluar la calidad de recuperación con TUS datos y consultas reales — la demo con cuatro documentos siempre funciona.',
      resources: [
        { kind: 'libro', label: 'What are Embeddings (Vicki Boykis)', url: 'https://vickiboykis.com/what_are_embeddings/', format: 'online' },
        { kind: 'doc', label: 'Sentence Transformers', url: 'https://www.sbert.net' },
      ],
    },
    {
      id: 'ai-engineer/rag',
      name: 'RAG',
      kind: 'tech',
      area: 'rag',
      x: 30,
      y: 36,
      weight: 3,
      summary: 'El RAG (generación aumentada por recuperación) es darle al modelo tus documentos relevantes para que responda con datos reales. Consiste en recuperar contexto y pasárselo al generar. Te capacita para construir asistentes que responden sobre TU información, no solo la que memorizaron.',
      prereqs: ['ai-engineer/embeddings', 'ai-engineer/context-engineering'],
      keyPoints: [
        'El patrón: recuperar lo relevante, montarlo en el contexto, generar con las fuentes a la vista.',
        'RAG existe por dos límites: el corte de conocimiento y el tamaño de la ventana de contexto.',
        'La calidad del RAG es la calidad de la recuperación: si recupera basura, genera basura elegante.',
        'Citas y atribución: el usuario debe poder verificar de qué documento salió la respuesta.',
        'Cuándo NO hace falta RAG: si el corpus cabe en contexto, no montes una catedral.',
      ],
      aiFocus:
        'RAG es el patrón fundacional de construir con IA: conectas el modelo a conocimiento que no tiene, con control y citas. La generación es la parte fácil; profundiza en el pipeline de recuperación — ahí se gana o se pierde, y ahí casi nunca mira quien viene de solo usar chats.',
      resources: [
        { kind: 'doc', label: 'Pinecone — learning center', url: 'https://www.pinecone.io/learn/' },
        { kind: 'post', label: 'Lilian Weng — Lil’Log', url: 'https://lilianweng.github.io' },
      ],
    },
    {
      id: 'ai-engineer/busqueda-hibrida',
      name: 'Chunking y búsqueda híbrida',
      kind: 'skill',
      area: 'rag',
      x: 18,
      y: 36,
      weight: 2,
      summary: 'El chunking y la búsqueda híbrida son partir bien los documentos y combinar búsqueda por palabras y por significado. Consiste en trocear con criterio y mezclar léxico y semántico. Te capacita para que tu RAG recupere lo correcto en vez de fragmentos inútiles.',
      prereqs: ['ai-engineer/rag'],
      keyPoints: [
        'El chunking decide el RAG: trozos con sentido (secciones, funciones), no cortes cada N caracteres.',
        'Híbrida: keyword (BM25) para términos exactos + vectores para significado; juntas rinden más.',
        'Reranking: recupera ancho y reordena fino con un segundo modelo.',
        'Metadatos y filtros: fecha, fuente y permisos filtran antes de buscar.',
        'Evalúa la recuperación por separado de la generación: cada etapa con su métrica.',
      ],
      aiFocus:
        'Aquí se separan los RAG de demo de los de producción: chunking, híbrida y reranking son decisiones de ingeniería con trade-offs medibles. Profundiza en evaluar cada etapa del pipeline por separado — «la respuesta es mala» casi siempre significa «la recuperación fue mala» y solo lo ves midiendo.',
      resources: [
        { kind: 'post', label: 'Eugene Yan — patrones de sistemas LLM', url: 'https://eugeneyan.com' },
        { kind: 'doc', label: 'Pinecone — learning center', url: 'https://www.pinecone.io/learn/' },
      ],
    },

    // ── Agentes y herramientas (centro-este) ────────────────────────────────
    {
      id: 'ai-engineer/tool-use',
      name: 'Tool use y function calling',
      kind: 'tech',
      area: 'agentes',
      x: 54,
      y: 66,
      weight: 3,
      summary: 'El tool use y function calling son dar al modelo herramientas (funciones, APIs) que puede invocar para actuar, no solo hablar. Consiste en describir las tools y ejecutar lo que pide. Te capacita para que la IA consulte datos reales y haga cosas, no solo genere texto.',
      prereqs: ['ai-engineer/apis-modelos', 'ai-engineer/salida-estructurada'],
      keyPoints: [
        'El modelo no ejecuta nada: pide una llamada con argumentos y TU código la ejecuta.',
        'Define herramientas como una API para un junior: nombre claro, descripción, esquema estricto.',
        'Valida los argumentos antes de ejecutar: vienen de un modelo, no de tu código.',
        'Devuelve errores útiles al modelo: con buen feedback, corrige y reintenta solo.',
        'Pocas herramientas bien descritas rinden más que un catálogo de treinta.',
      ],
      aiFocus:
        'Tool use es darle manos al modelo, y las manos las programas tú: cada herramienta es superficie de ataque y de fallo. Profundiza en el diseño del contrato (esquemas, validación, permisos por herramienta) — la diferencia entre un agente útil y uno peligroso está en lo que le dejaste tocar.',
      resources: [
        { kind: 'doc', label: 'Anthropic — documentación de la API', url: 'https://docs.anthropic.com' },
        { kind: 'doc', label: 'OpenAI — documentación de la API', url: 'https://platform.openai.com/docs' },
      ],
    },
    {
      id: 'ai-engineer/agentes',
      name: 'Agentes',
      kind: 'tech',
      area: 'agentes',
      x: 54,
      y: 56,
      weight: 3,
      summary: 'Los agentes son sistemas donde el modelo planifica, usa herramientas y decide pasos hacia un objetivo. Consiste en montar el bucle de razonar-actuar-observar con límites. Te capacita para construir asistentes que resuelven tareas de varios pasos, no una sola respuesta.',
      prereqs: ['ai-engineer/tool-use'],
      keyPoints: [
        'El bucle agéntico: el modelo decide, actúa con herramientas, observa el resultado y repite.',
        'Workflows vs agentes: si los pasos se conocen de antemano, un workflow es más barato y fiable.',
        'Límites siempre: presupuesto de pasos, timeout y puntos de aprobación humana.',
        'Los errores se acumulan por paso: un 95% de acierto por paso es un 60% a diez pasos.',
        'Trazabilidad total: cada decisión y llamada del agente queda registrada para depurar.',
      ],
      aiFocus:
        'Usar un agente (como tu asistente de código) y construir uno son mundos distintos: como constructor decides el bucle, las herramientas, los límites y los puntos de control humano. Profundiza en cuándo NO usar agentes — el criterio workflow-vs-agente es la decisión de arquitectura más rentable de esta comarca.',
      resources: [
        { kind: 'post', label: 'Anthropic — blog de ingeniería', url: 'https://www.anthropic.com/engineering' },
        { kind: 'post', label: 'Lilian Weng — Lil’Log', url: 'https://lilianweng.github.io' },
      ],
    },
    {
      id: 'ai-engineer/mcp',
      name: 'MCP y protocolos',
      kind: 'tech',
      area: 'agentes',
      x: 66,
      y: 56,
      weight: 2,
      summary: 'MCP y los protocolos son estándares para conectar modelos con herramientas y datos de forma interoperable. Consiste en exponer y consumir capacidades por un contrato común. Te capacita para integrar la IA con el mundo sin reinventar la conexión cada vez.',
      prereqs: ['ai-engineer/tool-use'],
      keyPoints: [
        'El problema: cada app integraba cada herramienta a mano; un protocolo estándar lo corta.',
        'MCP: servidores exponen tools y resources; cualquier cliente compatible los consume.',
        'Construye un servidor MCP sobre tu dominio: tus datos disponibles para cualquier asistente.',
        'Seguridad: un servidor MCP de terceros es código con acceso a tus datos — audítalo.',
        'Los protocolos evolucionan rápido: sigue la especificación, no el tutorial de hace un año.',
      ],
      aiFocus:
        'Como usuario conectas servidores MCP hechos por otros; como constructor publicas tu dominio como herramientas que cualquier agente puede usar. Profundiza en diseñar esa superficie — qué expones, con qué permisos, con qué descripciones — porque es la API de tu producto en la era de los agentes.',
      resources: [
        { kind: 'doc', label: 'Model Context Protocol', url: 'https://modelcontextprotocol.io' },
        { kind: 'doc', label: 'Anthropic — documentación de la API', url: 'https://docs.anthropic.com' },
      ],
    },
    {
      id: 'ai-engineer/orquestacion',
      name: 'Orquestación multiagente',
      kind: 'skill',
      area: 'agentes',
      x: 66,
      y: 66,
      weight: 1,
      summary: 'La orquestación multiagente es coordinar varios modelos o agentes especializados en un flujo. Consiste en repartir el trabajo, pasar contexto y juntar resultados. Te capacita para atacar problemas grandes que un solo prompt no resuelve bien.',
      prereqs: ['ai-engineer/agentes'],
      keyPoints: [
        'Patrones: orquestador-trabajadores, pipelines de especialistas, paralelización de subtareas.',
        'Cada agente extra multiplica coste, latencia y modos de fallo: justifícalo con datos.',
        'El contexto compartido es el problema duro: qué sabe cada agente y cómo se pasa.',
        'Empieza con un solo agente bien hecho; distribuye solo cuando se quede corto de verdad.',
      ],
      aiFocus:
        'La moda pide enjambres de agentes; la ingeniería pide justificar cada uno. Profundiza en los patrones de coordinación y sus costes reales — saber cuándo un solo modelo con buenas herramientas basta es criterio de constructor senior, no de demo de conferencia.',
      resources: [
        { kind: 'post', label: 'Latent Space — el oficio del AI engineer', url: 'https://www.latent.space' },
        { kind: 'post', label: 'Chip Huyen — ML y sistemas', url: 'https://huyenchip.com' },
      ],
    },

    // ── Evaluación y seguridad (este) ───────────────────────────────────────
    {
      id: 'ai-engineer/evals',
      name: 'Evals: medir, no vibes',
      kind: 'skill',
      area: 'calidad',
      x: 66,
      y: 46,
      weight: 3,
      summary: 'Los evals son medir la calidad de tu sistema de IA con datos en vez de con la sensación de que «va bien». Consiste en montar conjuntos de prueba y puntuar los cambios. Te capacita para mejorar tu producto de IA con rigor y no romperlo sin enterarte.',
      prereqs: ['ai-engineer/prompting'],
      keyPoints: [
        '«Parece que funciona» no es una métrica: sin evals no puedes cambiar nada con confianza.',
        'Empieza pequeño: 20-50 casos reales con salida esperada valen más que mil sintéticos.',
        'Tipos de check: exactos (código, regex), por criterio y LLM-as-judge — cada uno con su sesgo.',
        'Los evals corren en CI: cambiar el prompt o el modelo sin re-evaluar es desplegar a ciegas.',
        'Los fallos de producción alimentan el eval set: cada bug reportado es un caso nuevo.',
      ],
      aiFocus:
        'Esta es LA ciudad que separa usar de construir: el usuario juzga a ojo, el ingeniero mide. Sin evals, cada cambio de prompt o de modelo es una apuesta; con ellos, es ingeniería. Profundiza en construir tu conjunto de evaluación desde datos reales — es el activo más valioso de tu producto con IA.',
      resources: [
        { kind: 'post', label: 'Hamel Husain — evals en producción', url: 'https://hamel.dev' },
        { kind: 'doc', label: 'promptfoo — testing de LLMs', url: 'https://www.promptfoo.dev' },
        { kind: 'post', label: 'Eugene Yan — patrones de sistemas LLM', url: 'https://eugeneyan.com' },
      ],
    },
    {
      id: 'ai-engineer/observabilidad-llm',
      name: 'Observabilidad de LLMs',
      kind: 'tech',
      area: 'calidad',
      x: 78,
      y: 46,
      weight: 2,
      summary: 'La observabilidad de LLMs es ver qué hace tu sistema de IA en producción: prompts, respuestas, costes y fallos. Consiste en trazar y registrar cada llamada. Te capacita para diagnosticar por qué el modelo respondió mal a un usuario real, no en abstracto.',
      prereqs: ['ai-engineer/evals'],
      keyPoints: [
        'Traza cada petición: prompt completo, contexto, respuesta, tokens, latencia y coste.',
        'Feedback de usuarios (pulgar arriba/abajo, correcciones) enlazado a la traza que lo causó.',
        'Muestrea y revisa conversaciones reales cada semana: los fallos nuevos no salen en tus evals.',
        'Cuidado con lo que guardas: las trazas contienen datos de usuarios — retención y acceso con cabeza.',
        'De la traza al eval: los casos problemáticos de producción se convierten en tests.',
      ],
      aiFocus:
        'En software clásico logueas excepciones; aquí el fallo es una respuesta plausible y errónea que ningún try/catch atrapa. Profundiza en trazar todo y revisar muestras con ojos humanos — la observabilidad es cómo un producto con IA aprende de su propio uso.',
      resources: [
        { kind: 'doc', label: 'Langfuse — observabilidad LLM', url: 'https://langfuse.com' },
        { kind: 'doc', label: 'OpenTelemetry', url: 'https://opentelemetry.io' },
      ],
    },
    {
      id: 'ai-engineer/seguridad-ia',
      name: 'Seguridad de IA',
      kind: 'skill',
      area: 'calidad',
      x: 78,
      y: 56,
      weight: 3,
      summary: 'La seguridad de IA es defender tu sistema de inyección de prompts, fugas de datos y usos maliciosos. Consiste en no confiar en la entrada ni en la salida y poner límites. Te capacita para desplegar IA sin abrir un agujero por el que se cuele cualquiera.',
      prereqs: ['ai-engineer/tool-use'],
      keyPoints: [
        'Inyección de prompts: cualquier texto que el modelo lee (webs, docs, emails) puede darle órdenes.',
        'La trifecta letal: datos privados + contenido no confiable + capacidad de exfiltrar. Evita juntarlos.',
        'Los permisos de las herramientas son tu control real: el modelo no puede hacer lo que no le diste.',
        'PII: qué entra en los prompts, qué guardan las trazas, qué ve el proveedor del modelo.',
        'Red teaming propio: ataca tu sistema antes de que lo haga otro; OWASP LLM Top 10 como checklist.',
      ],
      aiFocus:
        'Como usuario, la inyección de prompts es una curiosidad; como constructor, es TU vulnerabilidad: tu agente leerá contenido hostil tarde o temprano. Profundiza en diseñar con la inyección asumida — permisos mínimos, aislar lo no confiable, aprobación humana para acciones sensibles. No hay parche definitivo, hay arquitectura.',
      resources: [
        { kind: 'doc', label: 'OWASP Top 10 para aplicaciones LLM', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
        { kind: 'post', label: 'Simon Willison — prompt injection', url: 'https://simonwillison.net' },
      ],
    },

    // ── Producto y producción (centro-norte) ────────────────────────────────
    {
      id: 'ai-engineer/coste-latencia',
      name: 'Coste y latencia',
      kind: 'skill',
      area: 'produccion',
      x: 54,
      y: 46,
      weight: 3,
      summary: 'El coste y la latencia son que tu producto de IA sea sostenible en dinero y rápido para el usuario. Consiste en elegir modelo, cachear, y recortar tokens con criterio. Te capacita para escalar un producto de IA sin arruinarte ni hacer esperar a la gente.',
      prereqs: ['ai-engineer/apis-modelos', 'ai-engineer/evals'],
      keyPoints: [
        'El coste escala con el uso: modela €/petición y €/usuario antes de lanzar, no después.',
        'Cascada de modelos: el pequeño para lo fácil, el grande solo cuando hace falta — con evals que lo avalen.',
        'Prompt caching y batching: los descuentos grandes están en cómo llamas, no en negociar precio.',
        'Latencia percibida: streaming y diseño de UX compran más paciencia que optimizar milisegundos.',
        'Presupuestos y alertas de gasto por feature: una feature con IA sin límite es un incidente financiero.',
      ],
      aiFocus:
        'Al usar IA pagas una suscripción; al construir, cada token es coste marginal tuyo y la factura crece con tu éxito. Profundiza en la economía unitaria (coste por petición vs valor por petición) — hay productos de IA técnicamente brillantes que pierden dinero en cada llamada.',
      resources: [
        { kind: 'doc', label: 'Artificial Analysis — comparativa de modelos', url: 'https://artificialanalysis.ai' },
        { kind: 'doc', label: 'Anthropic — documentación de la API', url: 'https://docs.anthropic.com' },
      ],
    },
    {
      id: 'ai-engineer/fine-tuning',
      name: 'Fine-tuning: cuándo sí y cuándo no',
      kind: 'skill',
      area: 'produccion',
      x: 42,
      y: 46,
      weight: 2,
      summary: 'El fine-tuning es entrenar un modelo con tus datos, y saber cuándo NO merece la pena frente a un buen prompt o RAG. Consiste en juzgar el coste-beneficio antes de lanzarte. Te capacita para elegir la herramienta correcta en vez de afinar por moda.',
      prereqs: ['ai-engineer/evals'],
      keyPoints: [
        'El orden correcto: prompting → few-shot → RAG → y solo si todo eso falla, fine-tuning.',
        'Sirve para forma y estilo (tono, formato, jerga); no para añadir conocimiento — eso es RAG.',
        'Exige datos: cientos o miles de ejemplos buenos; basura dentro, basura ajustada fuera.',
        'El coste oculto: cada modelo ajustado es un artefacto que mantener, re-evaluar y re-entrenar.',
        'Sin evals previos no hay fine-tuning: necesitas medir si mejoró algo.',
      ],
      aiFocus:
        'El fine-tuning es la respuesta refleja de quien viene de fuera («entrenamos nuestro modelo») y la última opción de quien construye. Profundiza en el árbol de decisión y en estimar el coste total — decir «no hace falta fine-tuning» con argumentos es una señal clásica de AI engineer con criterio.',
      resources: [
        { kind: 'doc', label: 'Hugging Face — documentación', url: 'https://huggingface.co/docs' },
        { kind: 'curso', label: 'DeepLearning.AI — cursos cortos', url: 'https://www.deeplearning.ai' },
      ],
    },
    {
      id: 'ai-engineer/ux-incertidumbre',
      name: 'Producto y UX con IA',
      kind: 'skill',
      area: 'produccion',
      x: 42,
      y: 36,
      weight: 2,
      summary: 'El producto y la UX con IA son diseñar para algo que a veces se equivoca: mostrar confianza, permitir corregir y no prometer magia. Consiste en abrazar la incertidumbre en la interfaz. Te capacita para construir productos de IA en los que la gente confía porque son honestos.',
      prereqs: ['ai-engineer/limites-modelos'],
      keyPoints: [
        'Diseña para el error: el modelo fallará en producción; el producto decide si el fallo es grave o trivial.',
        'Calibra la confianza del usuario: ni fe ciega ni desconfianza total — muestra fuentes y límites.',
        'Reversibilidad: las acciones de la IA se pueden deshacer, previsualizar o confirmar.',
        'Streaming, borradores y sugerencias: patrones de UX que convierten la incertidumbre en colaboración.',
        'No todo necesita IA: si un formulario lo resuelve mejor, el chatbot es un capricho caro.',
      ],
      aiFocus:
        'Construir con IA es diseñar la relación del usuario con un sistema que a veces se equivoca con total seguridad. Profundiza en los patrones de UX de incertidumbre (previsualizar, citar, deshacer, confirmar) — la confianza del usuario es el recurso más caro de recuperar cuando tu producto la quema.',
      resources: [
        { kind: 'doc', label: 'People + AI Guidebook (Google)', url: 'https://pair.withgoogle.com/guidebook/' },
        { kind: 'post', label: 'Nielsen Norman Group — IA y UX', url: 'https://www.nngroup.com' },
      ],
    },
    {
      id: 'ai-engineer/producto-ia-produccion',
      name: 'Producto con IA en producción',
      kind: 'milestone',
      area: 'produccion',
      x: 54,
      y: 36,
      weight: 3,
      summary: 'Un producto con IA en producción es el hito de tener algo real, evaluado, observado y sostenible en manos de usuarios. Consiste en juntar todo lo de la isla en un sistema fiable. Te capacita para demostrar que sabes llevar la IA de la demo al producto de verdad.',
      prereqs: ['ai-engineer/rag', 'ai-engineer/agentes', 'ai-engineer/seguridad-ia', 'ai-engineer/coste-latencia'],
      keyPoints: [
        'Integras todo: modelo + contexto + herramientas + evals + observabilidad + UX, con usuarios reales.',
        'El ciclo de mejora vive: producción alimenta evals, los evals validan cambios, los cambios se despliegan.',
        'Sabes decir que no: a los agentes innecesarios, al fine-tuning prematuro, a la feature de IA sin caso de uso.',
        'El stack cambia cada seis meses; tus fundamentos (tokens, contexto, evals, seguridad) no.',
      ],
      aiFocus:
        'Has cruzado la isla: ya no usas IA, la sirves a otros — con sus fallos gestionados, su coste modelado y su seguridad diseñada. Profundiza en mantener el criterio con el hype alrededor: los fundamentos de esta isla sobreviven a cada ola de herramientas nuevas, y tu valor es saber cuál ola surfear.',
      resources: [
        { kind: 'libro', label: 'AI Engineering (Chip Huyen)', format: 'papel' },
        { kind: 'post', label: 'Applied LLMs — lecciones de un año construyendo', url: 'https://applied-llms.org' },
        { kind: 'doc', label: 'roadmap.sh — AI Engineer', url: 'https://roadmap.sh/ai-engineer' },
      ],
    },
  ],
};
