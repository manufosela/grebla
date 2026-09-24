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
