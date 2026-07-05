/**
 * Isla «Postgres» (doc /careerMap/postgres) — contenido curado MC-16,
 * oleada 2.
 *
 * Sigue la CONVENCIÓN DE CONTENIDO DE ISLAS descrita en la cabecera de
 * ./bases.js. Basada en roadmap.sh/postgresql-dba pero adaptada a la era IA:
 * la IA escribe SQL y migraciones a demanda, así que el mapa carga el peso en
 * modelado, lectura de planes (EXPLAIN), concurrencia y operación — el
 * criterio para VERIFICAR lo generado antes de que toque datos reales.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const POSTGRES_ISLAND = {
  id: 'postgres',
  name: 'Postgres',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'modelado-sql', name: 'Modelado y SQL' },
    { id: 'transacciones', name: 'Transacciones y concurrencia' },
    { id: 'indices-rendimiento', name: 'Índices y rendimiento' },
    { id: 'administracion', name: 'Administración' },
    { id: 'extensiones-json', name: 'JSON y extensiones' },
    { id: 'postgres-ia', name: 'Postgres con IA' },
  ],
  cities: [
    // ── Modelado y SQL (sur, junto al puerto) ───────────────────────────────
    {
      id: 'postgres/sql-fundamentos',
      name: 'SQL sólido',
      kind: 'tech',
      area: 'modelado-sql',
      x: 50,
      y: 74,
      weight: 3,
      summary: 'El SQL sólido es el idioma para preguntarle datos a una base relacional: seleccionar, filtrar, ordenar y agrupar. Consiste en pensar en conjuntos, no en bucles. Te capacita para sacar exactamente la información que necesitas de cualquier base de datos.',
      prereqs: [],
      keyPoints: [
        'SQL es declarativo: describes el QUÉ y el planificador decide el cómo — piensa en conjuntos, no en bucles.',
        'Domina el núcleo: SELECT, WHERE, ORDER BY, LIMIT, INSERT/UPDATE/DELETE con RETURNING.',
        'NULL es el gran traidor: lógica de tres valores, IS NULL vs = NULL, COALESCE.',
        'Practica sobre datos de verdad: instala Postgres en local y juega con un dataset real.',
        'psql como herramienta diaria: \\d, \\dt, \\timing — el cliente oficial te enseña la base de datos.',
      ],
      aiFocus:
        'La IA traduce lenguaje natural a SQL con gran acierto en consultas simples — y con errores confiados en cuanto hay NULLs, duplicados o agregaciones sutiles. Profundiza en semántica de SQL: necesitas poder leer una consulta generada y saber qué filas devuelve de verdad, no qué aparenta.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — documentación oficial', url: 'https://www.postgresql.org/docs/' },
        { kind: 'curso', label: 'PostgreSQL Tutorial', url: 'https://www.postgresqltutorial.com' },
        { kind: 'doc', label: 'roadmap.sh — PostgreSQL DBA', url: 'https://roadmap.sh/postgresql-dba' },
      ],
    },
    {
      id: 'postgres/modelado-relacional',
      name: 'Modelado relacional',
      kind: 'skill',
      area: 'modelado-sql',
      x: 38,
      y: 66,
      weight: 3,
      summary: 'El modelado relacional es diseñar tus tablas y relaciones para que los datos sean coherentes y no se dupliquen. Consiste en claves, normalización y decidir qué va junto y qué separado. Te capacita para construir una base que aguanta el crecimiento sin volverse un caos.',
      prereqs: ['postgres/sql-fundamentos'],
      keyPoints: [
        'Modela entidades y relaciones antes de escribir CREATE TABLE: el esquema es la decisión más cara de cambiar.',
        'Normaliza por defecto (3FN) y desnormaliza solo con una razón medida.',
        'Claves primarias con criterio y foreign keys SIEMPRE: la integridad la garantiza la base, no la aplicación.',
        'Constraints como especificación ejecutable: NOT NULL, UNIQUE, CHECK — cada regla del negocio que puedas declarar.',
        'Aprende los antipatrones clásicos (EAV, listas en columnas, claves multiuso) para reconocerlos al vuelo.',
      ],
      aiFocus:
        'La IA propone esquemas razonables de libro, pero no conoce tu dominio: cardinalidades reales, qué consultas dominarán, qué cambiará el año que viene. Profundiza en modelado — es la decisión de mayor coste de cambio de todo el backend y la que menos se puede delegar.',
      resources: [
        { kind: 'libro', label: 'SQL Antipatterns (Bill Karwin)', format: 'papel' },
        { kind: 'libro', label: 'The Art of PostgreSQL (Dimitri Fontaine)', format: 'papel' },
        { kind: 'doc', label: 'PostgreSQL — DDL y constraints', url: 'https://www.postgresql.org/docs/current/ddl.html' },
      ],
    },
    {
      id: 'postgres/joins-agregaciones',
      name: 'Joins y agregaciones',
      kind: 'tech',
      area: 'modelado-sql',
      x: 62,
      y: 66,
      weight: 3,
      summary: 'Los joins y las agregaciones son cruzar tablas y resumir datos (sumar, contar, promediar) en una sola consulta. Consiste en combinar información dispersa y calcular sobre ella. Te capacita para responder preguntas complejas del negocio directamente en SQL.',
      prereqs: ['postgres/sql-fundamentos'],
      keyPoints: [
        'Los joins como operaciones de conjuntos: INNER, LEFT, y qué filas aparecen o desaparecen en cada uno.',
        'GROUP BY con la regla de oro: todo lo del SELECT o se agrega o se agrupa.',
        'HAVING filtra grupos, WHERE filtra filas — y el orden lógico de evaluación explica los dos.',
        'El LEFT JOIN + WHERE que lo convierte en INNER sin querer: el bug de agregación más común.',
        'Subconsultas, EXISTS y LATERAL: alternativas con semánticas distintas para el mismo problema.',
      ],
      aiFocus:
        'Las consultas con varios joins y agregaciones son donde el SQL generado falla en silencio: devuelve números plausibles pero duplicados o incompletos. Profundiza en verificar con casos pequeños de respuesta conocida — nunca aceptes una agregación generada sin contrastar el resultado.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — tutorial de queries', url: 'https://www.postgresql.org/docs/current/tutorial-sql.html' },
        { kind: 'curso', label: 'PostgreSQL Exercises — práctica interactiva', url: 'https://pgexercises.com' },
      ],
    },
    {
      id: 'postgres/tipos-datos',
      name: 'Tipos de datos',
      kind: 'tech',
      area: 'modelado-sql',
      x: 50,
      y: 58,
      weight: 2,
      summary: 'Los tipos de datos de Postgres son mucho más ricos que texto y número: fechas, JSON, arrays, rangos, geometrías. Consiste en elegir el tipo correcto para cada dato. Te capacita para modelar con precisión y dejar que la base valide y calcule por ti.',
      prereqs: ['postgres/modelado-relacional'],
      keyPoints: [
        'Elige el tipo exacto: text, numeric para dinero (nunca float), timestamptz para fechas, uuid, boolean.',
        'timestamptz vs timestamp: la diferencia que causa la mitad de los bugs de zonas horarias.',
        'Tipos ricos de Postgres que ahorran tablas: arrays, rangos, enums, inet.',
        'Domains y CHECK para tipos con reglas: un email o un porcentaje son más que un text.',
        'Cada tipo mal elegido es una conversión eterna: castings en cada query y en cada índice.',
      ],
      aiFocus:
        'La IA arrastra malos hábitos de otros motores: float para dinero, varchar(255) por costumbre, timestamp sin zona. Profundiza en el catálogo de tipos de Postgres — revisar los tipos de un esquema generado es de las revisiones más rentables que existen: barata ahora, carísima después.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — tipos de datos', url: 'https://www.postgresql.org/docs/current/datatype.html' },
        { kind: 'post', label: 'Cybertec — blog técnico de Postgres', url: 'https://www.cybertec-postgresql.com' },
      ],
    },
    {
      id: 'postgres/vistas-cte',
      name: 'CTEs y window functions',
      kind: 'tech',
      area: 'modelado-sql',
      x: 70,
      y: 76,
      weight: 2,
      summary: 'Las CTEs y window functions son herramientas para consultas potentes y legibles: pasos con nombre y cálculos por ventana (rankings, acumulados). Consiste en estructurar consultas complejas sin subconsultas ilegibles. Te capacita para resolver en SQL lo que muchos exportan a código.',
      prereqs: ['postgres/joins-agregaciones'],
      keyPoints: [
        'CTEs (WITH) para dar nombre a los pasos: consultas complejas legibles como un pipeline.',
        'Window functions para lo que GROUP BY no puede: rankings, acumulados y comparar con la fila vecina sin perder filas.',
        'PARTITION BY vs GROUP BY: agrupar sin colapsar es el superpoder de las ventanas.',
        'Vistas para encapsular lógica repetida; materializadas cuando el cálculo es caro y la frescura negociable.',
        'CTEs recursivas para jerarquías: árboles y grafos en SQL puro.',
      ],
      aiFocus:
        'Aquí la IA brilla: describe el informe que quieres y obtendrás una CTE con ventanas que te habría llevado una hora. Tu parte es verificar la semántica (marcos de ventana, empates, particiones) con un caso pequeño de resultado conocido. Profundiza en leer estas consultas con fluidez.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — window functions', url: 'https://www.postgresql.org/docs/current/tutorial-window.html' },
        { kind: 'libro', label: 'The Art of PostgreSQL (Dimitri Fontaine)', format: 'papel' },
      ],
    },

    // ── Transacciones y concurrencia (oeste) ────────────────────────────────
    {
      id: 'postgres/transacciones',
      name: 'Transacciones',
      kind: 'tech',
      area: 'transacciones',
      x: 28,
      y: 74,
      weight: 3,
      summary: 'Las transacciones son agrupar varias operaciones para que ocurran todas o ninguna. Consiste en entender commit, rollback y las garantías ACID. Te capacita para que tu base nunca quede a medias aunque algo falle en mitad de una operación.',
      prereqs: ['postgres/sql-fundamentos'],
      keyPoints: [
        'ACID no es marketing: atomicidad y consistencia son lo que te deja dormir por la noche.',
        'BEGIN/COMMIT/ROLLBACK con intención: la transacción agrupa lo que debe pasar junto o no pasar.',
        'Transacciones cortas: una transacción abierta mientras llamas a una API externa es un incidente en potencia.',
        'Errores dentro de la transacción: en Postgres, tras un error se hace rollback o savepoint — no se sigue como si nada.',
        'Piensa qué pasa si el proceso muere a mitad: esa pregunta define dónde empiezan y acaban tus transacciones.',
      ],
      aiFocus:
        'El código generado tiende a transacciones decorativas: o envuelve cada statement por separado (sin atomicidad real) o abre una transacción kilométrica que retiene locks. Profundiza en delimitar unidades de trabajo — decidir qué es atómico es diseño de negocio, no sintaxis.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — tutorial de transacciones', url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html' },
        { kind: 'libro', label: 'Designing Data-Intensive Applications (Martin Kleppmann)', format: 'papel' },
      ],
    },
    {
      id: 'postgres/mvcc-aislamiento',
      name: 'MVCC y aislamiento',
      kind: 'skill',
      area: 'transacciones',
      x: 16,
      y: 64,
      weight: 2,
      summary: 'El MVCC y el aislamiento son cómo Postgres deja que muchos escriban y lean a la vez sin pisarse. Consiste en entender los niveles de aislamiento y sus efectos. Te capacita para razonar sobre concurrencia y evitar datos inconsistentes bajo carga.',
      prereqs: ['postgres/transacciones'],
      keyPoints: [
        'MVCC: los lectores no bloquean a los escritores porque cada transacción ve su propia foto de los datos.',
        'Read Committed (el default) y sus sorpresas: dos SELECT en la misma transacción pueden ver datos distintos.',
        'Repeatable Read y Serializable: cuándo pagar más aislamiento y qué es un error de serialización.',
        'Anomalías con nombre: lost update, write skew — reconocerlas es saber qué nivel necesitas.',
        'El precio de MVCC son las tuplas muertas: por esto existen VACUUM y el bloat.',
      ],
      aiFocus:
        'Los bugs de concurrencia no aparecen en la demo: aparecen con dos usuarios pulsando a la vez, y la IA no los ve porque razona sobre una sola ejecución. Profundiza en MVCC y anomalías — es tu criterio para preguntar «¿y si dos transacciones hacen esto a la vez?» ante cualquier código generado.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — niveles de aislamiento', url: 'https://www.postgresql.org/docs/current/transaction-iso.html' },
        { kind: 'post', label: 'pganalyze — artículos sobre MVCC y rendimiento', url: 'https://pganalyze.com' },
      ],
    },
    {
      id: 'postgres/bloqueos',
      name: 'Bloqueos y contención',
      kind: 'skill',
      area: 'transacciones',
      x: 20,
      y: 48,
      weight: 2,
      summary: 'Los bloqueos y la contención son lo que pasa cuando varias operaciones se pelean por los mismos datos. Consiste en entender qué bloquea qué y cómo evitar esperas y deadlocks. Te capacita para diagnosticar por qué una base se atasca bajo carga y desatascarla.',
      prereqs: ['postgres/transacciones'],
      keyPoints: [
        'Qué bloquea qué: locks de fila (UPDATE, SELECT FOR UPDATE) vs locks de tabla (DDL, ALTER).',
        'Deadlocks: por qué ocurren (orden cruzado de adquisición) y cómo prevenirlos ordenando accesos.',
        'SELECT FOR UPDATE y SKIP LOCKED: colas de trabajo y reservas sin pisarse.',
        'Diagnóstico en vivo: pg_locks y pg_stat_activity para ver quién espera a quién.',
        'Los locks se liberan al terminar la transacción: transacciones largas son contención larga.',
      ],
      aiFocus:
        'Un ALTER TABLE generado puede colgarse detrás de una transacción larga y encolar a toda la aplicación: la IA no ve tu carga concurrente. Profundiza en el modelo de locks y en diagnosticar con pg_locks — el «funciona en staging vacío, se cuelga en producción» vive exactamente aquí.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — bloqueo explícito', url: 'https://www.postgresql.org/docs/current/explicit-locking.html' },
        { kind: 'post', label: 'Cybertec — locks y concurrencia en Postgres', url: 'https://www.cybertec-postgresql.com' },
      ],
    },

    // ── Índices y rendimiento (norte-centro) ────────────────────────────────
    {
      id: 'postgres/indices',
      name: 'Índices',
      kind: 'tech',
      area: 'indices-rendimiento',
      x: 42,
      y: 36,
      weight: 3,
      summary: 'Los índices son atajos que hacen que las consultas encuentren datos sin recorrer toda la tabla. Consiste en saber cuáles crear, de qué tipo y cuándo estorban. Te capacita para que una consulta pase de segundos a milisegundos sin cambiar los datos.',
      prereqs: ['postgres/joins-agregaciones'],
      keyPoints: [
        'B-tree como modelo mental: por qué sirve para igualdad y rangos, y por qué el orden de columnas importa.',
        'Indexa según las queries reales, no según el esquema: el WHERE y el ORDER BY mandan.',
        'Índices compuestos, parciales y de expresión: las tres herramientas que resuelven el 90% de los casos.',
        'Cada índice encarece cada escritura: indexar «por si acaso» es pagar por adelantado para siempre.',
        'Conoce los otros tipos y su caso de uso: GIN (jsonb, arrays, texto), BRIN (series temporales enormes).',
      ],
      aiFocus:
        'Pídele índices a la IA y te sugerirá uno por columna del WHERE: plausible y a menudo redundante o mal ordenado. Profundiza en cómo el planificador usa realmente un índice — con ese modelo evalúas cada CREATE INDEX generado en vez de coleccionarlos.',
      resources: [
        { kind: 'libro', label: 'Use The Index, Luke (Markus Winand)', url: 'https://use-the-index-luke.com', format: 'online' },
        { kind: 'doc', label: 'PostgreSQL — índices', url: 'https://www.postgresql.org/docs/current/indexes.html' },
      ],
    },
    {
      id: 'postgres/explain',
      name: 'EXPLAIN y el planificador',
      kind: 'skill',
      area: 'indices-rendimiento',
      x: 62,
      y: 36,
      weight: 3,
      summary: 'EXPLAIN y el planificador son ver cómo Postgres piensa ejecutar tu consulta antes de optimizarla. Consiste en leer el plan e identificar escaneos completos y estimaciones malas. Te capacita para saber POR QUÉ una consulta va lenta, no solo QUE va lenta.',
      prereqs: ['postgres/indices'],
      keyPoints: [
        'EXPLAIN ANALYZE es la verdad: el plan real ejecutado, con tiempos y filas por nodo.',
        'Lee el árbol de dentro afuera: Seq Scan vs Index Scan, Nested Loop vs Hash Join y qué implica cada uno.',
        'La señal de alarma número uno: filas estimadas vs filas reales desviadas por órdenes de magnitud.',
        'El planificador decide por estadísticas: datos desactualizados (ANALYZE) producen planes absurdos.',
        'Apóyate en visualizadores (explain.dalibo.com) para planes grandes, pero aprende a leer el texto crudo.',
      ],
      aiFocus:
        'Esta es LA habilidad Postgres de la era IA: la IA genera la query y tú lees el plan que demuestra si es buena. Un LLM puede comentar un EXPLAIN, pero solo tú lo ejecutas contra datos y estadísticas reales. Profundiza hasta que leer planes te resulte tan natural como leer código.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — using EXPLAIN', url: 'https://www.postgresql.org/docs/current/using-explain.html' },
        { kind: 'doc', label: 'explain.dalibo.com — visualizador de planes', url: 'https://explain.dalibo.com' },
      ],
    },
    {
      id: 'postgres/optimizacion-consultas',
      name: 'Optimización de consultas',
      kind: 'skill',
      area: 'indices-rendimiento',
      x: 50,
      y: 28,
      weight: 2,
      summary: 'La optimización de consultas es reescribir el SQL lento para que vuele, guiándote por el plan. Consiste en índices, reescrituras y ajustar estadísticas. Te capacita para exprimir la base y evitar el reflejo de meter más máquina a la primera.',
      prereqs: ['postgres/explain'],
      keyPoints: [
        'Encuentra lo lento con datos: pg_stat_statements te dice qué queries dominan el tiempo total.',
        'Optimiza lo que importa: la query de 50ms que corre mil veces por minuto gana a la de 2s ocasional.',
        'Técnicas con nombre: reescribir subconsultas correladas, paginar con keyset en vez de OFFSET, evitar funciones sobre columnas indexadas.',
        'Menos datos, menos trabajo: SELECT de columnas concretas y filtros que llegan pronto.',
        'Verifica cada mejora con EXPLAIN ANALYZE antes/después: la optimización sin medida es superstición.',
      ],
      aiFocus:
        'Con el plan y la query delante, la IA propone reescrituras muy buenas; sin datos, receta mitos genéricos. Tu flujo: pg_stat_statements encuentra, EXPLAIN diagnostica, la IA propone, tú verificas midiendo. Profundiza en las dos puntas del flujo — encontrar y verificar son tuyas.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — pg_stat_statements', url: 'https://www.postgresql.org/docs/current/pgstatstatements.html' },
        { kind: 'post', label: 'pganalyze — optimización de queries', url: 'https://pganalyze.com' },
      ],
    },
    {
      id: 'postgres/vacuum-mantenimiento',
      name: 'VACUUM y estadísticas',
      kind: 'tech',
      area: 'indices-rendimiento',
      x: 66,
      y: 22,
      weight: 2,
      summary: 'El VACUUM y las estadísticas son el mantenimiento que mantiene Postgres sano: limpia versiones muertas y afina el planificador. Consiste en entender el autovacuum y cuándo intervenir. Te capacita para que la base no se degrade con el tiempo y las consultas sigan rápidas.',
      prereqs: ['postgres/explain'],
      keyPoints: [
        'VACUUM recicla las tuplas muertas que MVCC deja atrás; ANALYZE refresca las estadísticas del planificador.',
        'Autovacuum funciona solo… hasta que no: tablas grandes con mucho UPDATE necesitan tuning por tabla.',
        'Bloat: tablas e índices hinchados degradan todo en silencio; aprende a medirlo.',
        'El wraparound de transacciones es la única emergencia real de Postgres: entiende qué es antes de verla.',
        'Vigila pg_stat_user_tables: tuplas muertas y último autovacuum te avisan antes del problema.',
      ],
      aiFocus:
        'Cuando «la base va lenta desde ayer» sin cambios de código, la causa suele estar aquí — y la IA solo acierta si le das las señales: bloat, estadísticas, actividad de autovacuum. Profundiza en recoger esa evidencia operativa; con ella, la IA es un DBA consultor excelente.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — rutinas de mantenimiento', url: 'https://www.postgresql.org/docs/current/routine-vacuuming.html' },
        { kind: 'post', label: 'Cybertec — VACUUM, bloat y autovacuum', url: 'https://www.cybertec-postgresql.com' },
      ],
    },

    // ── Administración (este) ───────────────────────────────────────────────
    {
      id: 'postgres/instalacion-configuracion',
      name: 'Instalación y configuración',
      kind: 'tech',
      area: 'administracion',
      x: 80,
      y: 66,
      weight: 2,
      summary: 'La instalación y configuración son poner Postgres en marcha y ajustar sus parámetros clave (memoria, conexiones). Consiste en no dejarlo por defecto cuando importa el rendimiento. Te capacita para operar la base tú mismo en vez de depender siempre de otro.',
      prereqs: [],
      keyPoints: [
        'Monta tu Postgres de práctica (paquete o Docker): romper una base propia enseña más que diez posts.',
        'postgresql.conf sin miedo: shared_buffers, work_mem, max_connections — los cuatro diales que importan primero.',
        'pg_hba.conf controla quién entra y cómo: entiéndelo antes del primer «connection refused».',
        'Los logs son tu caja negra: activa log_min_duration_statement y aprende a leerlos.',
        'Distingue dónde corre: gestionado (RDS, Cloud SQL) vs propio cambia qué configuras tú y qué el proveedor.',
      ],
      aiFocus:
        'La IA sugiere valores de configuración razonables si le describes tu hardware y carga — y recetas de foro de 2012 si no. Profundiza en qué hace cada parámetro clave antes de aplicar un tuning generado: en configuración, cada cambio a ciegas es una avería programada.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — configuración del servidor', url: 'https://www.postgresql.org/docs/current/runtime-config.html' },
        { kind: 'doc', label: 'PGTune — punto de partida de configuración', url: 'https://pgtune.leopard.in.ua' },
      ],
    },
    {
      id: 'postgres/backups-recuperacion',
      name: 'Backups y recuperación',
      kind: 'skill',
      area: 'administracion',
      x: 92,
      y: 58,
      weight: 3,
      summary: 'Los backups y la recuperación son poder volver atrás cuando algo va muy mal, y haberlo probado. Consiste en copias, recuperación en el tiempo y ensayar la restauración. Te capacita para que un borrado o un desastre sea un susto y no el fin del negocio.',
      prereqs: ['postgres/instalacion-configuracion'],
      keyPoints: [
        'Un backup no probado no es un backup: ensaya la restauración completa de forma periódica.',
        'Conoce las dos familias: dumps lógicos (pg_dump) vs backup físico + WAL (pgBackRest) y cuándo cada una.',
        'PITR: recuperar a un minuto antes del desastre es lo que salva del DELETE sin WHERE.',
        'Define RPO y RTO con negocio: cuántos datos puedes perder y cuánto puedes tardar — el diseño sale de ahí.',
        'Automatiza y monitoriza los backups: el backup que falló en silencio hace tres meses no existe.',
      ],
      aiFocus:
        'Los datos son lo único que no se puede regenerar con un prompt: todo lo demás del stack sí. La IA te escribe los scripts de backup y restore, pero decidir RPO/RTO y ENSAYAR la recuperación es tuyo. Profundiza en restaurar hasta que sea rutina aburrida — ese aburrimiento es el objetivo.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — backup y restore', url: 'https://www.postgresql.org/docs/current/backup.html' },
        { kind: 'doc', label: 'pgBackRest — backups serios', url: 'https://pgbackrest.org' },
      ],
    },
    {
      id: 'postgres/seguridad-roles',
      name: 'Seguridad y roles',
      kind: 'skill',
      area: 'administracion',
      x: 82,
      y: 46,
      weight: 3,
      summary: 'La seguridad y los roles son controlar quién accede a qué dentro de la base. Consiste en usuarios, permisos, roles y seguridad a nivel de fila. Te capacita para proteger los datos sensibles y cumplir con el mínimo privilegio.',
      prereqs: ['postgres/instalacion-configuracion'],
      keyPoints: [
        'Mínimo privilegio de verdad: la aplicación NO se conecta como superusuario, jamás.',
        'Roles y GRANT con estructura: roles de grupo por función, usuarios que heredan, permisos por esquema.',
        'La inyección SQL sigue viva: consultas parametrizadas siempre; concatenar entrada de usuario es un incidente.',
        'Cifra en tránsito (SSL) y limita el acceso de red: pg_hba restrictivo y sin puertos abiertos al mundo.',
        'Row Level Security para multi-tenant o datos sensibles: la política vive junto a los datos.',
      ],
      aiFocus:
        'El código generado se conecta como postgres/superusuario y concatena strings en SQL con total naturalidad: son los ejemplos que abundan en su entrenamiento. Profundiza en el modelo de roles y revisa cada credencial y cada query generada con la pregunta «¿qué pasa si esto se compromete?».',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — roles y privilegios', url: 'https://www.postgresql.org/docs/current/user-manag.html' },
        { kind: 'doc', label: 'OWASP — SQL Injection Prevention', url: 'https://cheatsheetseries.owasp.org' },
      ],
    },
    {
      id: 'postgres/replicacion-upgrades',
      name: 'Replicación y upgrades',
      kind: 'tech',
      area: 'administracion',
      x: 68,
      y: 54,
      weight: 2,
      summary: 'La replicación y los upgrades son tener copias vivas de la base para alta disponibilidad y actualizarla sin caídas. Consiste en réplicas, failover y migraciones de versión. Te capacita para operar una base que aguanta caídas y evoluciona sin parar el servicio.',
      prereqs: ['postgres/backups-recuperacion'],
      keyPoints: [
        'Replicación streaming para alta disponibilidad y réplicas de lectura: primario, standbys y su retardo.',
        'Replicación lógica para lo selectivo: replicar tablas concretas, migrar entre versiones, alimentar otros sistemas.',
        'El failover no se improvisa: quién promociona, cómo se redirigen las conexiones, qué pasa con el viejo primario.',
        'Upgrades mayores con plan: pg_upgrade o réplica lógica, ensayado en staging con datos reales.',
        'Una réplica NO es un backup: replica también los errores — el DROP TABLE llega a todas.',
      ],
      aiFocus:
        'La IA explica topologías de replicación muy bien y genera la configuración, pero un failover mal ensayado convierte una avería de minutos en una pérdida de datos. Profundiza en ensayar los procedimientos: en operación, lo que no has practicado no lo sabes, lo hayas generado o no.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — alta disponibilidad y replicación', url: 'https://www.postgresql.org/docs/current/high-availability.html' },
        { kind: 'post', label: 'pganalyze — operación de Postgres en producción', url: 'https://pganalyze.com' },
      ],
    },

    // ── JSON y extensiones (oeste-centro) ───────────────────────────────────
    {
      id: 'postgres/jsonb',
      name: 'JSONB',
      kind: 'tech',
      area: 'extensiones-json',
      x: 30,
      y: 40,
      weight: 2,
      summary: 'JSONB es guardar datos semiestructurados dentro de Postgres con la potencia de indexarlos y consultarlos. Consiste en mezclar lo relacional y lo flexible con criterio. Te capacita para modelar lo que no encaja en columnas fijas sin salir de tu base de siempre.',
      prereqs: ['postgres/tipos-datos'],
      keyPoints: [
        'jsonb (no json) para datos semiestructurados: binario, indexable y con operadores ricos.',
        'Operadores esenciales: ->, ->>, @> y jsonb_path_query para navegar y filtrar.',
        'Índices GIN sobre jsonb: consultas de contención rápidas sobre documentos.',
        'Relacional primero: jsonb para lo genuinamente variable (metadatos, payloads), no para evitar diseñar el esquema.',
        'Valida la forma con CHECK cuando el documento tiene estructura conocida: jsonb no significa «cualquier cosa».',
      ],
      aiFocus:
        'Ante un dato incómodo la IA propone «mételo en jsonb» con facilidad: resuelve hoy y cuesta caro mañana (sin constraints, sin foreign keys, queries opacas). Profundiza en el criterio relacional-vs-documento — esa frontera es una decisión de arquitectura que te pertenece.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — tipos JSON', url: 'https://www.postgresql.org/docs/current/datatype-json.html' },
        { kind: 'post', label: 'Cybertec — JSONB en la práctica', url: 'https://www.cybertec-postgresql.com' },
      ],
    },
    {
      id: 'postgres/extensiones',
      name: 'Extensiones',
      kind: 'tech',
      area: 'extensiones-json',
      x: 6,
      y: 54,
      weight: 2,
      summary: 'Las extensiones convierten Postgres en muchas bases a la vez: geolocalización, colas, criptografía y más. Consiste en conocer las que resuelven tu problema antes de montar otro sistema. Te capacita para hacer más con Postgres y menos piezas en tu arquitectura.',
      prereqs: ['postgres/instalacion-configuracion'],
      keyPoints: [
        'Las extensiones son el superpoder de Postgres: funcionalidad de otro producto sin salir de tu base.',
        'Conoce el kit básico: pg_stat_statements (rendimiento), PostGIS (geo), pg_trgm (búsqueda difusa), pgcrypto.',
        'CREATE EXTENSION y su ciclo de vida: versiones, upgrades y qué permite tu proveedor gestionado.',
        'Antes de añadir otra pieza a tu stack (otra base, otro servicio), mira si una extensión lo resuelve.',
      ],
      aiFocus:
        'La IA conoce el catálogo de extensiones mejor que tú: descríbele el problema y te dirá si Postgres ya lo resuelve. Tu criterio entra en la operación — qué soporta tu hosting, qué coste de mantenimiento añade cada extensión y cuándo de verdad toca otra herramienta.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — extensiones (contrib)', url: 'https://www.postgresql.org/docs/current/contrib.html' },
        { kind: 'doc', label: 'PostGIS — datos geoespaciales', url: 'https://postgis.net' },
      ],
    },
    {
      id: 'postgres/busqueda-vectores',
      name: 'Texto y vectores (pgvector)',
      kind: 'tech',
      area: 'extensiones-json',
      x: 6,
      y: 36,
      weight: 1,
      summary: 'El texto y los vectores con pgvector son buscar por significado dentro de Postgres, base de las apps de IA. Consiste en guardar embeddings y consultar por similitud. Te capacita para montar búsqueda semántica y RAG sin añadir una base de datos vectorial aparte.',
      prereqs: ['postgres/extensiones'],
      keyPoints: [
        'Full-text search nativo: tsvector, tsquery y ranking — buscador decente sin montar Elasticsearch.',
        'pg_trgm para lo difuso: typos y autocompletado con índices trigram.',
        'pgvector para embeddings: búsqueda semántica y RAG con tus datos sin salir de Postgres.',
        'Índices vectoriales (HNSW) y sus trade-offs: recall vs velocidad vs memoria.',
        'Combina filtros relacionales con similitud vectorial: el híbrido es donde Postgres gana a los especializados.',
      ],
      aiFocus:
        'Postgres se ha vuelto pieza de la infraestructura DE la IA: los embeddings de tus aplicaciones LLM pueden vivir junto a tus datos con sus joins y permisos. Profundiza en cuándo pgvector basta y cuándo hace falta un motor dedicado — es una decisión de escala y coste que te tocará tomar.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — full-text search', url: 'https://www.postgresql.org/docs/current/textsearch.html' },
        { kind: 'doc', label: 'pgvector — búsqueda vectorial en Postgres', url: 'https://github.com/pgvector/pgvector' },
      ],
    },

    // ── Postgres con IA (noroeste) ──────────────────────────────────────────
    {
      id: 'postgres/sql-generado-ia',
      name: 'Generar SQL con IA',
      kind: 'skill',
      area: 'postgres-ia',
      x: 22,
      y: 28,
      weight: 3,
      summary: 'Generar SQL con IA es pedirle consultas al modelo para ir más rápido con lo repetitivo. Consiste en describir bien lo que quieres y entender lo que devuelve. Te capacita para acelerar el trabajo con datos sin dejar de ser tú quien manda.',
      prereqs: ['postgres/joins-agregaciones'],
      keyPoints: [
        'Da el esquema en el prompt: CREATE TABLEs, relaciones y filas de ejemplo — sin él, la IA inventa columnas.',
        'Verifica la semántica con un caso pequeño de resultado conocido antes de creerte ninguna cifra.',
        'Sospecha de los clásicos: NULLs en agregaciones, duplicados por join, LEFT convertido en INNER por el WHERE.',
        'Toda query generada que escriba o borre se prueba primero en transacción con ROLLBACK.',
        'Usa la IA también para leer: pegarle una query heredada de 80 líneas y pedir explicación es oro.',
      ],
      aiFocus:
        'El SQL generado acierta la sintaxis casi siempre y la semántica solo a veces — y una query que devuelve datos plausibles pero incorrectos es peor que una que falla. Profundiza en tu protocolo de verificación: esquema en el prompt, caso de control, transacción de prueba. Sin excepciones.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — referencia SQL', url: 'https://www.postgresql.org/docs/current/sql.html' },
        { kind: 'post', label: 'Simon Willison — LLMs y SQL', url: 'https://simonwillison.net' },
      ],
    },
    {
      id: 'postgres/verificar-planes-ia',
      name: 'Verificar planes, no confiar',
      kind: 'skill',
      area: 'postgres-ia',
      x: 10,
      y: 20,
      weight: 3,
      summary: 'Verificar planes y no confiar es no ejecutar a ciegas el SQL que genera la IA. Consiste en revisar el EXPLAIN y comprobar que la consulta es correcta y eficiente. Te capacita para aprovechar la velocidad de la IA sin meter consultas que revientan la base.',
      prereqs: ['postgres/sql-generado-ia', 'postgres/explain'],
      keyPoints: [
        'Toda query generada que vaya a producción pasa por EXPLAIN ANALYZE sobre datos con volumen realista.',
        'La IA optimiza para que la query sea correcta, no para tu distribución de datos: el plan es tu contraste.',
        'Busca las señales: Seq Scan sobre tabla grande, estimaciones desviadas, sorts que caen a disco.',
        'Itera con el plan en el prompt: dale a la IA el EXPLAIN real y pide la reescritura — ese bucle sí funciona.',
        'Presupuesta la verificación: el minuto de EXPLAIN es el seguro contra la query que tumba la base a fin de mes.',
      ],
      aiFocus:
        'Este es el contrato del DBA en la era IA: la IA propone SQL, el planificador dicta sentencia y tú lees el veredicto. Una query generada sin plan verificado es una apuesta con los datos de tu empresa. Profundiza en el bucle generar → EXPLAIN → refinar: es tu flujo de trabajo diario.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — using EXPLAIN', url: 'https://www.postgresql.org/docs/current/using-explain.html' },
        { kind: 'doc', label: 'explain.depesz.com — analiza el plan real', url: 'https://explain.depesz.com' },
      ],
    },
    {
      id: 'postgres/migraciones-ia',
      name: 'Migraciones generadas, revisadas',
      kind: 'skill',
      area: 'postgres-ia',
      x: 18,
      y: 10,
      weight: 2,
      summary: 'Las migraciones generadas y revisadas son no aplicar cambios de esquema propuestos por la IA sin mirarlos. Consiste en comprobar que no pierden datos, no bloquean y son reversibles. Te capacita para evolucionar el esquema con ayuda de la IA sin jugarte la integridad.',
      prereqs: ['postgres/sql-generado-ia', 'postgres/transacciones'],
      keyPoints: [
        'Las migraciones son el código de mayor riesgo que genera la IA: tocan datos y no tienen git revert.',
        'Revisa cada DDL por su efecto operativo: ¿qué lock toma? ¿reescribe la tabla? ¿cuánto tarda con tus filas?',
        'Patrones seguros que la IA no aplica sola: NOT NULL en dos pasos, índices CONCURRENTLY, backfill por lotes.',
        'Ensaya sobre una copia con volumen real y cronometra: staging vacío miente.',
        'Plan de vuelta atrás explícito antes de ejecutar: si el down no es viable, se decide antes, no durante.',
      ],
      aiFocus:
        'Una migración generada puede ser sintácticamente perfecta y aun así tumbar producción veinte minutos por un lock que la IA no consideró. Profundiza en DDL operativo (locks, reescrituras, patrones en dos fases): es la revisión más crítica que harás sobre salida de IA en datos.',
      resources: [
        { kind: 'doc', label: 'PostgreSQL — ALTER TABLE', url: 'https://www.postgresql.org/docs/current/sql-altertable.html' },
        { kind: 'post', label: 'pganalyze — migraciones sin downtime', url: 'https://pganalyze.com' },
      ],
    },
    {
      id: 'postgres/guardian-datos-ia',
      name: 'Guardián de los datos',
      kind: 'milestone',
      area: 'postgres-ia',
      x: 34,
      y: 6,
      weight: 3,
      summary: 'Ser guardián de los datos es el hito de tratar la base con el respeto que merece lo más valioso de una empresa. Consiste en juntar modelado, rendimiento, seguridad y backups con criterio. Te capacita para ser la persona en quien el equipo confía sus datos.',
      prereqs: [
        'postgres/verificar-planes-ia',
        'postgres/backups-recuperacion',
        'postgres/seguridad-roles',
      ],
      keyPoints: [
        'Integras el rol completo: la IA genera SQL y migraciones, tú verificas planes, permisos y reversibilidad.',
        'Tus datos sobreviven a cualquier error: backups ensayados, PITR y procedimientos practicados.',
        'El esquema y las constraints son tu contrato con todas las aplicaciones (y todas las IAs) que toquen la base.',
        'Sigues profundizando donde la IA no llega: tu distribución de datos, tu carga concurrente, tu negocio.',
      ],
      aiFocus:
        'Milestone final: en un mundo donde cualquiera genera SQL en segundos, el valor está en quien garantiza que los datos siguen correctos, seguros y recuperables. Ese criterio — planes verificados, concurrencia entendida, recuperación ensayada — es tu oficio; la sintaxis ya era gratis.',
      resources: [
        { kind: 'doc', label: 'roadmap.sh — PostgreSQL DBA (revisa qué te falta)', url: 'https://roadmap.sh/postgresql-dba' },
        { kind: 'post', label: 'Postgres Weekly — mantente al día', url: 'https://postgresweekly.com' },
      ],
    },
  ],
};
