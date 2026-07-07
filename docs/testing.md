# Estrategia de testing

Este proyecto es, ante todo, una demostración de **QA/SDET**. Cada capa se prueba
con la técnica que mejor encaja. Este documento cataloga esas técnicas, por qué se
usan y dónde vive cada una, para poder estudiarlas y mejorarlas.

## Principios transversales

- **Determinismo.** Nada de `Math.random()` ni relojes en los tests. Los datos
  aleatorios salen de un PRNG con semilla (`mulberry32`), así un fallo es siempre
  reproducible. El formateo de salida evita `toLocaleString`/fechas por la misma
  razón (snapshots estables).
- **Pureza y testabilidad por diseño.** El core es puro (`readonly number[]` →
  resultados por índice), la CLI recibe I/O inyectada (`run(argv, io)`), la API se
  prueba en proceso con `inject()`. Ninguna prueba necesita disco ni red.
- **El motor nunca miente.** Si un algoritmo no puede certificar un resultado,
  lo dice (`optimal: false` + gap). Hay tests que fuerzan y verifican ese camino.

## Técnicas por capa

### 1. Test oracle (fuerza bruta)
Un solver exponencial trivialmente correcto que sirve de "verdad de referencia"
para validar el Branch & Bound, que es demasiado listo para comprobarlo a mano.
→ [`packages/core/tests/helpers/brute-force.ts`](../packages/core/tests/helpers/brute-force.ts),
[`brute-force.test.ts`](../packages/core/tests/unit/brute-force.test.ts)

### 2. Property-based testing
En vez de casos fijos, cientos de instancias aleatorias deterministas afirmando
*propiedades* invariantes (no salidas concretas): el B&B da el mismo óptimo que el
oracle; LPT nunca baja de la cota inferior.
→ [`branch-and-bound.test.ts`](../packages/core/tests/unit/branch-and-bound.test.ts)

### 3. Invariantes
"El motor nunca miente" (si `optimal:true`, coincide con el oracle), conservación
del trabajo en el simulador, monotonía de la frontera (más shards ⇒ tiempo no sube,
coste no baja).
→ [`workers.test.ts`](../packages/core/tests/unit/workers.test.ts),
[`frontier.test.ts`](../packages/core/tests/unit/frontier.test.ts)

### 4. Testing diferencial y metamórfico
- **Diferencial:** el simulador (modelo real, greedy) nunca bate el óptimo del
  Branch & Bound sobre el mismo conjunto.
- **Metamórfico:** reescalar un eje de la frontera **no** mueve el codo (porque se
  normaliza); el mismo multiconjunto en distinto orden puede tardar más.
→ [`workers.test.ts`](../packages/core/tests/unit/workers.test.ts),
[`elbow.test.ts`](../packages/core/tests/unit/elbow.test.ts)

### 5. Validación de entrada (parsers)
Un buen parser no solo acepta lo válido: **falla bien**. Una batería de reports
malformados (JSON inválido, tipos incorrectos, campos ausentes) verifica que el
error señala la **ruta del campo** culpable.
→ [`parser.test.ts`](../packages/core/tests/unit/parser.test.ts)

### 6. Snapshot testing
Las salidas de presentación (texto CLI, Markdown) se congelan con *inline
snapshots*; cualquier cambio de formato salta como diff. Requiere determinismo
total.
→ [`exporters-text.test.ts`](../packages/core/tests/integration/exporters-text.test.ts),
[`exporters-markdown.test.ts`](../packages/core/tests/integration/exporters-markdown.test.ts)

### 7. Tests de integración end-to-end (core)
Del JSON crudo a la recomendación, pasando por parser → normalizer → classifier →
recommend, sobre un fixture realista.
→ [`analyze.test.ts`](../packages/core/tests/integration/analyze.test.ts)

### 8. Component testing (Testing Library)
Se consulta el DOM como un usuario: por **rol y nombre accesible**, nunca por
clases CSS. La accesibilidad se convierte en testabilidad. Incluye interacción de
usuario (subir un fichero con `user-event`) y el camino de error.
→ [`apps/web/src/App.test.tsx`](../apps/web/src/App.test.tsx),
[`FrontierChart.test.tsx`](../apps/web/src/FrontierChart.test.tsx)

### 9. End-to-end (Playwright)
Sobre el build de producción: la demo carga, la subida funciona, y dos pruebas
destacadas:
- **Privacidad:** se interceptan las peticiones de red y se verifica que el report
  (con un *canary* único) nunca sale de la página ni a un origen externo.
- **Accesibilidad:** un escaneo con axe sin violaciones serias/críticas.
→ [`apps/web/e2e/`](../apps/web/e2e/)

### 10. API testing (dos lenguajes)
- **TypeScript:** la API Fastify se prueba en proceso con `inject()` (sin servidor
  real): happy path y todos los `400`.
- **Java:** una suite **JUnit 5 + REST Assured** ejerce el servicio por HTTP real.
→ [`apps/api/tests/api.test.ts`](../apps/api/tests/api.test.ts),
[`apps/api/rest-assured/`](../apps/api/rest-assured/)

### 11. Quality gate en CI
La CLI puede fallar el build (exit ≠ 0) si el mejor tiempo de feedback supera un
presupuesto o si la config actual desperdicia demasiado coste — testeado con I/O
inyectada.
→ [`apps/cli/tests/cli.test.ts`](../apps/cli/tests/cli.test.ts)

## Cómo ejecutarlo todo

```bash
pnpm test          # unit + integración + componente (core, web, cli, api)
pnpm typecheck     # TypeScript estricto en todos los paquetes

# E2E (necesita navegador): 
pnpm --filter @ci-shard-advisor/web exec playwright install --with-deps chromium
pnpm --filter @ci-shard-advisor/web e2e

# API en Java (necesita JDK 17+ y Maven, con la API arrancada):
pnpm --filter @ci-shard-advisor/api start &
cd apps/api/rest-assured && mvn test
```

## Ideas para mejorar (pendiente)
- **Regresión visual**: screenshots con `toHaveScreenshot` (baseline por plataforma).
- **Cobertura**: `vitest --coverage` con umbrales por paquete.
- **Mutation testing** (Stryker) sobre el core, para medir la calidad de los tests.
- **Contract testing** del esquema de respuesta de la API (JSON Schema).
