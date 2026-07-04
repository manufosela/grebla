/**
 * Isla «Backend Python» (doc /careerMap/backend-python) — contenido curado
 * MC-16, oleada 2.
 *
 * Sigue la CONVENCIÓN DE CONTENIDO DE ISLAS descrita en la cabecera de
 * ./bases.js. Basada en roadmap.sh/python pero adaptada a la era IA: Python
 * es el lenguaje que más código generado recibe (scripts, servicios, data),
 * así que el mapa carga el peso en tipado, entornos reproducibles, testing y
 * la revisión de dependencias — donde más se alucina.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const BACKEND_PYTHON_ISLAND = {
  id: 'backend-python',
  name: 'Backend Python',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'python-idiomatico', name: 'Python idiomático' },
    { id: 'frameworks', name: 'Frameworks: FastAPI y Django' },
    { id: 'apis-datos', name: 'APIs y datos' },
    { id: 'async-rendimiento', name: 'Async y rendimiento' },
    { id: 'calidad', name: 'Calidad' },
    { id: 'python-ia', name: 'Python con IA' },
  ],
  cities: [
    // ── Python idiomático (sur, junto al puerto) ────────────────────────────
    {
      id: 'backend-python/python-moderno',
      name: 'Python moderno',
      kind: 'tech',
      area: 'python-idiomatico',
      x: 50,
      y: 74,
      weight: 3,
      prereqs: [],
      keyPoints: [
        'Domina el núcleo de verdad: iterables, dicts, funciones como valores, contextos (with) y el modelo de objetos.',
        'Pythonic significa legible: comprehensions con moderación, unpacking, enumerate/zip en vez de índices a mano.',
        'f-strings, pathlib y dataclasses: el estándar moderno para lo que antes eran tres librerías.',
        'Entiende mutabilidad y referencias: la mitad de los bugs de Python son una lista compartida sin querer.',
        'La librería estándar es enorme: revisa itertools, collections y functools antes de instalar nada.',
      ],
      aiFocus:
        'Python es probablemente el lenguaje que mejor escribe la IA — y eso sube el listón: tu diferencia ya no es la sintaxis. Profundiza en el modelo del lenguaje (referencias, mutabilidad, protocolo de iteración) para cazar los bugs sutiles que el código generado sí comete.',
      resources: [
        { kind: 'doc', label: 'Python — tutorial oficial en español', url: 'https://docs.python.org/es/3/tutorial/' },
        { kind: 'doc', label: 'roadmap.sh — Python', url: 'https://roadmap.sh/python' },
        { kind: 'libro', label: 'Fluent Python (Luciano Ramalho)', format: 'papel' },
      ],
    },
    {
      id: 'backend-python/entornos-uv',
      name: 'Entornos y uv',
      kind: 'tech',
      area: 'python-idiomatico',
      x: 38,
      y: 66,
      weight: 3,
      prereqs: ['backend-python/python-moderno'],
      keyPoints: [
        'Un entorno por proyecto, siempre: nada de instalar en el Python del sistema.',
        'uv como herramienta actual: entornos, dependencias, lockfile y versiones de Python en un solo binario rápido.',
        'pyproject.toml es el manifiesto del proyecto: dependencias, herramientas y metadatos en un sitio.',
        'Distingue dependencias directas de transitivas y congela con lockfile: reproducible o no existe.',
        'Entiende el legado (pip, venv, requirements.txt): lo encontrarás en todos los proyectos que heredes.',
      ],
      aiFocus:
        'El «en mi máquina funciona» de Python es legendario y la IA lo agrava sugiriendo pip installs sueltos que no quedan registrados. Profundiza en entornos reproducibles con uv y lockfile: es el suelo firme sobre el que todo lo generado se puede verificar y compartir.',
      resources: [
        { kind: 'doc', label: 'uv — documentación oficial (Astral)', url: 'https://docs.astral.sh/uv/' },
        { kind: 'doc', label: 'Python Packaging User Guide', url: 'https://packaging.python.org' },
      ],
    },
    {
      id: 'backend-python/tipado',
      name: 'Tipado con type hints',
      kind: 'tech',
      area: 'python-idiomatico',
      x: 62,
      y: 66,
      weight: 3,
      prereqs: ['backend-python/python-moderno'],
      keyPoints: [
        'Tipa las fronteras: firmas públicas, modelos de datos y respuestas — es donde los hints pagan.',
        'Aprende el vocabulario: Optional, Union con |, TypedDict, Protocol, genéricos.',
        'Un checker en el CI (mypy o pyright): los hints sin verificación son comentarios decorativos.',
        'Los tipos alimentan al ecosistema: FastAPI y Pydantic validan y documentan a partir de tus firmas.',
        'En Python los tipos no fuerzan nada en runtime: entiende qué garantiza el checker y qué no.',
      ],
      aiFocus:
        'Los hints son contexto de oro para la IA: con firmas tipadas genera código que encaja a la primera y el checker verifica lo generado sin gastar tu atención. Profundiza en modelar el dominio con tipos — cada Any que eliminas es una clase de bug que la máquina caza por ti.',
      resources: [
        { kind: 'doc', label: 'mypy — documentación oficial', url: 'https://mypy.readthedocs.io' },
        { kind: 'doc', label: 'Python — módulo typing', url: 'https://docs.python.org/es/3/library/typing.html' },
      ],
    },
    {
      id: 'backend-python/estructuras-idiomaticas',
      name: 'Datos y estructuras idiomáticas',
      kind: 'skill',
      area: 'python-idiomatico',
      x: 50,
      y: 58,
      weight: 2,
      prereqs: ['backend-python/python-moderno'],
      keyPoints: [
        'Elige el contenedor con criterio: dict para buscar, set para pertenencia, deque para colas, tuple para lo fijo.',
        'dataclasses (o Pydantic) en vez de dicts anónimos viajando por el código: estructura con nombre y tipos.',
        'Generadores para flujos grandes: procesa sin cargar todo en memoria.',
        'Domina las transformaciones diarias: agrupar, indexar, deduplicar, ordenar por clave.',
        'Enums para conjuntos cerrados de valores: los strings mágicos son bugs en incubación.',
      ],
      aiFocus:
        'La IA transforma datos en Python con una soltura brutal, pero arrastra el dict-de-dicts anónimo hasta que el código es ilegible. Profundiza en dar estructura (dataclasses, enums, generadores): exigir modelos con nombre al código generado es lo que lo mantiene mantenible.',
      resources: [
        { kind: 'doc', label: 'Python — collections y dataclasses', url: 'https://docs.python.org/es/3/library/collections.html' },
        { kind: 'libro', label: 'Effective Python (Brett Slatkin)', format: 'papel' },
      ],
    },
    {
      id: 'backend-python/errores-logging',
      name: 'Errores y logging',
      kind: 'skill',
      area: 'python-idiomatico',
      x: 70,
      y: 76,
      weight: 2,
      prereqs: ['backend-python/python-moderno'],
      keyPoints: [
        'Excepciones concretas: captura ValueError, no Exception; el except desnudo está prohibido.',
        'Jerarquía propia para tu dominio: errores que cuentan qué pasó y qué puede hacer quien llama.',
        'EAFP con cabeza: pedir perdón es pythonic, pero silenciar errores no lo es nunca.',
        'logging estructurado desde el día uno: niveles bien usados y contexto (ids, usuario) en cada línea.',
        'Lee tracebacks de abajo arriba y entérate de raise ... from: la causa encadenada es información.',
      ],
      aiFocus:
        'El try/except Exception: pass es el antipatrón favorito del código generado: convierte errores en misterios. Profundiza en la estrategia de errores de tu servicio — qué revienta, qué se registra, qué se traduce al cliente — y revisa cada except generado contra ella.',
      resources: [
        { kind: 'doc', label: 'Python — tutorial de errores y excepciones', url: 'https://docs.python.org/es/3/tutorial/errors.html' },
        { kind: 'doc', label: 'Python — HOWTO de logging', url: 'https://docs.python.org/es/3/howto/logging.html' },
      ],
    },

    // ── Frameworks: FastAPI y Django (oeste) ────────────────────────────────
    {
      id: 'backend-python/fastapi',
      name: 'FastAPI',
      kind: 'tech',
      area: 'frameworks',
      x: 28,
      y: 74,
      weight: 3,
      prereqs: ['backend-python/tipado', 'backend-python/entornos-uv'],
      keyPoints: [
        'El framework donde los tipos trabajan: validación, serialización y docs OpenAPI salen de tus firmas.',
        'Inyección de dependencias con Depends: sesión de BD, usuario actual y config testeables por diseño.',
        'Entiende sync vs async en los endpoints: mezclar mal bloquea el event loop entero.',
        'Routers para organizar por dominio: una app plana de 50 endpoints no escala mentalmente.',
        'La documentación automática (/docs) es tu contrato vivo: cuídala como parte de la API.',
      ],
      aiFocus:
        'FastAPI es el framework que la IA mejor genera: tipos + convención clara = endpoints correctos a la primera. Tu trabajo sube de nivel: diseño del contrato, dependencias bien cortadas y decidir qué es async de verdad. Profundiza ahí — el CRUD ya no es mérito de nadie.',
      resources: [
        { kind: 'doc', label: 'FastAPI — documentación oficial en español', url: 'https://fastapi.tiangolo.com/es/' },
        { kind: 'doc', label: 'Starlette — la base ASGI de FastAPI', url: 'https://www.starlette.io' },
      ],
    },
    {
      id: 'backend-python/django',
      name: 'Django',
      kind: 'tech',
      area: 'frameworks',
      x: 16,
      y: 64,
      weight: 2,
      prereqs: ['backend-python/entornos-uv'],
      keyPoints: [
        'El monolito con pilas incluidas: ORM, admin, auth, migraciones y templates resueltos y cohesionados.',
        'El admin es su superpoder: un back-office funcional gratis que a medida costaría meses.',
        'Apps de Django como módulos de dominio: la estructura importa más que en micro-frameworks.',
        'Django REST Framework (o Django Ninja) cuando el monolito expone API.',
        'Elige con criterio frente a FastAPI: producto con muchas piezas estándar vs servicio API-first.',
      ],
      aiFocus:
        'La IA conoce Django al milímetro, incluidas sus mil convenciones — pero mezcla versiones y estilos de distintas épocas del framework. Profundiza en la arquitectura (apps, señales con moderación, dónde vive la lógica) y contrasta lo generado con la doc de TU versión.',
      resources: [
        { kind: 'doc', label: 'Django — documentación oficial en español', url: 'https://docs.djangoproject.com/es/' },
        { kind: 'doc', label: 'Django REST Framework', url: 'https://www.django-rest-framework.org' },
        { kind: 'libro', label: 'Two Scoops of Django (Feldroy)', format: 'papel' },
      ],
    },
    {
      id: 'backend-python/pydantic',
      name: 'Pydantic y validación',
      kind: 'tech',
      area: 'frameworks',
      x: 20,
      y: 48,
      weight: 2,
      prereqs: ['backend-python/tipado'],
      keyPoints: [
        'Modelos Pydantic en las fronteras: lo que entra del exterior se parsea y valida, no se confía.',
        'Parse, don\'t validate: tras el modelo, el dato ya tiene la forma garantizada en todo el código.',
        'Separa modelos de entrada, de salida y de dominio: reutilizar uno para todo acaba filtrando campos.',
        'Settings tipados con pydantic-settings: la config también es entrada que se valida.',
        'Validadores propios para reglas de negocio simples; lo complejo vive en el dominio.',
      ],
      aiFocus:
        'La IA genera modelos Pydantic correctos si le das ejemplos del payload real. El diseño de fronteras — qué modelo para entrada, salida y dominio, qué campos expones — es la decisión de arquitectura que te toca a ti. Profundiza en esa separación: es lo que evita fugas de datos por la API.',
      resources: [
        { kind: 'doc', label: 'Pydantic — documentación oficial', url: 'https://docs.pydantic.dev' },
        { kind: 'post', label: 'Parse, don\'t validate (Alexis King)', url: 'https://lexi-lambda.github.io' },
      ],
    },

    // ── APIs y datos (centro-norte) ─────────────────────────────────────────
    {
      id: 'backend-python/api-rest',
      name: 'APIs REST en Python',
      kind: 'tech',
      area: 'apis-datos',
      x: 30,
      y: 40,
      weight: 3,
      prereqs: ['backend-python/fastapi'],
      keyPoints: [
        'Diseña el contrato antes que el código: recursos, verbos, códigos de estado y errores consistentes.',
        'Los errores también son API: formato uniforme, mensajes útiles y nunca una traza al cliente.',
        'Paginación, filtrado y ordenación desde el primer día en toda colección.',
        'Versiona o evoluciona con compatibilidad: cada campo publicado es una promesa.',
        'Middleware para lo transversal: auth, CORS, rate limiting, request id — no en cada endpoint.',
      ],
      aiFocus:
        'La IA implementa endpoints impecables a partir de un buen contrato — y contratos mediocres a partir de una frase vaga. Profundiza en diseño de APIs: tu spec es a la vez la decisión de producto, la documentación y el mejor prompt. Lo que definas mal, lo generará mal en cadena.',
      resources: [
        { kind: 'doc', label: 'roadmap.sh — API Design', url: 'https://roadmap.sh/api-design' },
        { kind: 'doc', label: 'OpenAPI — la especificación', url: 'https://www.openapis.org' },
      ],
    },
    {
      id: 'backend-python/orm-sqlalchemy',
      name: 'SQLAlchemy y el ORM',
      kind: 'tech',
      area: 'apis-datos',
      x: 6,
      y: 54,
      weight: 3,
      prereqs: ['backend-python/fastapi'],
      keyPoints: [
        'SQLAlchemy 2.x moderno: modelos declarativos tipados, select() y sesiones con contexto claro.',
        'Entiende la unidad de trabajo: qué vive en la sesión, cuándo se hace flush y quién hace commit.',
        'El N+1 también vive aquí: selectinload/joinedload y mirar las queries reales con echo.',
        'Migraciones con Alembic: pequeñas, reversibles y revisadas línea a línea.',
        'SQL directo sin complejos para reporting y consultas complejas: el ORM es herramienta, no religión.',
      ],
      aiFocus:
        'La IA genera modelos y queries de SQLAlchemy correctos en apariencia, pero mezcla la API 1.x con la 2.x y esconde N+1 en cada relación. Profundiza en ver el SQL emitido de verdad: activa el echo, lee las queries y juzga — el ORM generado se audita, no se presume.',
      resources: [
        { kind: 'doc', label: 'SQLAlchemy — documentación oficial', url: 'https://www.sqlalchemy.org' },
        { kind: 'doc', label: 'Alembic — migraciones', url: 'https://alembic.sqlalchemy.org' },
      ],
    },
    {
      id: 'backend-python/autenticacion',
      name: 'Autenticación y permisos',
      kind: 'skill',
      area: 'apis-datos',
      x: 42,
      y: 36,
      weight: 3,
      prereqs: ['backend-python/api-rest'],
      keyPoints: [
        'Authn y authz son dos problemas: identidad (tokens, OAuth2/OIDC) y permisos (roles, ownership).',
        'JWT con sus letras pequeñas: expiración corta, firma verificada, revocación pensada de antemano.',
        'Contraseñas solo con hash lento (argon2/bcrypt) — y mejor aún, delega en un proveedor de identidad.',
        'Autoriza recurso a recurso: estar logueado no da derecho a tocar el registro de otro.',
        'Los permisos se testean: cada regla de acceso con su test de «con este rol NO se puede».',
      ],
      aiFocus:
        'El agujero clásico del código generado: comprueba el token y olvida el ownership — cambia el id de la URL y ves los datos de otro. Profundiza en modelar permisos y en atacar tu propia API: la revisión de seguridad de lo generado es responsabilidad indelegable.',
      resources: [
        { kind: 'doc', label: 'FastAPI — seguridad y OAuth2', url: 'https://fastapi.tiangolo.com/es/tutorial/security/' },
        { kind: 'doc', label: 'OWASP — Authorization Cheat Sheet', url: 'https://cheatsheetseries.owasp.org' },
      ],
    },
    {
      id: 'backend-python/tareas-background',
      name: 'Tareas en segundo plano',
      kind: 'tech',
      area: 'apis-datos',
      x: 36,
      y: 20,
      weight: 1,
      prereqs: ['backend-python/api-rest'],
      keyPoints: [
        'Saca del request lo lento: correos, informes, procesado de ficheros, llamadas a terceros.',
        'Escala de herramienta según necesidad: BackgroundTasks → colas con worker (Celery, arq, Dramatiq).',
        'Tareas idempotentes y con reintentos: se ejecutarán dos veces; que no duela.',
        'Observa tus colas: profundidad, fallos y tiempos son las métricas que avisan antes del incidente.',
      ],
      aiFocus:
        'La IA mueve código a un worker en un momento, pero la semántica de fallo (idempotencia, orden, reintento con backoff) no viene incluida. Profundiza en diseñar tareas re-ejecutables sin daño: es la pregunta que debes hacerle a cada tarea generada antes de desplegarla.',
      resources: [
        { kind: 'doc', label: 'Celery — documentación oficial', url: 'https://docs.celeryq.dev' },
        { kind: 'doc', label: 'FastAPI — background tasks', url: 'https://fastapi.tiangolo.com/es/tutorial/background-tasks/' },
      ],
    },
    {
      id: 'backend-python/openapi-contratos',
      name: 'OpenAPI y contratos',
      kind: 'skill',
      area: 'apis-datos',
      x: 50,
      y: 28,
      weight: 2,
      prereqs: ['backend-python/api-rest'],
      keyPoints: [
        'El spec OpenAPI es el contrato: consumidores, SDKs generados y tests se cuelgan de él.',
        'En FastAPI el spec sale del código: cuida ejemplos, descripciones y modelos de error — son la doc real.',
        'Genera clientes desde el spec en vez de escribirlos a mano: menos deriva entre API y consumidor.',
        'Detecta breaking changes en CI comparando specs: renombrar un campo rompe a alguien.',
      ],
      aiFocus:
        'Un spec OpenAPI rico es el mejor contexto que puedes darle a la IA: genera clientes, tests y mocks coherentes con tu API real. Profundiza en mantener el contrato como fuente de verdad — la deriva silenciosa entre doc y comportamiento es lo que la IA no puede detectar por ti.',
      resources: [
        { kind: 'doc', label: 'OpenAPI Initiative', url: 'https://www.openapis.org' },
        { kind: 'doc', label: 'FastAPI — metadatos y docs de la API', url: 'https://fastapi.tiangolo.com/es/tutorial/metadata/' },
      ],
    },
    {
      id: 'backend-python/servicio-produccion',
      name: 'Servicio en producción',
      kind: 'milestone',
      area: 'apis-datos',
      x: 52,
      y: 12,
      weight: 3,
      prereqs: [
        'backend-python/api-rest',
        'backend-python/autenticacion',
        'backend-python/pytest',
      ],
      keyPoints: [
        'Cierra el ciclo: un servicio Python real desplegado, con auth, tests, tipos verificados y contrato documentado.',
        'Corre sobre entorno reproducible: lockfile, misma versión de Python, config validada al arrancar.',
        'Observable: logs con contexto, errores agregados y un healthcheck honesto.',
        'Aguanta lo real: datos sucios, clientes lentos, reintentos — no solo el happy path de la demo.',
      ],
      aiFocus:
        'La IA te lleva del cero al servicio funcional en horas; este milestone mide el resto: seguridad revisada, entorno reproducible, comportamiento observado en producción. Profundiza en ese último tramo — es la parte que se verifica con criterio, no se genera con prompts.',
      resources: [
        { kind: 'doc', label: 'FastAPI — despliegue', url: 'https://fastapi.tiangolo.com/es/deployment/' },
        { kind: 'doc', label: 'The Twelve-Factor App — en español', url: 'https://12factor.net/es/' },
      ],
    },

    // ── Async y rendimiento (noreste) ───────────────────────────────────────
    {
      id: 'backend-python/asyncio',
      name: 'Async en Python',
      kind: 'tech',
      area: 'async-rendimiento',
      x: 62,
      y: 36,
      weight: 2,
      prereqs: ['backend-python/python-moderno'],
      keyPoints: [
        'Async sirve para esperar mejor (IO concurrente), no para calcular más rápido: entiende cuándo aplica.',
        'El event loop es cooperativo: una llamada bloqueante (requests, time.sleep) congela TODO el servicio.',
        'async/await de punta a punta: librerías async (httpx, drivers async) o ejecutor para lo síncrono.',
        'Lanza trabajo concurrente con gather/TaskGroup y pon timeouts a todo lo que salga por la red.',
        'Para CPU intensivo: procesos (o dejar que lo haga la cola), no asyncio.',
      ],
      aiFocus:
        'El bug async favorito del código generado: una llamada síncrona dentro de un endpoint async que bloquea el loop y tumba la latencia de todo el servicio. Profundiza en el modelo del event loop — es invisible en la lectura superficial y letal en producción.',
      resources: [
        { kind: 'doc', label: 'Python — documentación de asyncio', url: 'https://docs.python.org/es/3/library/asyncio.html' },
        { kind: 'doc', label: 'HTTPX — cliente HTTP async', url: 'https://www.python-httpx.org' },
      ],
    },
    {
      id: 'backend-python/rendimiento-perfilado',
      name: 'Rendimiento y perfilado',
      kind: 'skill',
      area: 'async-rendimiento',
      x: 66,
      y: 22,
      weight: 2,
      prereqs: ['backend-python/estructuras-idiomaticas'],
      keyPoints: [
        'Mide antes de opinar: cProfile, py-spy o el timing del propio servicio dicen dónde se va el tiempo.',
        'En un backend típico el coste está en IO (BD, red): las micro-optimizaciones de Python rara vez importan.',
        'Elige la estructura adecuada antes que optimizar la inadecuada: set vs lista es un ×1000 gratis.',
        'Cachea con estrategia e invalidez pensada; una cache sin plan es un bug de consistencia diferido.',
        'Conoce el techo (GIL) y las salidas: procesos, numpy, o mover lo caliente fuera de Python.',
      ],
      aiFocus:
        'Pide «optimiza esto» sin datos y la IA reescribirá lo que no era lento. Con un perfil real delante, en cambio, propone fixes excelentes. Profundiza en perfilar y en leer los números: tu papel es el diagnóstico; el tratamiento se puede delegar y verificar.',
      resources: [
        { kind: 'doc', label: 'Python — perfiladores (cProfile)', url: 'https://docs.python.org/es/3/library/profile.html' },
        { kind: 'doc', label: 'py-spy — profiler de muestreo', url: 'https://github.com/benfred/py-spy' },
      ],
    },

    // ── Calidad (noroeste) ──────────────────────────────────────────────────
    {
      id: 'backend-python/pytest',
      name: 'pytest',
      kind: 'skill',
      area: 'calidad',
      x: 22,
      y: 28,
      weight: 3,
      prereqs: ['backend-python/estructuras-idiomaticas'],
      keyPoints: [
        'pytest idiomático: asserts planos, fixtures para el contexto y parametrize para las variantes.',
        'Fixtures bien cortadas: pequeñas, componibles y con el scope justo — son la arquitectura de tu suite.',
        'Testea la API por fuera (TestClient/httpx): máxima cobertura de comportamiento por test escrito.',
        'Dobles solo en las fronteras (red, terceros): mockear tu propio código es esconder el diseño malo.',
        'Los tests corren rápido o no corren: suite lenta es suite ignorada.',
      ],
      aiFocus:
        'La IA genera tests pytest a espuertas — incluidos los que asertan lo que el código hace, bugs incluidos. Define tú los casos (bordes, permisos, errores) y deja el andamiaje al modelo. Profundiza en diseñar fixtures: es lo que separa una suite mantenible de un pantano.',
      resources: [
        { kind: 'doc', label: 'pytest — documentación oficial', url: 'https://docs.pytest.org' },
        { kind: 'curso', label: 'Real Python — testing con pytest', url: 'https://realpython.com' },
      ],
    },
    {
      id: 'backend-python/ruff-linting',
      name: 'Ruff y estilo automatizado',
      kind: 'tech',
      area: 'calidad',
      x: 6,
      y: 36,
      weight: 2,
      prereqs: ['backend-python/entornos-uv'],
      keyPoints: [
        'Ruff como linter y formateador: cientos de reglas, un binario, milisegundos.',
        'El estilo no se discute en review: se configura una vez y lo aplica la máquina.',
        'Activa las reglas que cazan bugs (no solo estética): imports rotos, variables sin usar, comparaciones sospechosas.',
        'pre-commit + CI: nada entra sin pasar el filtro, ni tuyo ni generado.',
      ],
      aiFocus:
        'Linter y formateador son tu primera línea de revisión de código generado: gratis, instantánea y sin fatiga. Profundiza en elegir el conjunto de reglas de tu proyecto — cada regla automática es un tipo de defecto que ya nunca gastará atención humana en el review.',
      resources: [
        { kind: 'doc', label: 'Ruff — documentación oficial (Astral)', url: 'https://docs.astral.sh/ruff/' },
        { kind: 'doc', label: 'pre-commit — hooks de calidad', url: 'https://pre-commit.com' },
      ],
    },
    {
      id: 'backend-python/depuracion-python',
      name: 'Depuración en Python',
      kind: 'skill',
      area: 'calidad',
      x: 10,
      y: 20,
      weight: 2,
      prereqs: ['backend-python/errores-logging'],
      keyPoints: [
        'breakpoint() y el debugger del editor: inspeccionar el estado real gana a adivinar con prints.',
        'Lee el traceback completo y de abajo arriba: el error de verdad suele ser el último «raise from».',
        'Reproduce en pequeño: convierte el bug en un test que falla antes de arreglarlo.',
        'pdb postmortem y logs con contexto para lo que solo pasa en producción.',
      ],
      aiFocus:
        'Pega a la IA el traceback COMPLETO con el código relevante y acierta la causa la mayoría de las veces; dale «no funciona» y alucinará una. Profundiza en acotar y reproducir: fabricar el caso mínimo que falla es la habilidad que multiplica a la IA como compañera de depuración.',
      resources: [
        { kind: 'doc', label: 'Python — pdb, el depurador', url: 'https://docs.python.org/es/3/library/pdb.html' },
        { kind: 'post', label: 'Julia Evans — zines sobre depuración', url: 'https://jvns.ca' },
      ],
    },

    // ── Python con IA (norte) ───────────────────────────────────────────────
    {
      id: 'backend-python/scripting-ia',
      name: 'Scripting acelerado con IA',
      kind: 'skill',
      area: 'python-ia',
      x: 18,
      y: 10,
      weight: 2,
      prereqs: ['backend-python/python-moderno'],
      keyPoints: [
        'Python es el lenguaje pegamento: automatiza ficheros, APIs, datos y tareas de oficina con scripts generados.',
        'Da contexto concreto: muestra de los datos reales, formato de salida esperado y casos raros conocidos.',
        'Ejecuta sobre una COPIA y verifica el resultado con muestreo: un script generado que borra o sobreescribe no tiene undo.',
        'Scripts de usar y tirar, sí; pero el que sobrevive una semana gana tipos, tests y un nombre digno.',
        'Aprende de cada script generado: léelo entero, es formación gratuita en la librería estándar.',
      ],
      aiFocus:
        'La automatización personal es el retorno más inmediato de la IA: tareas de horas en minutos de prompt. El riesgo es ejecutar sin leer — un os.remove mal puesto no pide confirmación. Profundiza en el hábito de leer, acotar con dry-run y verificar antes de soltar el script sobre datos reales.',
      resources: [
        { kind: 'libro', label: 'Automate the Boring Stuff with Python (Al Sweigart)', url: 'https://automatetheboringstuff.com', format: 'online' },
        { kind: 'post', label: 'Simon Willison — automatizar con LLMs', url: 'https://simonwillison.net' },
      ],
    },
    {
      id: 'backend-python/dependencias-verificadas',
      name: 'Dependencias alucinadas',
      kind: 'skill',
      area: 'python-ia',
      x: 34,
      y: 6,
      weight: 3,
      prereqs: ['backend-python/scripting-ia', 'backend-python/entornos-uv'],
      keyPoints: [
        'La IA inventa paquetes con nombres plausibles: verifica en PyPI que existen ANTES de instalar.',
        'El slopsquatting es real: atacantes registran los nombres que los modelos alucinan; el typo instala malware.',
        'Comprueba salud además de existencia: mantenimiento, descargas, issues — y si la stdlib ya lo hace.',
        'También alucina APIs de paquetes reales: métodos y parámetros de versiones que no existen; contrasta con la doc.',
        'Instala siempre vía manifiesto (uv add) y no pip suelto: lo que no está en el lockfile no pasó revisión.',
      ],
      aiFocus:
        'Python es el ecosistema donde más dependencias alucina la IA, y la instalación es el único paso sin vuelta atrás barata: código malicioso ejecuta en el install. Profundiza en el reflejo de verificar paquete y API contra PyPI y la doc oficial — treinta segundos que evitan el peor incidente.',
      resources: [
        { kind: 'doc', label: 'PyPI — verifica aquí cada paquete', url: 'https://pypi.org' },
        { kind: 'doc', label: 'OWASP — Top 10 para aplicaciones LLM', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
      ],
    },
  ],
};
