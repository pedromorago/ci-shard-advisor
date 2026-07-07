# Architecture Decision Records

Formato corto: contexto, decisión, consecuencias. Un ADR no se borra; si cambia, se marca como superseded y se añade uno nuevo.

## ADR-001 — Core en TypeScript puro

- **Estado:** aceptada
- **Contexto:** el motor debe correr en navegador (web estática), en Node (CLI) y detrás de una API sin duplicar lógica.
- **Decisión:** un único core TypeScript sin dependencias de framework, consumido por todos los adaptadores.
- **Consecuencias:** un solo motor que testear; los adaptadores quedan finos; la web puede procesar en cliente.

## ADR-002 — Web pública sin backend

- **Estado:** aceptada
- **Contexto:** los reports de Playwright pueden contener información sensible de suites internas; además, un portfolio no debería exigir mantener servidores.
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
