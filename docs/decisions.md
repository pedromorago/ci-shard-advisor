# Architecture Decision Records

Formato corto: contexto, decisión, consecuencias. Un ADR no se borra; si cambia, se marca como superseded y se añade uno nuevo.

## ADR-001 — Core en TypeScript puro

- **Estado:** aceptada
- **Contexto:** el motor debe correr en navegador (web estática), en Node (CLI) y detrás de una API sin duplicar lógica.
- **Decisión:** un único core TypeScript sin dependencias de framework, consumido por todos los adaptadores.
- **Consecuencias:** un solo motor que testear; los adaptadores quedan finos; la web puede procesar en cliente.

## ADR-002 — Web pública sin backend

- **Estado:** aceptada *(redacción pre-pivot: donde dice "Playwright" léase "Cypress" — ver ADR-008)*
- **Contexto:** los reports de test pueden contener información sensible de suites internas; además, un portfolio no debería exigir mantener servidores.
- **Decisión:** la web es estática y el JSON se procesa íntegramente en el navegador. Nunca se envía a un servidor.
- **Consecuencias:** privacidad demostrable (test E2E dedicado), hosting gratuito, y el core queda obligado a ser ejecutable en navegador (refuerza ADR-001).

## ADR-003 — API local opcional para testing backend

- **Estado:** aceptada
- **Contexto:** el CV incluye backend/API automation (Java, REST Assured, JUnit 5) y el proyecto debe poder demostrarlo.
- **Decisión:** una API local (no desplegada públicamente) que envuelve el core y sirve de objetivo para la suite Java REST Assured.
- **Consecuencias:** se demuestra API testing real sin comprometer ADR-002; la API es un adaptador más y no duplica lógica.

## ADR-004 — Branch and Bound propio, sin solver externo

- **Estado:** aceptada
- **Contexto:** CBC es nativo y no encaja en una web en cliente; HiGHS/WASM añade dependencia y despliegue complejo, y el tamaño de instancia de la v1 no lo exige.
- **Decisión:** implementar un solver Branch and Bound dedicado al problema (repartir n tareas en N máquinas idénticas minimizando makespan), con LPT como incumbente, ruptura de simetrías, cotas y presupuesto de tiempo con gap reportado.
- **Consecuencias:** demuestra capacidad algorítmica; control total de cotas y gap; HiGHS/WASM queda como posible mejora de roadmap.

## ADR-005 — Demo precargada para recruiters

- **Estado:** aceptada
- **Contexto:** un recruiter no tiene un JSON de Playwright; una web vacía con "Upload your JSON" no comunica nada.
- **Decisión:** la web abre con un análisis demo ya cargado (gráfica, recomendación, ahorro, warnings) y un CTA para subir un report propio.
- **Consecuencias:** el proyecto se entiende en 30 segundos; se necesita un fixture demo realista y mantenido.

## ADR-006 — Narrativa del proyecto

- **Estado:** aceptada
- **Contexto:** el proyecto debe leerse como herramienta QA/SDET profesional.
- **Decisión:** el README y la narrativa pública presentan el rigor del motor como criterio de ingeniería, sin referencias académicas personales.
- **Consecuencias:** mensaje centrado en el problema de CI y en la estrategia de testing.

## ADR-007 — Stack de la web: Vite + React + TypeScript

- **Estado:** aceptada
- **Contexto:** la Fase 2 necesita una web estática (ADR-002) que consuma el core sin duplicar lógica y que sea fácil de testear con las herramientas del ecosistema QA.
- **Decisión:** `apps/web` con Vite + React + TypeScript, consumiendo `@ci-shard-advisor/core` como dependencia de workspace (`workspace:*`). Testing con Vitest + Testing Library para componentes y Playwright para E2E (privacidad, a11y). Estilos con CSS plano, sin frameworks pesados.
- **Consecuencias:** el core (TS puro) se empaqueta en el bundle de cliente, confirmando ADR-001/002 (todo el análisis corre en el navegador). El adaptador web queda fino: solo renderiza e invoca al core. Se abre con el análisis demo precargado (ADR-005) usando un fixture propio.

## ADR-008 — Pivot del producto a Cypress-only

- **Estado:** aceptada (spec v2.1; supersede parcialmente la redacción de ADR-002/005/006, que hablaban de Playwright)
- **Contexto:** el hueco de mercado real está en Cypress: su balanceo oficial (Cypress Cloud) es un servicio de pago y online, mientras que Playwright shardea gratis con `--shard`. Un producto "para todo runner" diluía el pitch.
- **Decisión:** el producto se presenta **solo para Cypress** (lectores Module API y mochawesome). Los lectores de Playwright y JUnit y el **modelo de workers** (concepto Playwright: en Cypress cada contenedor ejecuta sus specs en serie, `workers` se fuerza a 1 — FR-13) quedan **aparcados en el código con sus tests**, fuera del pitch y de toda superficie visible (CLI, API, web, READMEs).
- **Consecuencias:** un mensaje nítido ("paraleliza Cypress sin Cypress Cloud"); el motor sigue siendo agnóstico (añadir un runner = un lector más); hay que vigilar que nada visible re-exponga workers ni venda Playwright como soportado.

## ADR-009 — `advise()` como única puerta pública; la v1 (`analyze`) se retira

- **Estado:** aceptada
- **Contexto:** la spec v2 introdujo `advise()` (situación medida + escenarios anclados + findings) como nueva puerta. La v1 (`analyze` → `recommend` → `summarize` → `toText/toJson/toMarkdown`, con su concepto de *blocks*) quedó publicada en `index.ts` sin que ningún adaptador la usara, y `advise()` no se apoyaba en ella: dos pipelines paralelos, uno muerto pero público y testeado.
- **Decisión:** retirar la capa de presentación v1 (funciones y tests). Se conservan las **primitivas** que la v2 reutiliza (scheduler, frontera, codo, lectores) en una sección separada del `index.ts`, documentada como superficie para consumidores de la librería.
- **Consecuencias:** una sola historia que contar (y mantener); menos superficie de mutación/cobertura sin valor; los snapshots de texto/Markdown pasan a fijar los exporters v2, que son los reales.

## ADR-010 — Sin paso de build: TypeScript crudo de punta a punta

- **Estado:** aceptada
- **Contexto:** el core debe correr en navegador (lo consume Vite/bundler), la CLI y la API son herramientas de desarrollo dentro del monorepo, y un `dist/` compilado sería un artefacto más que mantener sin consumidor externo real.
- **Decisión:** ningún paquete emite JS (`noEmit: true`): el core se consume como fuente TS (`exports: "./src/index.ts"`, `moduleResolution: Bundler`), la web lo empaqueta con Vite y la CLI/API corren con `tsx`.
- **Consecuencias:** cero mantenimiento de builds y fuente única; a cambio, `@ci-shard-advisor/core` **no es publicable en npm tal cual** (requiere un consumidor con bundler/TS) y el bin de la CLI necesita `tsx` en runtime (shebang `npx tsx`). Si algún día se publica, habrá que añadir un build (tsup/tsc) — decisión consciente, no un olvido.
