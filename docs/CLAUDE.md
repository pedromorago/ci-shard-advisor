# CLAUDE.md — Instrucciones para trabajar en este repo

## Qué es este proyecto

CI Shard Advisor: herramienta **para equipos Cypress**. Lee los reports de la última ejecución (uno por contenedor) y devuelve la situación actual medida más el movimiento elegido con su coste (reequilibrar gratis, misma espera más barato, el codo…), con las listas de specs por contenedor y el YAML de CI listos para aplicar — sin Cypress Cloud.

## Fuente de verdad

**`docs/spec.md` manda sobre el README, sobre el código existente y sobre cualquier idea nueva.** Antes de implementar, localiza el FR correspondiente en la spec; una feature está terminada cuando cumple sus criterios de aceptación, tiene tests y pasa `pnpm test && pnpm typecheck`. Si una petición contradice la spec, señálalo antes de programar. Si la spec no cubre algo, propón el cambio de spec primero (commit separado).

## Reglas de arquitectura (no negociables)

1. Hexagonal: nada de `packages/core` importa de `apps/` ni de frameworks (React, Fastify, Commander, `fs`). Los adaptadores importan del core, nunca al revés.
2. El scheduler trabaja con `readonly number[]` y asignaciones por índice. La traducción desde tareas es del normalizer.
3. El motor nunca miente: sin óptimo certificado → `optimal: false` + lower bound + gap. Ninguna cota inferior puede superar al óptimo.
4. El lector soportado en el pitch es Cypress (Module API y mochawesome). Los lectores Playwright y JUnit, y el modelo de workers, se quedan en el código (con sus tests) pero no se documentan ni se amplían.
5. La web procesa todo en cliente. Ninguna petición de red con el contenido del report, nunca.

## Convenciones de código y tests

- TypeScript estricto, ESM, `moduleResolution: Bundler`. pnpm workspaces (config de builds en `pnpm-workspace.yaml`, no en `package.json`).
- Vitest. Aleatoriedad solo con el PRNG sembrado de `tests/helpers/random.ts` (mulberry32); `Math.random()` prohibido en tests.
- Propiedades del scheduler se verifican contra el oráculo de fuerza bruta (`tests/helpers/brute-force.ts`) en instancias pequeñas.
- Formateo de salidas determinista: sin locale, sin fechas, sin reloj (snapshots estables).
- Commits convencionales (`feat(core): ...`, `fix(web): ...`), pequeños, en ramas `feat/*` que se mergean a `main` con CI verde.

## Comandos

```bash
pnpm install
pnpm test          # toda la suite
pnpm typecheck     # estricto, sin errores
```

## Qué no hacer

- No añadir afirmaciones al README que no estén implementadas y testeadas.
- No introducir dependencias pesadas en el core (debe seguir corriendo en navegador).
- No "arreglar" el `avgBound` con `Math.ceil` (ver docs/architecture.md: rompería la cota con duraciones fraccionarias).
- No eliminar ni degradar la honestidad del gap del B&B para que los números "queden mejor".
- No renombrar flags de la CLI fuera de lo previsto en la spec (sección 7): los gates son `--gate-*`, los objetivos `--objective`/`--max-feedback`/`--budget`.

## Contexto del autor

Proyecto de portfolio de un QA Automation Engineer en búsqueda activa. Prioridades: (1) que el repo cuente una historia de ingeniería defendible en entrevista, (2) commits progresivos y legibles, (3) testing ejemplar. Cuando haya que elegir entre "más features" y "mejor explicado/testeado", gana lo segundo.
