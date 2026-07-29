# Contribuir a GREBLA

GREBLA es software libre (licencia [MIT](./LICENSE)). Se agradecen issues, ideas y pull requests.

## Reportar un bug o proponer una mejora

Abre un **issue** describiendo:
- Qué esperabas y qué pasó (para bugs: pasos para reproducirlo).
- Para mejoras: el problema que resuelve y, si puedes, una propuesta.

## Proponer cambios (Pull Request)

1. **Fork** del repo (o una rama, si ya eres colaborador).
2. Una **rama por tarea** desde `main`: `feat/descripcion-corta` o `fix/descripcion-corta`.
3. **Conventional Commits** en minúscula: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
4. PR **atómica**: un solo propósito, pequeña, y que **compile y pase los tests por sí sola**.
5. Antes de abrir la PR: `npm test` y `npm run check` en verde.
6. Abre la PR contra `main` describiendo el qué y el porqué.

> Nota: el proyecto usa el método de trabajo descrito en `CLAUDE.md` (context-first, TDD,
> revisión antes de commitear). No es obligatorio para contribuciones externas, pero ayuda.

## Convertirse en colaborador / maintainer

Si quieres ayudar a mantener GREBLA de forma continua (por ejemplo, para sostener la instancia
de tu organización):

1. Abre un **issue** presentándote e indicando tu **usuario de GitHub**, o contacta al owner
   (**@manufosela**).
2. El owner te añade desde **Settings → Collaborators and teams → Add people**, con tu handle y
   permiso **Write** (o **Maintain** para gestionar issues/PRs y releases).
3. Desde entonces puedes crear ramas y PRs directamente en el repo, sin necesidad de fork.

## Instancias

GREBLA se despliega como **una instancia Firebase por organización** (ver
[`docs/INSTANCIAS.md`](./docs/INSTANCIAS.md)). El código es común a todas; una mejora en `main`
llega a cada instancia con `git pull` + su build. Los **datos** de cada instancia son de su
organización, nunca del repositorio.
