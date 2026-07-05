/**
 * Isla «Backend PHP» (doc /careerMap/backend-php) — contenido curado MC-16,
 * oleada 2.
 *
 * Sigue la CONVENCIÓN DE CONTENIDO DE ISLAS descrita en la cabecera de
 * ./bases.js. Basada en roadmap.sh/php pero adaptada a la era IA: el PHP que
 * merece la pena hoy es el moderno (8.x, tipos, composer, framework), y el
 * músculo diferencial es revisar código y migraciones generadas — incluida la
 * modernización de la enorme base de PHP legacy que existe en el mundo.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const BACKEND_PHP_ISLAND = {
  id: 'backend-php',
  name: 'Backend PHP',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'php-moderno', name: 'PHP moderno' },
    { id: 'framework', name: 'Framework: Laravel y Symfony' },
    { id: 'apis-datos', name: 'APIs y datos' },
    { id: 'calidad', name: 'Calidad y análisis' },
    { id: 'despliegue', name: 'Despliegue y operación' },
    { id: 'php-ia', name: 'PHP con IA' },
  ],
  cities: [
    // ── PHP moderno (sur, junto al puerto) ──────────────────────────────────
    {
      id: 'backend-php/php-8',
      name: 'PHP 8.x moderno',
      kind: 'tech',
      area: 'php-moderno',
      x: 50,
      y: 74,
      weight: 3,
      summary: 'PHP 8.x moderno es el lenguaje que mueve gran parte de la web, con tipado, atributos y rendimiento muy lejos del PHP de hace años. Consiste en escribir PHP actual y limpio, no el de foros antiguos. Te capacita para construir backends sólidos sobre la base más extendida del sector.',
      prereqs: [],
      keyPoints: [
        'El PHP de hoy no es el de 2010: tipa todo (parámetros, retornos, propiedades) y activa strict_types.',
        'Domina lo nuevo de 8.x: enums, readonly, promoción de propiedades en constructor, match, named arguments.',
        'Null con criterio: nullable types, operador ?-> y nada de comprobar con empty() a ciegas.',
        'Arrays y colecciones con soltura: array functions, generadores y cuándo pasar a objetos de valor.',
        'Conoce el ciclo petición-respuesta de PHP: cada request nace y muere — es su modelo, no un defecto.',
      ],
      aiFocus:
        'La IA entrenó con veinte años de PHP y por defecto mezcla épocas: te puede colar mysql_query o arrays sin tipos junto a enums de 8.3. Profundiza en el PHP moderno para reconocer y rechazar los idioms fósiles en el código generado — tu vara de medir es la versión que corre en producción.',
      resources: [
        { kind: 'doc', label: 'PHP — manual oficial en español', url: 'https://www.php.net/manual/es/' },
        { kind: 'doc', label: 'PHP The Right Way', url: 'https://phptherightway.com' },
        { kind: 'doc', label: 'roadmap.sh — PHP', url: 'https://roadmap.sh/php' },
      ],
    },
    {
      id: 'backend-php/composer',
      name: 'Composer y ecosistema',
      kind: 'tech',
      area: 'php-moderno',
      x: 38,
      y: 66,
      weight: 3,
      summary: 'Composer es el gestor de dependencias de PHP: trae librerías, gestiona versiones y organiza el autoload. Consiste en declarar lo que necesitas y dejar que el ecosistema haga el resto. Te capacita para apoyarte en el enorme catálogo de paquetes sin montártelo a mano.',
      prereqs: ['backend-php/php-8'],
      keyPoints: [
        'composer.json a fondo: require vs require-dev, versionado semántico, scripts y el papel del lockfile.',
        'Autoloading PSR-4: de la estructura de carpetas al namespace sin ningún require manual.',
        'Evalúa paquetes antes de instalar: mantenimiento, descargas, issues abiertas y si el framework ya lo trae.',
        'Actualiza con proceso: composer outdated, leer changelogs y subir de major con tests en verde.',
        'Packagist es tu registro; audita dependencias (composer audit) como parte del flujo.',
      ],
      aiFocus:
        'La IA sugiere paquetes que a veces no existen o llevan años sin mantenerse — verifica en Packagist cada dependencia sugerida antes de instalar. Profundiza en evaluar y auditar dependencias: en backend, un paquete comprometido es una brecha de seguridad directa.',
      resources: [
        { kind: 'doc', label: 'Composer — documentación oficial', url: 'https://getcomposer.org' },
        { kind: 'doc', label: 'Packagist — el registro de paquetes PHP', url: 'https://packagist.org' },
      ],
    },
    {
      id: 'backend-php/poo-php',
      name: 'POO y diseño en PHP',
      kind: 'skill',
      area: 'php-moderno',
      x: 62,
      y: 66,
      weight: 3,
      summary: 'La POO y el diseño en PHP es estructurar el código en objetos con responsabilidades claras. Consiste en clases, interfaces, composición y los principios que evitan el spaghetti. Te capacita para construir aplicaciones que crecen sin volverse imposibles de tocar.',
      prereqs: ['backend-php/php-8'],
      keyPoints: [
        'Clases con una responsabilidad: interfaces para contratos, composición antes que herencia.',
        'Objetos de valor y DTOs tipados en vez de arrays asociativos viajando por toda la app.',
        'Inmutabilidad donde puedas: readonly y withers hacen el código predecible.',
        'Excepciones propias del dominio en vez de códigos de error o false silenciosos.',
        'SOLID como brújula, no como religión: la abstracción prematura también es deuda.',
      ],
      aiFocus:
        'La IA genera clases correctas pero con tendencia a dos extremos: el array asociativo gigante o la sobreingeniería de interfaces para todo. Profundiza en diseño orientado a objetos pragmático — decidir el nivel de abstracción justo para TU dominio es criterio que el modelo no tiene.',
      resources: [
        { kind: 'post', label: 'stitcher.io — PHP moderno y diseño (Brent Roose)', url: 'https://stitcher.io' },
        { kind: 'libro', label: 'Principles of Package Design (Matthias Noback)', format: 'papel' },
        { kind: 'doc', label: 'Refactoring Guru — patrones en español', url: 'https://refactoring.guru/es' },
      ],
    },
    {
      id: 'backend-php/estandares-psr',
      name: 'Estándares PSR',
      kind: 'tech',
      area: 'php-moderno',
      x: 50,
      y: 58,
      weight: 2,
      summary: 'Los estándares PSR son las convenciones que hacen que todo el PHP moderno hable el mismo idioma: estilo, autoload, interfaces comunes. Consiste en seguirlos para que tu código encaje con el ecosistema. Te capacita para trabajar en cualquier proyecto sin fricciones de formato.',
      prereqs: ['backend-php/composer'],
      keyPoints: [
        'Conoce los PSR que usarás a diario: PSR-4 (autoload), PSR-12 (estilo), PSR-7/15 (HTTP), PSR-3 (logging).',
        'El estilo se automatiza, no se discute: PHP-CS-Fixer o Pint en el pipeline y a otra cosa.',
        'Los PSR de HTTP explican cómo interoperan frameworks y middleware: entiéndelos aunque uses Laravel.',
        'Interfaces estándar (logger, cache, container) te permiten cambiar de implementación sin reescribir.',
      ],
      aiFocus:
        'La IA formatea y adapta código a cualquier PSR al instante: no gastes memoria en reglas de estilo. Profundiza en el PORQUÉ de los estándares — interoperabilidad entre paquetes y frameworks — para juzgar cuándo un código generado se acopla a algo que debería ser una interfaz.',
      resources: [
        { kind: 'doc', label: 'PHP-FIG — los estándares PSR', url: 'https://www.php-fig.org' },
        { kind: 'doc', label: 'Laravel Pint — estilo automatizado', url: 'https://laravel.com/docs/pint' },
      ],
    },
    {
      id: 'backend-php/errores-excepciones',
      name: 'Errores y excepciones',
      kind: 'skill',
      area: 'php-moderno',
      x: 70,
      y: 76,
      weight: 2,
      summary: 'Manejar errores y excepciones es controlar qué pasa cuando algo sale mal en vez de que el programa reviente. Consiste en lanzar, capturar y decidir dónde se recupera cada fallo. Te capacita para construir servicios que fallan con elegancia y dan mensajes útiles.',
      prereqs: ['backend-php/php-8'],
      keyPoints: [
        'Excepciones para lo excepcional: lanza pronto, captura donde puedas hacer algo útil.',
        'Jerarquía propia: una excepción base del dominio y tipos específicos que cuentan qué pasó.',
        'Nunca un catch vacío: o lo resuelves, o lo registras y relanzas — el silencio es el peor bug.',
        'Errores al usuario con mensaje digno y al log con todo el detalle: son dos audiencias distintas.',
        'Configura display_errors apagado en producción y un handler global que capture lo no previsto.',
      ],
      aiFocus:
        'El código generado abusa del try/catch decorativo: captura Exception genérica, hace log y sigue como si nada. Profundiza en diseñar la estrategia de errores de tu aplicación — qué es recuperable, qué debe reventar y qué debe alertar — y exige que cada catch generado la respete.',
      resources: [
        { kind: 'doc', label: 'PHP — manual de excepciones', url: 'https://www.php.net/manual/es/language.exceptions.php' },
        { kind: 'post', label: 'stitcher.io — manejo de errores en PHP moderno', url: 'https://stitcher.io' },
      ],
    },

    // ── Framework: Laravel y Symfony (oeste) ────────────────────────────────
    {
      id: 'backend-php/laravel',
      name: 'Laravel',
      kind: 'tech',
      area: 'framework',
      x: 28,
      y: 74,
      weight: 3,
      summary: 'Laravel es el framework PHP más popular: routing, ORM, colas, autenticación y todo lo demás con baterías incluidas. Consiste en aprovechar sus convenciones para ir rápido sin reinventar. Te capacita para construir aplicaciones completas con el stack que más se pide en PHP.',
      prereqs: ['backend-php/poo-php', 'backend-php/composer'],
      keyPoints: [
        'Domina el ciclo de vida: de la petición al response pasando por rutas, middleware y controladores.',
        'Aprovecha lo que trae: auth, validación, colas, cache, scheduler — no reinventes lo resuelto.',
        'Artisan y el tinker como herramientas diarias: generar, inspeccionar, probar hipótesis.',
        'Convención sobre configuración: pelear contra el framework sale carísimo; entiende su manera antes de desviarte.',
        'Config por entorno con .env: nada de credenciales en el código ni en git.',
      ],
      aiFocus:
        'La IA conoce Laravel al detalle y genera CRUDs completos en minutos — a veces con la API de una versión anterior. Contrasta con la doc de TU versión y profundiza en el ciclo de vida del framework: es lo que te deja depurar cuando la magia generada no hace lo que aparenta.',
      resources: [
        { kind: 'doc', label: 'Laravel — documentación oficial', url: 'https://laravel.com/docs' },
        { kind: 'curso', label: 'Laracasts — el curso de referencia', url: 'https://laracasts.com' },
        { kind: 'libro', label: 'Laravel: Up & Running (Matt Stauffer)', format: 'papel' },
      ],
    },
    {
      id: 'backend-php/symfony',
      name: 'Symfony',
      kind: 'tech',
      area: 'framework',
      x: 16,
      y: 64,
      weight: 2,
      summary: 'Symfony es el framework PHP más robusto y modular, base de medio ecosistema (Laravel incluido). Consiste en componentes reutilizables e inyección de dependencias de primera. Te capacita para construir sistemas grandes y a largo plazo con arquitectura sólida.',
      prereqs: ['backend-php/poo-php', 'backend-php/composer'],
      keyPoints: [
        'Conoce la alternativa seria a Laravel: componentes desacoplados que usan hasta los demás frameworks.',
        'El contenedor de servicios y la configuración explícita: menos magia, más control.',
        'Sus componentes valen sueltos: Console, HttpFoundation, Messenger, Validator en cualquier proyecto PHP.',
        'Entender ambos frameworks te enseña qué es esencial (HTTP, DI, ORM) y qué es sabor de cada casa.',
      ],
      aiFocus:
        'La IA traduce entre Laravel y Symfony con fluidez, así que el coste de conocer ambos ha bajado. Profundiza en los conceptos compartidos (kernel HTTP, inyección, eventos): con ellos evalúas si el código generado usa el framework o solo lo imita por encima.',
      resources: [
        { kind: 'doc', label: 'Symfony — documentación oficial', url: 'https://symfony.com/doc' },
        { kind: 'curso', label: 'SymfonyCasts', url: 'https://symfonycasts.com' },
      ],
    },
    {
      id: 'backend-php/inyeccion-dependencias',
      name: 'Inyección de dependencias',
      kind: 'skill',
      area: 'framework',
      x: 20,
      y: 48,
      weight: 2,
      summary: 'La inyección de dependencias es dar a cada clase lo que necesita desde fuera en vez de que se lo cree ella. Consiste en desacoplar componentes para poder cambiarlos y testearlos. Te capacita para escribir código flexible que no se convierte en un nudo imposible.',
      prereqs: ['backend-php/poo-php'],
      keyPoints: [
        'Las dependencias entran por el constructor: nada de new dentro de la lógica ni estáticos globales.',
        'Entiende el contenedor de tu framework: autowiring, bindings y cuándo registrar algo a mano.',
        'Depende de interfaces en las fronteras (correo, pagos, almacenamiento): cambiar de proveedor sin tocar dominio.',
        'La inyección existe para poder testear: si no puedes sustituir una dependencia en el test, está mal cableada.',
      ],
      aiFocus:
        'El código generado tiende a atajos: facades por todas partes, new dentro del servicio, estado global. Funciona… hasta que quieres testearlo. Profundiza en el flujo de dependencias de tu aplicación: es el criterio con el que decides si un servicio generado está bien cosido o solo pegado.',
      resources: [
        { kind: 'doc', label: 'Laravel — el service container', url: 'https://laravel.com/docs/container' },
        { kind: 'doc', label: 'Symfony — el componente DependencyInjection', url: 'https://symfony.com/doc/current/components/dependency_injection.html' },
      ],
    },
    {
      id: 'backend-php/routing-middleware',
      name: 'Routing y middleware',
      kind: 'tech',
      area: 'framework',
      x: 30,
      y: 40,
      weight: 2,
      summary: 'El routing y el middleware son la puerta de entrada de una API: qué URL va a qué código y qué se ejecuta antes (auth, logs, validación). Consiste en encaminar peticiones y encadenar capas. Te capacita para organizar el flujo de tu servicio con claridad.',
      prereqs: ['backend-php/laravel'],
      keyPoints: [
        'Rutas como mapa de tu API: agrupación, prefijos, nombres y parámetros tipados con model binding.',
        'Middleware para lo transversal: auth, rate limiting, CORS, logging — en la cadena, no en cada controlador.',
        'Controladores delgados: reciben, validan, delegan al servicio y responden; la lógica vive fuera.',
        'Entiende el orden de la cadena de middleware: la mitad de los bugs «raros» de auth vienen de ahí.',
      ],
      aiFocus:
        'La IA genera rutas y controladores correctos pero engorda los controladores con lógica de negocio que luego nadie reutiliza. Profundiza en dónde va cada cosa (middleware, controlador, servicio, modelo): esa arquitectura de capas es el mapa contra el que revisas cada endpoint generado.',
      resources: [
        { kind: 'doc', label: 'Laravel — routing y middleware', url: 'https://laravel.com/docs/routing' },
        { kind: 'doc', label: 'MDN — HTTP', url: 'https://developer.mozilla.org/es/docs/Web/HTTP' },
      ],
    },

    // ── APIs y datos (norte-centro) ─────────────────────────────────────────
    {
      id: 'backend-php/api-rest',
      name: 'APIs REST',
      kind: 'tech',
      area: 'apis-datos',
      x: 42,
      y: 36,
      weight: 3,
      summary: 'Una API REST es exponer tus datos y operaciones por HTTP de forma predecible: recursos, métodos y códigos de estado. Consiste en diseñar endpoints coherentes que cualquier cliente entienda. Te capacita para que web, móvil o terceros consuman tu backend.',
      prereqs: ['backend-php/routing-middleware'],
      keyPoints: [
        'Diseña el contrato primero: recursos, verbos, códigos de estado y formato de error coherentes.',
        'Serialización controlada con API Resources/serializers: nunca expongas el modelo de base de datos tal cual.',
        'Paginación, filtrado y ordenación desde el primer endpoint: añadirlos después rompe clientes.',
        'Versiona o evoluciona con cuidado: un campo renombrado es un breaking change para alguien.',
        'Documenta con OpenAPI: el contrato explícito sirve a humanos, a clientes generados y a la propia IA.',
      ],
      aiFocus:
        'La IA genera endpoints REST enteros a partir de una frase, pero el contrato — qué expones, cómo falla, cómo versiona — es decisión tuya con años de consecuencias. Profundiza en diseño de APIs: un buen spec OpenAPI es además el mejor prompt posible para generar el resto.',
      resources: [
        { kind: 'doc', label: 'roadmap.sh — API Design', url: 'https://roadmap.sh/api-design' },
        { kind: 'doc', label: 'OpenAPI — la especificación', url: 'https://www.openapis.org' },
        { kind: 'doc', label: 'Laravel — Eloquent API Resources', url: 'https://laravel.com/docs/eloquent-resources' },
      ],
    },
    {
      id: 'backend-php/autenticacion',
      name: 'Autenticación y autorización',
      kind: 'skill',
      area: 'apis-datos',
      x: 62,
      y: 36,
      weight: 3,
      summary: 'La autenticación y autorización son saber quién es el usuario y qué puede hacer. Consiste en login, tokens, sesiones y permisos por rol o recurso. Te capacita para proteger tu API dejando entrar a los tuyos y cerrando la puerta al resto.',
      prereqs: ['backend-php/api-rest'],
      keyPoints: [
        'Distingue authn de authz: quién eres (sesión, token) y qué puedes hacer (roles, policies).',
        'Usa lo que trae el framework (Sanctum, Passport, security de Symfony): cripto casera prohibida.',
        'Contraseñas con hash lento (bcrypt/argon2) y tokens con expiración y revocación.',
        'Autoriza en el servidor SIEMPRE: ocultar el botón en el frontend no es seguridad.',
        'Policies/voters por recurso: el «¿puede este usuario tocar ESTE registro?» centralizado y testeado.',
      ],
      aiFocus:
        'Los fallos de autorización son el agujero más común del código generado: endpoints que comprueban que estás logueado pero no que el recurso sea tuyo. Profundiza en modelar permisos y revisa cada endpoint generado preguntando «¿y si cambio el id por el de otro usuario?».',
      resources: [
        { kind: 'doc', label: 'Laravel — autenticación y autorización', url: 'https://laravel.com/docs/authentication' },
        { kind: 'doc', label: 'OWASP — Authentication Cheat Sheet', url: 'https://cheatsheetseries.owasp.org' },
      ],
    },
    {
      id: 'backend-php/orm-eloquent',
      name: 'ORM: Eloquent y Doctrine',
      kind: 'tech',
      area: 'apis-datos',
      x: 36,
      y: 20,
      weight: 3,
      summary: 'Un ORM como Eloquent o Doctrine es hablar con la base de datos en objetos en vez de SQL a pelo. Consiste en modelar entidades, relaciones y consultas de forma legible. Te capacita para persistir datos rápido sin perder el control de lo que hace la base.',
      prereqs: ['backend-php/laravel'],
      keyPoints: [
        'Modela relaciones con intención: hasMany, belongsToMany y cuándo una tabla pivote merece modelo propio.',
        'El problema N+1 es EL problema: eager loading (with) y revisar las queries reales que salen.',
        'Migraciones como historia del esquema: pequeñas, reversibles y revisadas como código que son.',
        'Sabe cuándo abandonar el ORM: reporting y consultas complejas van mejor en SQL directo.',
        'Conoce el patrón de tu ORM: Active Record (Eloquent) vs Data Mapper (Doctrine) condicionan el diseño.',
      ],
      aiFocus:
        'La IA escribe modelos y relaciones con soltura pero genera N+1 sin despeinarse: la query «funciona» y muere con datos reales. Profundiza en leer el SQL que tu ORM emite de verdad (query log, Telescope) — es la verificación que separa al que revisa del que confía.',
      resources: [
        { kind: 'doc', label: 'Laravel — Eloquent', url: 'https://laravel.com/docs/eloquent' },
        { kind: 'doc', label: 'Doctrine — documentación oficial', url: 'https://www.doctrine-project.org' },
        { kind: 'libro', label: 'SQL Antipatterns (Bill Karwin)', format: 'papel' },
      ],
    },
    {
      id: 'backend-php/validacion-entrada',
      name: 'Validación de entrada',
      kind: 'skill',
      area: 'apis-datos',
      x: 50,
      y: 28,
      weight: 2,
      summary: 'La validación de entrada es no fiarte nunca de lo que llega de fuera y comprobar que tiene la forma esperada. Consiste en reglas por campo y respuestas de error claras. Te capacita para blindar tu API contra datos basura y contra atacantes.',
      prereqs: ['backend-php/api-rest'],
      keyPoints: [
        'Valida TODO lo que cruza la frontera: body, query, cabeceras, ficheros — en el servidor, siempre.',
        'Form Requests/DTOs validados: la validación declarada y separada del controlador.',
        'Lista blanca, no negra: define qué aceptas; lo demás se rechaza con un 422 útil.',
        'Los errores de validación son API: formato consistente que el frontend pueda pintar campo a campo.',
        'La validación no sustituye a la autorización ni al escapado: son tres defensas distintas.',
      ],
      aiFocus:
        'El código generado valida lo obvio (required, email) y olvida lo peligroso: tamaños máximos, tipos de fichero, ids que deben pertenecer al usuario. Profundiza en pensar como atacante — cada regla de validación que exiges al modelo es una clase de incidente que no tendrás.',
      resources: [
        { kind: 'doc', label: 'Laravel — validación', url: 'https://laravel.com/docs/validation' },
        { kind: 'doc', label: 'OWASP — Input Validation Cheat Sheet', url: 'https://cheatsheetseries.owasp.org' },
      ],
    },
    {
      id: 'backend-php/colas-trabajos',
      name: 'Colas y trabajos en segundo plano',
      kind: 'tech',
      area: 'apis-datos',
      x: 66,
      y: 22,
      weight: 1,
      summary: 'Las colas y trabajos en segundo plano son sacar lo pesado (enviar correos, procesar imágenes) fuera de la petición del usuario. Consiste en encolar tareas y procesarlas aparte. Te capacita para que tu API responda al instante aunque el trabajo real tarde.',
      prereqs: ['backend-php/laravel'],
      keyPoints: [
        'Saca del request lo que no necesita respuesta inmediata: correos, informes, llamadas a terceros.',
        'Jobs idempotentes: un reintento no puede cobrar dos veces ni enviar dos correos.',
        'Reintentos, backoff y cola de fallidos: los jobs fallan, diseña para ello.',
        'El scheduler para lo periódico: tareas cron versionadas junto al código.',
      ],
      aiFocus:
        'La IA convierte código síncrono en jobs con facilidad, pero la semántica de fallo — idempotencia, reintentos, orden — no la piensa por ti. Profundiza en diseñar jobs que pueden ejecutarse dos veces sin daño: es la pregunta que debes hacer a cada job generado.',
      resources: [
        { kind: 'doc', label: 'Laravel — queues', url: 'https://laravel.com/docs/queues' },
        { kind: 'doc', label: 'Symfony — el componente Messenger', url: 'https://symfony.com/doc/current/messenger.html' },
      ],
    },
    {
      id: 'backend-php/api-produccion',
      name: 'API en producción',
      kind: 'milestone',
      area: 'apis-datos',
      x: 52,
      y: 12,
      weight: 3,
      summary: 'Poner una API PHP en producción es el hito de tener un servicio real: seguro, con datos, desplegado y monitorizado. Consiste en juntar todo lo de la isla en algo que aguanta usuarios. Te capacita para demostrar que sabes operar un backend, no solo escribirlo.',
      prereqs: [
        'backend-php/api-rest',
        'backend-php/autenticacion',
        'backend-php/orm-eloquent',
        'backend-php/testing-php',
      ],
      keyPoints: [
        'Cierra el ciclo: una API real desplegada, con auth, validación, tests y documentación de contrato.',
        'Aguanta datos reales: sin N+1, con paginación, con índices donde las queries lo piden.',
        'Falla con dignidad: errores consistentes, logs útiles y ninguna traza expuesta al cliente.',
        'Alguien la consume: una API sin consumidor es una hipótesis, no un producto.',
      ],
      aiFocus:
        'Con IA, montar el esqueleto de una API cuesta una tarde; este milestone va del otro 80%: seguridad revisada, rendimiento medido con datos reales y contrato documentado. Profundiza en ese tramo final — es exactamente el que no se puede generar, solo verificar.',
      resources: [
        { kind: 'doc', label: 'Laravel — deployment', url: 'https://laravel.com/docs/deployment' },
        { kind: 'doc', label: 'roadmap.sh — PHP (revisa qué te falta)', url: 'https://roadmap.sh/php' },
      ],
    },

    // ── Calidad y análisis (noroeste) ───────────────────────────────────────
    {
      id: 'backend-php/testing-php',
      name: 'Testing en PHP',
      kind: 'skill',
      area: 'calidad',
      x: 22,
      y: 28,
      weight: 3,
      summary: 'El testing en PHP es probar tu backend con PHPUnit o Pest para no romperlo al cambiarlo. Consiste en cubrir la lógica de negocio y los caminos importantes de la API. Te capacita para refactorizar y desplegar con la tranquilidad de una red de seguridad.',
      prereqs: ['backend-php/laravel'],
      keyPoints: [
        'Pest o PHPUnit con soltura: unitarios para el dominio, de feature para los endpoints.',
        'Tests de feature HTTP: la forma más rentable de cubrir una API (petición real, asserts sobre respuesta y BD).',
        'Base de datos de test aislada: factories, RefreshDatabase y datos mínimos por caso.',
        'Dobles solo en las fronteras (correo, pagos, APIs externas): mockear tu propio dominio es olor a mal diseño.',
        'Cubre los casos que duelen: permisos, validación, estados inconsistentes — no solo el happy path.',
      ],
      aiFocus:
        'La IA genera tests que documentan lo que el código hace, no lo que debería hacer: si el bug está en el código, el test generado lo consagra. Profundiza en definir TÚ los casos (sobre todo authz y bordes) y deja que la IA escriba el andamiaje — nunca al revés.',
      resources: [
        { kind: 'doc', label: 'Pest — documentación oficial', url: 'https://pestphp.com' },
        { kind: 'doc', label: 'PHPUnit — documentación oficial', url: 'https://phpunit.de' },
        { kind: 'doc', label: 'Laravel — testing', url: 'https://laravel.com/docs/testing' },
      ],
    },
    {
      id: 'backend-php/depuracion-perfilado',
      name: 'Depuración y perfilado',
      kind: 'skill',
      area: 'calidad',
      x: 10,
      y: 20,
      weight: 2,
      summary: 'La depuración y el perfilado son encontrar por qué algo falla o va lento con herramientas, no adivinando. Consiste en usar Xdebug, medir tiempos y localizar el cuello real. Te capacita para arreglar bugs y lentitud de raíz en vez de por prueba y error.',
      prereqs: ['backend-php/errores-excepciones'],
      keyPoints: [
        'Xdebug con breakpoints en el editor: ver el estado real vale más que cien dd().',
        'Telescope/profiler del framework: queries, jobs, cache y requests de la app en un panel.',
        'Perfila antes de optimizar: casi siempre el tiempo está en la base de datos o en llamadas externas, no en PHP.',
        'Logs con contexto estructurado: request id, usuario, payload — lo que necesitarás a las 3 de la mañana.',
      ],
      aiFocus:
        'La IA propone hipótesis de bug excelentes si le das datos reales: traza completa, query log, valores concretos. Profundiza en extraer esa evidencia con el debugger y el profiler — con síntomas vagos la IA alucina causas; con datos, acierta a la primera.',
      resources: [
        { kind: 'doc', label: 'Xdebug — documentación oficial', url: 'https://xdebug.org' },
        { kind: 'doc', label: 'Laravel Telescope', url: 'https://laravel.com/docs/telescope' },
      ],
    },
    {
      id: 'backend-php/analisis-estatico',
      name: 'Análisis estático',
      kind: 'tech',
      area: 'calidad',
      x: 6,
      y: 36,
      weight: 2,
      summary: 'El análisis estático es que una herramienta (PHPStan, Psalm) revise tu código sin ejecutarlo y cace errores de tipos y bugs latentes. Consiste en subir el nivel de rigor poco a poco. Te capacita para pillar fallos antes de producción, gratis y en cada guardado.',
      prereqs: ['backend-php/estandares-psr'],
      keyPoints: [
        'PHPStan (o Psalm) en el CI: bugs de tipos y nulls cazados sin ejecutar nada.',
        'Sube de nivel gradualmente: empieza donde estés y usa el baseline para el legacy.',
        'Los genéricos por docblock (array<int, User>) llevan el tipado de PHP mucho más lejos.',
        'Rector para refactors mecánicos a escala: subir de versión de PHP o de framework con reglas.',
        'El análisis estático es tu primer revisor de código generado: gratis, instantáneo e incansable.',
      ],
      aiFocus:
        'El dúo perfecto: la IA genera código y PHPStan lo verifica al nivel máximo antes de que tú gastes atención. Profundiza en configurar el pipeline (nivel, reglas, baseline) — cada error que el estático caza automáticamente es revisión humana que reservas para el diseño.',
      resources: [
        { kind: 'doc', label: 'PHPStan — documentación oficial', url: 'https://phpstan.org' },
        { kind: 'doc', label: 'Rector — refactoring automatizado', url: 'https://getrector.com' },
      ],
    },

    // ── Despliegue y operación (este) ───────────────────────────────────────
    {
      id: 'backend-php/despliegue-php',
      name: 'Desplegar PHP',
      kind: 'tech',
      area: 'despliegue',
      x: 80,
      y: 66,
      weight: 2,
      summary: 'Desplegar PHP es llevar tu aplicación del portátil a un servidor de verdad de forma repetible. Consiste en configurar el entorno, el servidor web y el proceso de release. Te capacita para publicar cambios sin dramas ni pasos manuales que se olvidan.',
      prereqs: ['backend-php/php-8'],
      keyPoints: [
        'Entiende la pila: nginx + PHP-FPM (o FrankenPHP/Octane) y qué hace cada capa.',
        'Despliegue sin downtime: releases atómicas con symlink o contenedores; migraciones antes del switch.',
        'OPcache activado y bien dimensionado: es la diferencia de rendimiento más barata que existe.',
        'Config por entorno: .env fuera de git, secretos en el gestor del proveedor.',
        'Automatiza desde el día uno: Deployer, Forge o CI/CD — desplegar a mano es acumular miedo.',
      ],
      aiFocus:
        'La IA escribe configs de nginx, Dockerfiles y scripts de deploy en segundos — y un fallo ahí tumba producción entera. Profundiza en entender cada línea antes de aplicarla y en tener rollback probado: la config generada se revisa con más dureza que el código, no con menos.',
      resources: [
        { kind: 'doc', label: 'Deployer — despliegue automatizado de PHP', url: 'https://deployer.org' },
        { kind: 'doc', label: 'PHP-FPM — manual oficial', url: 'https://www.php.net/manual/es/install.fpm.php' },
      ],
    },
    {
      id: 'backend-php/logs-monitorizacion',
      name: 'Logs y monitorización',
      kind: 'skill',
      area: 'despliegue',
      x: 92,
      y: 58,
      weight: 1,
      summary: 'Los logs y la monitorización son los ojos de tu servicio en producción: qué pasa, qué falla y cuándo. Consiste en registrar lo útil y vigilar métricas y alertas. Te capacita para enterarte de los problemas antes que tus usuarios, no después.',
      prereqs: ['backend-php/despliegue-php'],
      keyPoints: [
        'Logs estructurados (PSR-3/Monolog) con niveles bien usados: debug no es info, warning no es error.',
        'Errores agregados con contexto (Sentry o similar): enterarte antes que el usuario.',
        'Métricas mínimas que importan: tasa de errores, latencia y profundidad de colas.',
        'Alertas accionables: si una alerta no implica hacer algo, es ruido que entrena a ignorar.',
      ],
      aiFocus:
        'La IA resume logs y sugiere causas de un pico de errores sorprendentemente bien — si los logs tienen contexto. Profundiza en QUÉ registrar (request id, usuario, decisiones de negocio): un log bien diseñado es también el mejor input para que la IA te ayude en el incidente.',
      resources: [
        { kind: 'doc', label: 'Monolog — logging para PHP', url: 'https://seldaek.github.io/monolog/' },
        { kind: 'doc', label: 'Sentry — monitorización de errores', url: 'https://sentry.io' },
      ],
    },
    {
      id: 'backend-php/cache-rendimiento',
      name: 'Cache y rendimiento',
      kind: 'skill',
      area: 'despliegue',
      x: 82,
      y: 46,
      weight: 2,
      summary: 'La caché y el rendimiento son hacer que tu API responda rápido guardando lo caro y evitando trabajo repetido. Consiste en cachear con criterio e invalidar bien. Te capacita para escalar sin tirar de más servidores a la primera de cambio.',
      prereqs: ['backend-php/despliegue-php'],
      keyPoints: [
        'Mide primero: el 90% del tiempo suele estar en la base de datos, no en PHP.',
        'Cachea con estrategia: qué (queries caras, respuestas), dónde (Redis) y sobre todo CUÁNDO invalidar.',
        'La invalidación es el problema difícil: TTLs cortos y claves bien diseñadas antes que invalidación manual heroica.',
        'Cache HTTP también: ETags y Cache-Control ahorran requests enteros.',
        'Una cache que enmascara una query mala es deuda: primero arregla la query.',
      ],
      aiFocus:
        'Pide «optimiza esto» y la IA meterá cache en todas partes — incluida la que servirá datos obsoletos a tus usuarios. Profundiza en decidir qué puede estar desactualizado y cuánto tiempo: esa es la decisión de negocio que ningún modelo puede tomar por ti.',
      resources: [
        { kind: 'doc', label: 'Redis — documentación oficial', url: 'https://redis.io' },
        { kind: 'doc', label: 'Laravel — cache', url: 'https://laravel.com/docs/cache' },
      ],
    },

    // ── PHP con IA (norte) ──────────────────────────────────────────────────
    {
      id: 'backend-php/modernizar-legacy-ia',
      name: 'Modernizar legacy con IA',
      kind: 'skill',
      area: 'php-ia',
      x: 18,
      y: 10,
      weight: 3,
      summary: 'Modernizar legacy con IA es usar el modelo para entender y refactorizar código viejo que nadie quiere tocar. Consiste en apoyarte en la IA para leer, documentar y migrar con red de tests. Te capacita para desatascar proyectos heredados sin morir en el intento.',
      prereqs: ['backend-php/analisis-estatico', 'backend-php/testing-php'],
      keyPoints: [
        'Primero el arnés, luego el cambio: tests de caracterización que fijan el comportamiento actual, aunque sea feo.',
        'Usa la IA para ENTENDER el legacy: que explique módulos, trace flujos y proponga mapas del sistema.',
        'Migra en rebanadas pequeñas y desplegables: big-bang generado es big-bang fallido.',
        'Rector para lo mecánico (sintaxis, versiones) e IA para lo semántico (extraer servicios, romper globals).',
        'Verifica cada rebanada con el arnés y el análisis estático antes de la siguiente.',
      ],
      aiFocus:
        'Hay más PHP legacy que developers para modernizarlo: hacerlo bien con IA es una habilidad muy cotizada. La IA lee y transforma código viejo a gran velocidad, pero solo tú garantizas que el comportamiento se conserva. Profundiza en tests de caracterización y migración incremental.',
      resources: [
        { kind: 'libro', label: 'Working Effectively with Legacy Code (Michael Feathers)', format: 'papel' },
        { kind: 'post', label: 'Understand Legacy Code (Nicolas Carlo)', url: 'https://understandlegacycode.com' },
        { kind: 'doc', label: 'Rector — upgrades automatizados', url: 'https://getrector.com' },
      ],
    },
    {
      id: 'backend-php/revisar-migraciones-ia',
      name: 'Revisar migraciones generadas',
      kind: 'skill',
      area: 'php-ia',
      x: 34,
      y: 6,
      weight: 2,
      summary: 'Revisar migraciones generadas es no aplicar a ciegas los cambios de base de datos que propone la IA. Consiste en comprobar que no pierden datos, no bloquean y son reversibles. Te capacita para aprovechar la velocidad de la IA sin jugarte la integridad de la base.',
      prereqs: ['backend-php/orm-eloquent', 'backend-php/modernizar-legacy-ia'],
      keyPoints: [
        'Toda migración generada se lee línea a línea: el esquema es lo más caro de arreglar después.',
        'Busca lo que la IA omite: índices para las queries reales, foreign keys, NOT NULL, defaults sensatos.',
        'Piensa en la tabla con datos: ¿este ALTER bloquea la tabla en producción? ¿cuánto tarda con millones de filas?',
        'El down() debe funcionar de verdad: una migración irreversible se decide, no se descubre.',
        'Ensaya sobre una copia con volumen real antes de tocar producción.',
      ],
      aiFocus:
        'Las migraciones son el punto donde un error generado no se arregla con git revert: los datos ya cambiaron. Profundiza en DDL y sus efectos operativos (locks, tiempos, reversibilidad) — es la revisión de más responsabilidad que harás sobre salida de IA en backend.',
      resources: [
        { kind: 'doc', label: 'Laravel — migraciones', url: 'https://laravel.com/docs/migrations' },
        { kind: 'doc', label: 'PostgreSQL — ALTER TABLE y locks', url: 'https://www.postgresql.org/docs/' },
      ],
    },
  ],
};
