# Changelog

Qué entró en cada versión publicada de GREBLA. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/): **minor** cuando entra algo nuevo, **patch**
cuando se arregla algo.

> **Cómo se mantiene.** Cada despliegue sube `version` en `package.json`, y ese
> mismo commit añade aquí su entrada. Si la versión que se va a publicar no está
> en este fichero, el gate de release lo corta: una versión sin historia es una
> versión que nadie sabrá explicar dentro de tres meses.
>
> Las versiones anteriores a la 1.207.0 no están desglosadas: el repo llevaba
> más de 200 publicadas cuando se empezó este changelog, y reconstruirlas a
> posteriori habría dado una historia inventada. Para esas, el historial de git
> y las PR son la fuente.

## [1.247.0] - 2026-10-09

### Cambiado

- **A quién se hace O2O sale solo del directorio.** Desaparece la lista manual
  de managers de O2O, también su columna en Administración › Organización ›
  Usuarios. Un manager ve, hace O2O, lleva las acciones y lee las notas privadas
  de quien tiene por debajo en el directorio, y elige a quién va cada O2O en
  «Para quién». La ingesta de notas de 1-1 y la consulta del equipo desde el
  agente siguen la misma regla.

## [1.246.0] - 2026-10-09

### Añadido

- **Cada O2O tiene una pestaña «Para quién».** Muestra tu rama del directorio:
  tus directos vienen marcados y el resto, con de quién depende, se marca o
  desmarca. Registrar, Resumen y Acciones solo ofrecen a las personas marcadas.

### Quitado

- El filtro por grupo y el buscador del registro de O2O de la 1.245.0.

## [1.245.0] - 2026-10-09

### Añadido

- **En O2O, cada manager tiene a toda su rama.** Además de la lista que asigna
  el superadmin, un manager ve y hace O2O a todas las personas que dependen de
  él en el directorio, directas e indirectas. Al registrar un O2O se filtra por
  squad o gremio y se busca por nombre.
- **La ingesta de notas de 1-1 y la consulta del equipo** desde el agente
  cuentan también esa rama.

## [1.244.0] - 2026-10-09

### Añadido

- **Los managers del directorio reciben su equipo al entrar.** La primera vez
  que entra en GREBLA alguien que tiene personas a su cargo en el directorio,
  recibe el rol de líder y queda como manager de O2O de su equipo. Después, la
  lista de O2O se sigue ajustando a mano en Administración › Personas.

## [1.243.0] - 2026-10-09

### Añadido

- **En las retros votar ya no mueve las tarjetas.** Se quedan en orden de
  llegada mientras se vota. Quien facilita las ordena por votos con un botón,
  junto a «Mostrar todas», y puede volver al orden de llegada. El cambio se ve a
  la vez en todas las pantallas.

## [1.242.1] - 2026-10-08

### Arreglado

- **Una baja borrada ya no sigue en la lista.** En Administración de Equipo ›
  Bajas, la lista y la rotación se leen siempre del servidor: si el navegador no
  llega a la base de datos, lo dice en vez de enseñar su copia guardada, que
  podía incluir personas ya borradas. Quien se borra sale de la lista al momento.

## [1.242.0] - 2026-10-07

### Añadido

- **Managers de O2O asignados a mano.** En Administración › Personas, la columna
  «Managers de O2O» dice quién hace O2O a cada persona; puede ser más de uno
  (su EM, su Head, el CTO). Solo los asigna el superadmin y solo se ofrece a
  quien tiene cuenta y está por debajo en la pirámide invertida. Se sembró con el
  reparto que había.
- **El agente consulta el equipo de su manager** (`agentTeam`): con su clave
  obtiene nombre y correo de las personas que su manager lleva, para saber qué
  reuniones son O2O.

### Cambiado

- **El O2O muestra a quien tienes asignado**, no a quien eres dueño de ficha ni a
  toda la organización por ser superadmin. Sus managers de O2O llevan las
  acciones y leen las notas privadas de la persona.
- **La ingesta de un agente solo escribe O2O de personas que tienen asignado a
  su manager**; antes valía cualquier persona con dueño (403 `not_in_scope`).

## [1.241.0] - 2026-10-07

### Cambiado

- **Una clave por agente de ingesta, atada a su manager.** Se retira la clave
  compartida: cada agente (p. ej. el MATIAS de cada manager) tiene la suya y
  solo escribe en los O2O de ese manager. Si un envío dice ser de otro manager,
  se rechaza (403 `manager_mismatch`). Las claves se dan de alta y se retiran
  con `scripts/create-agent-key.mjs`; GREBLA guarda solo su huella.

## [1.240.0] - 2026-10-07

### Cambiado

- **Los O2O, en un solo sitio.** En Equipo › ficha › O2O, «O2O hechos» enseña
  tus O2O con esa persona: los mismos de la herramienta O2O, con lo que es solo
  tuyo separado de lo que ve ella. Desaparece el formulario suelto de
  «Conversaciones». «Privado» sigue para las notas que no son de un O2O.
- **Las notas de 1-1 que traen los agentes son O2O privados** del manager que
  los hizo (campo opcional `managerEmail`), no conversaciones de la ficha, que
  la propia persona podía leer.

## [1.239.0] - 2026-10-07

### Añadido

- **O2O: leer los O2O hechos.** En «Registrar O2O» cada sesión tiene «Ver», y en
  el «Resumen» del periodo cada O2O se despliega igual: «Solo tú» (notas y
  resumen privados) separado de «Lo que ve la persona» (el resumen compartido, y
  si de verdad lo ve).

### Corregido

- **O2O: solo tu equipo.** La herramienta cargaba a toda la organización si eras
  superadmin; ahora salen las personas de tu equipo.

## [1.238.0] - 2026-10-07

### Cambiado

- **Los correos de encuestas salen por Gmail.** La prueba y el envío masivo se
  mandan con la API de Gmail como `noreply@tribbuapp.com`, en vez de Resend,
  cuyo plan cortaba a los 100 correos al día. Si se llega al límite diario de
  Gmail, el envío para y dice cuántos quedan, igual que antes.

## [1.237.0] - 2026-10-06

### Añadido

- **Retros: seguimiento de acciones.** Nueva pestaña «Acciones» con todas las
  acciones de tus retros: responsable, retro y estado. Se filtran por
  pendientes, hechas o todas, se marcan hechas desde la lista y se descargan
  en CSV.
- **Retros: el responsable de una acción se elige entre los participantes**
  de la retro, aunque no sean del equipo de quien la convoca.
- **Retros: votar de un clic.** Con la zona revelada, cada tarjeta lleva su
  «me gusta»: se vota y se retira el voto sin abrirla.
- **Encuestas: seguimiento de los envíos.** Cada enlace apunta si se le envió
  el correo; el paso Envío dice cuántos tienen correo, cuántos faltan y cuántos
  no han respondido, y deja enviar solo a quienes faltan o a todos los que no
  han respondido.

### Corregido

- **Retros: guardar acciones.** Quien convoca una retro sin ser manager veía
  «no tienes permisos» al guardar una acción. Además, quien participa ve las
  acciones de su retro y el Head ve las de su rama.
- **Encuestas: el envío masivo respeta el ritmo y el cupo del proveedor.** Va a
  un correo cada 0,6 s y, al llegar al límite diario, para y dice cuántos quedan.

## [1.236.0] - 2026-10-06

### Añadido

- **Notas privadas del manager en los O2O.** En la ficha de cada persona, O2O
  se parte en «Conversaciones» y «Privado». En Privado su manager (y quien está
  por encima) guarda performance reviews y notas de contexto con la fecha en
  que se hicieron. La persona no las ve nunca: lo garantizan las reglas.
- **Quien tiene ficha se llama como diga la instancia.** Nuevo campo en
  Identidad, «Cómo se llama quien tiene ficha» (por defecto «Tripulante»). Lo
  usan la etiqueta junto al nombre, el selector de vistas y el aviso de vista
  simulada, que antes decían «Ingeniero» a todo el mundo.

## [1.235.3] - 2026-10-06

### Cambiado

- **Encuestas: el correo se redacta al enviar.** El paso Envío del asistente
  tiene dos sub-pestañas: «Redactar correo» (asunto, cuerpo con `{{enlace}}` y
  mensaje de gracias, con su botón Guardar) y «Enviar». Antes estaba escondido
  en una pestaña del paso Preguntas.

## [1.235.2] - 2026-10-06

### Corregido

- **Encuestas: gestores con permiso de la herramienta.** Quien gestiona
  Encuestas por su política (concedida en Permisos) entraba en la pantalla pero
  no podía generar enlaces, enviar ni actualizar el padrón: el servidor solo
  reconocía el permiso antiguo. Ahora reconoce los dos, como las reglas.

## [1.235.1] - 2026-10-06

### Corregido

- **Informe de Notion.** Una ficha que solo cambiaba en sus datos de Notion
  (rol, nivel, equipo…) contaba en «Aplicar N cambios» pero la pestaña Cambios
  salía vacía. Ahora cada uno de esos datos sale en su fila, con antes y después.

## [1.235.0] - 2026-10-06

### Añadido

- **Resultados de encuesta por departamento.** Resultados tiene dos pestañas:
  «Toda la empresa» (lo de siempre) y «Por departamento», que muestra todas
  las preguntas de un departamento solo si llega al mínimo de anonimato. Los
  departamentos con menos respuestas se cuentan como ocultos, sin nombrarlos.

## [1.234.0] - 2026-10-06

### Cambiado

- **Encuestas: un asistente por pasos.** «Gestionar» abre cada encuesta en
  cuatro pasos: Preguntas, Destinatarios, Enlaces y Envío, con Anterior y
  Siguiente. La selección de a quién se envía queda guardada en la encuesta,
  generar solo crea los enlaces que faltan y el borrador se abre desde el
  propio paso de envío. El padrón de empresa pasa a ser una sub-pestaña de
  Destinatarios y desaparecen los botones sueltos de la lista.
- **El padrón está siempre cargado.** Se sincroniza con el directorio cada
  noche y con el botón «Actualizar desde el directorio»; abrir una encuesta
  ya no espera a cargarlo.

### Quitado

- El atajo de pegar o subir un CSV en Enlaces: el CSV se importa en el padrón.

## [1.233.0] - 2026-10-06

### Cambiado

- **Encuestas: el padrón es toda la empresa y la encuesta va a quien se
  marca.** El padrón se sincroniza solo con el directorio al abrirlo (lo
  añadido a mano se conserva). Por defecto no va nadie: arriba Todos/Ninguno y
  un check por departamento —a medias si solo hay parte marcada—, debajo cada
  persona. Solo se generan enlaces para las marcadas.

## [1.232.0] - 2026-10-05

### Añadido

- **Encuestas: el padrón se carga desde el directorio.** «Cargar desde el
  directorio» trae a todas las personas activas (con Notion, el directorio
  entero) con su departamento y su alta, igual que el CSV.
- **Encuestas: a quién se envía, persona a persona.** En Participantes, el
  padrón sale como lista con casillas: por defecto van todas, se desmarca a
  quien no, y «Marcar/Desmarcar todas» actúa sobre lo filtrado.

## [1.231.0] - 2026-10-05

### Añadido

- **Logo para el tema oscuro.** La instancia puede tener un logo para cada
  tema (Admin › Identidad): la cabecera enseña el del tema activo y cambia al
  conmutarlo. Sin versión oscura, el oscuro usa la clara.

### Cambiado

- La versión oscura de los colores de marca ya no se queda en el mínimo justo:
  se aclara hasta leerse como la paleta oscura de GREBLA.

## [1.230.0] - 2026-10-05

### Añadido

- **Un solo organigrama: la pirámide invertida de personas.** Cada capa es un
  Level de Notion —C-level en la base, sosteniendo al resto; IC arriba— en su
  propio recuadro con su etiqueta, y cada persona lleva su rol y el color de su
  departamento. Sin Notion, la capa sale de su rol. La vista «Estándar» se va.
- **Colores de marca de la instancia** (Admin › Identidad › Colores): un color
  por marca. Si alguno no se lee bien en el tema claro o en el oscuro no se
  guarda, y se dice qué par falla y con qué ratio. La versión oscura sale sola.
- **Cómo conectar un Notion propio**: `docs/NOTION.md` explica qué estructura
  tiene que tener la base y cómo conectarla. La base es la de cada instancia.

### Cambiado

- Los gremios son solo de los departamentos que los tienen (hoy, Tech): en el
  resto la ficha ya no los pide.
- Con el censo en Notion, Equipo ya no ofrece alta manual ni Transferir: las
  personas y su manager vienen de allí. Sin Notion, todo sigue siendo manual.

### Arreglado

- El ingeniero solo puede escribir su **propuesta** de Role Mirror; la versión
  que manda es la del manager, también en las reglas.

## [1.229.0] - 2026-10-03

### Añadido

- **El censo viene de Notion.** En una instancia conectada, Admin › Notion
  simula la sincronización con el Directorio de Notion, enseña qué cambia (con
  el antes y el después de cada campo, y de quién a quién cambia cada manager)
  y solo entonces deja aplicarla. Quien está en Notion y no en GREBLA queda
  pre-invitado. Nunca se da de baja ni se borra a nadie; un email repetido o un
  ciclo de managers paran el lote entero, y una ficha que se llama casi igual
  no se duplica: se avisa.
- **Admin › Usuarios: «Solo sin departamento».** Lo que falta es el
  departamento, no el gremio: el filtro deja a quien está en genérico o en una
  rama que ya no existe, y ahí mismo se le asigna.

### Cambiado

- **La persona se edita en un solo sitio.** Con Notion conectado, nombre,
  email, departamento, manager, alta y externo se ven en la ficha y en Admin ›
  Usuarios pero no se editan: vienen de Notion, y las reglas lo impiden también
  fuera de la pantalla. La baja sigue siendo un acto explícito de GREBLA.
- Mi espacio ya no tiene «Editar mi ficha»: duplicaba la ficha y dejaba a un
  manager subirse el nivel a sí mismo.
- El color de cada departamento es dato de la instancia, no del código.

## [1.228.0] - 2026-09-29

### Añadido

- **Cada persona ve en «Mi espacio» lo que hay anotado en su ficha**: lo que su
  manager escribió después de hablar y lo que dejaron ahí los agentes. Ya era
  legible por ella —las reglas siempre la incluyeron en su propio subárbol—, solo
  que no se enseñaba en ninguna pantalla. Y lo que no se ve no se puede corregir.

  De cada nota se dice **de dónde viene antes del texto**: si la escribió una
  persona, con su nombre; si la trajo un agente, con qué sistema y un enlace al
  origen. Las notas antiguas sin autor lo dicen, en vez de atribuirse a nadie.

  Lo que **no** cambia: las sesiones de O2O siguen en su sitio y la preparación
  privada del manager sigue siendo suya. La nota al pie ahora distingue las dos
  cosas en vez de sugerir que no se ve nada.

### Cambiado

- **El overlay de «Tiempo» sale del juego.** El manager tenía dentro del mapa una
  tabla con el tiempo de juego de su gente; esa gestión ya vive en el Seguimiento
  del plan, y tenerla ahí obligaba a entrar en el juego para mirar algo que no es
  jugar. El cronómetro sigue midiendo igual y cada persona sigue viendo el suyo
  en su ficha.

## [1.227.0] - 2026-09-28

### Añadido

- **«Entrega» puede pedir una lectura con IA** de lo que se está viendo:
  veredicto, resumen, causas probables y qué se puede hacer. Va **debajo** de los
  números, nunca en su lugar —lo opinado se lee más fácil que una tabla—, se
  genera con el mismo resumen que hay en pantalla y hay **una sola vigente**: la
  lanza quien gobierna y la lee todo el equipo, para que se discuta sobre lo
  mismo. De lo que está sin fuente o sin dato no saca conclusiones: puede decir
  que todavía no se puede juzgar.

### Arreglado

- **Una persona que falla ya no tumba el Mapa del equipo.** Un permiso mal puesto
  sobre una sola ficha dejaba la pantalla en blanco para todo el equipo. Ahora
  las demás filas salen enteras y la suya sale marcada, diciendo que no se
  pudieron leer sus lecturas — no con rayas, que en esa tabla significan otra
  cosa: que a esa persona no la ha medido nadie.

### Eliminado

- **El backend de DORA y LEAN**, que quedó vivo cuando se retiraron las
  pantallas: cuatro Cloud Functions y las reglas de sus colecciones, 831 líneas.
  No se borra ningún dato. Se conservan la clave de Linear —la usa Scrum Poker— y
  la interpretación con IA, ahora en Entrega.

## [1.226.0] - 2026-09-28

### Añadido

- **Cada persona puede tener un gremio principal.** Militar en dos gremios es
  normal y sigue siendo posible; lo que no puede ser es contarla dos veces. El
  principal es el que manda al agrupar por gremio y se elige en su ficha, en
  Organización › Gremios, solo cuando está en dos o más. Mientras no se elija, se
  dice —no se elige por ti—.
- **Mi Role Mirror enseña el nivel de carrera con su sub-nivel** (`L1-2`), y
  cuánto lleva cumplido del nivel siguiente. Es el mismo número que ve el manager
  en el Seguimiento del plan, porque ahora sale del mismo sitio. Si el manager lo
  ajustó a mano, se dice, con su nota, y el cálculo sigue a la vista.
- **La instancia puede llevar su propio logo** en la cabecera, en lugar de la
  marca de GREBLA. Se sube desde Organización › Identidad (SVG o PNG, hasta
  96 KB). Sin logo propio se queda el de GREBLA: nunca una cabecera vacía.

## [1.225.1] - 2026-09-27

### Arreglado

- **El Mapa del equipo abre mucho más rápido.** Pedía las lecturas de cada
  persona esperando a que terminaran las de la anterior: con 40 fichas eran 40
  rondas encadenadas contra la base de datos, y de ahí que tardara tanto en
  aparecer. Ahora se piden todas a la vez. El orden de las filas no cambia.

## [1.225.0] - 2026-09-27

### Cambiado

- **DORA y LEAN se retiran: todo está en «Entrega».** Sus métricas las calcula
  ahora el portal, que es quien tiene las fuentes, y tenerlas en tres sitios
  obligaba a cruzarlas a mano. Los enlaces guardados a `/tools/dora` y
  `/tools/lean` —también con sus anclas de administración— llevan a Entrega.

  **Se midió antes de retirar:** en producción, DORA tenía **cero repos** dados
  de alta y LEAN tenía 13 equipos configurados pero **cero métricas** calculadas.
  Ninguna de las dos enseñaba un solo número, así que no se pierde ningún dato.

  La vista por equipos de LEAN no se sustituye: la granularidad por equipo no
  describe la organización —«miramos por repos, no por equipos»— y los 13 que
  salían eran restos de una estructura anterior.

### Arreglado

- **La administración de Equipo no leía el ancla de la URL**, así que un enlace
  guardado a `#settings` aterrizaba en la página correcta y en la pestaña
  equivocada. Venía de cuando esas secciones se mudaron al panel, y lo destapó
  el test que comprobaba justo eso al mudarse él también.

## [1.224.0] - 2026-09-27

### Añadido

- **«Entrega»**, en `/tools/entrega`: despliegues, revisión y flujo de las
  últimas 12 semanas, leídos del portal. Con la foto global, una línea de
  tendencia por métrica y el detalle por repositorio.

  **Los cuatro DORA salen siempre**, incluidos los dos que esta organización no
  puede medir, con su motivo («falta registro de incidentes»). Un hueco que se
  dice es información; un hueco que se quita invita a rellenarlo con la métrica
  de al lado, y la de al lado mide otra cosa.

  **Los avisos van pegados al número**, no al pie: los repos que cuentan
  despliegues sin señal de estado suben la frecuencia y nunca mueven la tasa de
  fallo, y eso tiene que leerse donde se ve el número. Los que ni entran en la
  cuenta —los de móvil, que suben a las stores a mano— salen con su motivo.

  Si no se puede leer, **se dice qué pasó** —el portal aún no ha calculado, no
  reconoce la credencial, no responde— y no se pinta nada. Una pantalla de ceros
  se lee como «no entregamos», que es una respuesta y no un error.

### Arreglado

- La URL del portal se leía con un parámetro de Firebase que **pregunta por
  teclado** cuando no tiene valor, y dejaba el emulador y CI colgados esperando
  un input que nadie iba a teclear. Ahora es una variable de entorno.

## [1.223.0] - 2026-09-27

### Añadido

- **GREBLA lee las métricas DORA y LEAN del portal**, que es quien tiene las
  fuentes, en vez de calcularlas. Entra el dominio que las interpreta y la Cloud
  Function que las trae; la pantalla va detrás.

  Tres reglas, las tres nacidas de errores reales: **ausente no es cero** (lo que
  no viene sale con raya, porque un «0 %» parece una semana perfecta cuando
  significa que nadie midió); **lo que no tiene fuente no se rellena** con la
  métrica de al lado; y **una tasa sin base no es una tasa** —un 0 % sobre un
  solo despliegue con señal se dice como recuento, no como porcentaje—.

  Una versión de contrato distinta **falla en alto** en vez de leerse a medias:
  leer una forma desconocida produce ceros silenciosos, que es la peor manera de
  enterarse de un cambio. Y un fallo al leer **nunca devuelve listas vacías**: la
  pantalla podrá decir «no se han podido leer» en vez de pintar cero actividad,
  distinguiendo «el portal aún no ha calculado» de «no reconoce la credencial».

  El token vive como secreto de la función y no llega nunca al navegador.

## [1.222.0] - 2026-09-26

### Cambiado

- **El rótulo de Equipo usa el nombre que le da cada casa.** Con «Cuando se ve a
  todo el mundo, se llama» configurado en Identidad, ver más allá de tu gente se
  llama así —«Toda la tribbu», por ejemplo— en vez de «Toda la organización». Sin
  configurar, el defecto del producto sigue ahí; «Mi equipo» es tuyo lo llame como
  lo llame la organización.

  La identidad se lee junto al resto para poner el rótulo **una sola vez**:
  ponerlo por defecto y corregirlo después haría parpadear el título, que es
  medio bug que ya evitaba servir el nombre neutro.

## [1.221.0] - 2026-09-26

### Añadido

- **Identidad de la instancia**, en Administración › Organización › **Identidad**.
  GREBLA se despliega una vez por organización, así que sus rótulos por defecto
  son los generales del producto; aquí cada casa pone los suyos: cómo se llama,
  cómo llama a «verlo todo», quién va en la corona del organigrama y con qué
  dominio de correo entra su gente.

  **El dominio de empleados y la corona ya se leían desde hacía meses y no tenían
  pantalla**: se editaban a mano en la consola de Firestore, que es como decir
  que no se editaban.

  Dejar un campo en blanco **no** deja el rótulo vacío: significa «usa el del
  producto», y cada campo dice cuál es ese defecto antes de guardar. Lo que se
  guarda es lista blanca y saneado —el dominio, en minúsculas y sin arroba—, y la
  caja enseña lo que de verdad quedó, no lo que se tecleó.

## [1.220.0] - 2026-09-26

### Cambiado

- **El nombre de Equipo dice a quién estás viendo.** Se llamaba «Tu equipo»
  siempre, y eso hacía dos cosas malas a la vez: no decía lo que había dentro
  —había que abrirla para saberlo— y la mitad de las veces era falso, porque
  quien gobierna la instancia abría «Tu equipo» y le salía la organización
  entera. Ahora el rótulo es **«Mi equipo»** o **«Toda la organización»** según
  el alcance, y cambia con el conmutador.

  La página se sirve con el nombre **neutro** («Equipo»), que es el único
  verdadero en los dos casos: así nunca se lee un nombre falso mientras carga, y
  sin JavaScript sigue habiendo encabezado.

- **Ninguna sección se llama de forma genérica.** «Personas» pasa a **«Personas
  activas»**, que es lo que hay dentro, y «Configuración» pasa a **«Avisos y
  almacenamiento»**: un rótulo que no dice de qué obliga a abrirlo para saber si
  es lo que buscas.

## [1.219.0] - 2026-09-26

### Cambiado

- **Una sola tabla para el plan de desarrollo.** «Equipo › Carrera» contaba la
  mitad de la historia —nivel actual, sub-nivel, nivel objetivo, ciudadanías,
  certificados— y el Seguimiento del plan contaba la otra —isla, paradas, ruta,
  dedicación—. Mirar a una persona obligaba a abrir dos pantallas y cruzarlas a
  mano. Ahora está todo en **Seguimiento del plan de desarrollo**, y la pestaña
  «Carrera» de Equipo desaparece.

  El ajuste a mano del sub-nivel se muda con ella y vive en la ficha de la
  persona, no en una celda: es un juicio del manager, con su nota, y ahí se lee y
  se escribe con sitio. Un enlace guardado a `#career` lleva al sitio nuevo.

- **La gestión de Equipo sale de la herramienta.** «Bajas» y «Configuración»
  —cadencia de avisos, umbral de bus factor, almacenamiento— viven en
  `/tools/team/admin`, con su tarjeta en el panel y una puerta que pide gestionar
  equipos. De «Ajustes» se retiran los catálogos de áreas, gremios y labels:
  eran los mismos documentos que ya gestiona Administración › Organización.

- **El inicio marca lo que no ve todo el mundo.** Las tarjetas que solo se
  ofrecen a quien lidera llevan la marca «solo quien lidera», para que quien
  gestiona sepa si lo que está viendo lo ven también los ingenieros. Lo que ve
  todo el mundo no se marca: si se marcara todo, la marca no diría nada.

## [1.218.0] - 2026-09-26

### Cambiado

- **El inicio se agrupa por propósito**, en cinco grupos con encabezado
  discreto: Lo tuyo, Tu equipo, Cómo estamos, Cómo entregamos y La casa. Con 18
  herramientas, saber a quién sirve cada una ya no ayudaba a encontrarla; saber
  para qué sirve, sí.

  **Desaparecen las pestañas TRIBBU / Ingeniería.** Dos ejes de agrupación a la
  vez obligan a adivinar en qué pestaña vive cada cosa antes de buscar el grupo.
  La decisión queda registrada en un ADR, y el de las tres capas pasa a
  sustituido.

  Un grupo sin tarjetas visibles no se pinta, y si no queda ninguna se dice, en
  vez de dejar un hueco. Una herramienta sin grupo sigue apareciendo: el código
  manda sobre qué hay, y olvidar el grupo no puede esconder nada.

- **El editor del orden muestra el inicio agrupado**, se ordena dentro de cada
  grupo y la numeración se reinicia en cada uno. Las tarjetas que no ve todo el
  mundo salen marcadas: esa lista son todas las tarjetas, no las de quien
  ordena.

## [1.217.0] - 2026-09-25

### Añadido

- **El superadmin coloca las tarjetas.** En `/admin/tarjetas` se ordenan las del
  inicio y las del panel, se **destaca** una tarjeta y se le da **color** de una
  paleta. Ese orden y ese aspecto los ve toda la organización; cada persona
  sigue viendo solo sus tarjetas, en la posición que les des.

  El color se elige de una paleta cerrada y solo tiñe el fondo: el color del
  texto no se toca, así que el contraste sigue siendo el que ya cumple AA en
  claro y en oscuro. Destacar va aparte del color, para poder señalar algo sin
  teñirlo.

  El código manda sobre **qué** tarjetas hay; la configuración solo dice en qué
  orden y con qué aspecto. Una herramienta nueva aparece aunque nadie la haya
  colocado, y una clave guardada que ya no existe se ignora: un orden guardado
  no puede esconder una herramienta.

### Cambiado

- El catálogo de tarjetas del inicio y del panel vive ahora en un módulo de
  datos, no dentro de las páginas, con un guard que comprueba que ninguna quede
  sin nombre o destino y que el mapa de políticas no apunte a rutas que no
  existen.

## [1.216.0] - 2026-09-25

### Añadido

- **Seguimiento del plan de desarrollo.** En `/tools/career-map/admin` (con su
  tarjeta en el panel y su pestaña «Seguimiento» para quien gestiona) se ve por
  dónde va el plan de cada persona y cuánto le dedica: la lista del equipo
  ordenada por **quién lleva más tiempo sin tocarlo**, y al pinchar su isla,
  paradas, ruta, objetivo y su dedicación —días activos, media por día activo,
  total y cuándo fue la última vez—. Una pestaña «Conjunto» lo pone en tabla
  para comparar.

  No se mide nada nuevo: los datos ya estaban en la ficha de cada persona (su
  viaje y el cronómetro de juego). Lo que cambia es que ahora se pueden mirar
  juntos. Donde no hubo medida va una raya y no un cero, y la ventana de días es
  de 30 porque es lo que guarda el cronómetro.

## [1.215.0] - 2026-09-25

### Cambiado

- **Role Mirror separa lo tuyo de lo que administras.** Al entrar en la
  herramienta ya no sale un desplegable para elegir a alguien del equipo: sale
  **tu propio perfil**, seas ingeniero, manager o superadmin, en modo propuesta
  (la versión que cuenta la fija tu manager). Gobernar añade una puerta, no
  cambia lo que la herramienta es.

### Añadido

- **Administración de Role Mirror con la lista de ingeniería.** En
  `/tools/role-mirror/admin`, la gente a la izquierda —con quién está aún sin
  perfil— y, al pinchar, su propuesta pendiente, el perfil que cuenta y su
  histórico de mediciones, con quién tocó cada una. El panel de siempre
  (comparativa, distribución de roles y CSV) sigue ahí, en su pestaña
  «Resumen», y la administración tiene ya su tarjeta en el panel.

### Arreglado

- Las dos mitades de esa pantalla se regían por criterios de acceso distintos:
  el panel reenviaba a la home por su cuenta sin mirar la política de la
  herramienta. Ahora manda la política, una sola vez.

## [1.214.0] - 2026-09-24

### Cambiado
- **Role Mirror lista solo a la gente de ingeniería.** Antes ofrecía a cualquier
  persona del ámbito de quien miraba, incluida la que entra a GREBLA y todavía
  no está clasificada: aparecía en una lista de evaluación quien ni siquiera se
  sabe de qué equipo es. Ofrecer a alguien de otra rama, además, invita a
  rellenarle un perfil con un marco que no es el suyo.

## [1.213.0] - 2026-09-24

### Añadido
- **El Career path explica qué es un L1-1, un L1-2 y un L1-3**, con sus
  porcentajes: 50 % para el `-2`, 80 % sostenido en dos valoraciones para el
  `-3` y 100 % para plantear la subida. Con un ejemplo numérico, y dejando
  claro que el porcentaje es suma de **pesos** (no de casillas), que la
  valoración es binaria y que el mapa de carrera no entra en esa cuenta. Sale
  en la herramienta y en «Mi espacio › Mi carrera › La escalera».

## [1.212.0] - 2026-09-23

### Cambiado
- **La curva «Progresión en el tiempo» se dibuja con las valoraciones**, no con
  los certificados del mapa de carrera. Era el último sitio donde la formación
  contaba como progresión de nivel. Cada valoración cerrada es un punto, con su
  porcentaje y el sub-nivel de ese día; sin valoraciones cerradas no se dibuja
  nada, en vez de inventar una curva con el juego.

## [1.211.0] - 2026-09-23

### Cambiado
- **Quien administra una herramienta también entra en ella**, aunque no esté en
  su audiencia: administrar algo donde no se puede entrar no significa nada. Un
  permiso individual «no» sigue mandando sobre todo lo demás.
- **Encuestas de clima deja de anunciarse a toda la organización.** Se responde
  por enlace anónimo y sin login, así que nadie entra desde el hub salvo para
  gestionarla: ahora la ve quien la gestiona. Aplicado también a la política
  viva de las dos instancias.

## [1.210.1] - 2026-09-23

### Corregido
- **La ingesta encuentra a la persona por su cuenta vinculada.** En GREBLA el
  identificador es el `uid` y el campo `email` solo está relleno en las fichas
  que nacieron de una invitación: en la instancia real, 7 de 41 personas
  activas. La ingesta respondía «no existe» a casi todo el mundo. Ahora, si no
  hay ficha con ese correo, se busca la cuenta de Firebase Auth que lo tenga
  **verificado** y su ficha por `uid`.

## [1.210.0] - 2026-09-22

### Añadido
- **Ingesta desde agentes externos.** Un agente autorizado puede crear en la
  ficha de una persona la nota de un **1-1 o un catchup** que haya detectado por
  su cuenta (`ingestConversation`, con clave compartida). Escribe en
  `/people/{id}/conversations` y en ningún otro sitio: el O2O privado del
  manager, la Marea, las encuestas, los kudos y las notas de acompañamiento
  quedan fuera. La nota llega marcada como **automática**, con su origen
  enlazado, y el manager puede editarla o borrarla: es un borrador, no un
  registro cerrado. Reenviar la misma nota no duplica, porque su id sale del
  origen.

## [1.209.0] - 2026-09-22

### Añadido
- **Documentación: descargar un documento.** Cada documento tiene su botón
  «↓ Descargar» junto al de abrir. La descarga va por la misma puerta que el
  visor (`serveDoc` con `?download=1`), con el mismo token de un solo documento
  y caducidad de 4 h, en vez de la URL de Storage, que lleva un token eterno y
  reenviable. El nombre del fichero se sanea antes de ir a la cabecera.

## [1.208.0] - 2026-09-22

### Añadido
- **Sub-niveles por cumplimiento de expectativas** (L1-1 / L1-2 / L1-3). La
  progresión dentro del nivel sale de las expectativas del nivel siguiente
  valoradas por el manager, no del avance en el mapa de carrera: formarse ya no
  sube de nivel.
  - Cada expectativa lleva **peso** (entero, 1 por defecto) y marca de
    **imprescindible**, editables en el panel; la valoración es binaria.
  - Cortes en el 50 % y el 80 %; el `.3` exige mantener el 80 % en dos
    valoraciones seguidas; al 100 % se propone subir de nivel.
  - La valoración se guarda por nivel en `/people/{id}/careerAssessments/{levelId}`,
    con autor y fecha por dimensión y cierres que solo se añaden.
  - El manager valora desde la ficha, el O2O muestra la progresión y qué falta,
    y los badges de los listados salen de lo valorado.

## [1.207.2] - 2026-09-20

### Corregido
- **Poker: el gremio se elige junto a «Solo ver» y se puede cambiar.** El
  asiento guarda aparte los gremios de la ficha, así que elegir otro sustituye
  al anterior en vez de acumularse, y volver a entrar ya no pisa la elección. Si
  ya se había votado, el voto se reemite con el gremio nuevo.
- **Poker: la mesa se ve aunque no se haya sentado nadie**, con sus sitios sin
  ocupar, en vez de desaparecer y volver —con salto de layout— al entrar la
  primera persona.

## [1.207.1] - 2026-09-18

### Añadido
- **Poker: quien vota puede reabrir la historia de Linear** de la tarea en su
  pantalla, aunque el organizador la haya cerrado para todos.

## [1.207.0] - 2026-09-18

### Añadido
- **Poker: sub-issues en Linear por gremio.** El PM envía las estimaciones de
  una tarea cerrada y se crea una sub-issue por gremio con su estimación, más un
  comentario resumen en la historia padre. Idempotente y con cerrojo.

## Anterior a 1.207.0

Sin desglosar. Ver el historial de git (`git log`) y las PR del repositorio.
