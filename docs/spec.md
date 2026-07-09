# CI Shard Advisor — Especificación v2

> **Este documento es la fuente de verdad del producto.** Si el README, el código o cualquier conversación contradicen lo que dice aquí, gana este documento. Una feature está "terminada" cuando cumple sus criterios de aceptación (sección 9), tiene tests y no rompe los invariantes del motor (sección 12).

---

## 1. Caso de uso

Una empresa ejecuta pipelines E2E con **Cypress** en un CI en la nube (Jenkins, GitHub Actions, Bitbucket Pipelines, GitLab CI — la plataforma es indiferente: el report lo genera el runner, no el CI). Para paralelizar, la pipeline levanta **varios contenedores** que se reparten las specs. Cada contenedor tiene un **tiempo de setup** (arranque, instalación, navegador) que se suma a la factura por cada contenedor adicional.

El balanceo "oficial" de Cypress (Cypress Cloud) es un servicio **de pago y online**. El hueco de esta herramienta: decidir cuántos contenedores y qué spec va en cada uno **sin Cypress Cloud** — gratis, local y con el coste como ciudadano de primera.

La empresa recoge los datos de su **última ejecución** y la herramienta le devuelve:

1. Su situación actual **medida** (no modelada): shards, tiempos, coste, desequilibrio.
2. Un abanico de **movimientos posibles anclados a esa situación**, cada uno con su precio.

La voz del producto no es "el óptimo matemático es 5", sino: **"estás aquí; estos son tus movimientos y esto cuesta/ahorra cada uno".**

## 2. Alcance

**Dentro:** reports de **Cypress** (resultado de `cypress run` / Module API y **mochawesome**). Salida para GitHub Actions y Bitbucket Pipelines. Web estática, CLI y API local.

**Fuera:** otros runners en el pitch — los lectores de **Playwright** y **JUnit** permanecen en el código como extras no documentados, igual que el modelo de workers (concepto Playwright: en Cypress no existe). Lectura automática de APIs de CI y exportadores GitLab/Jenkins quedan para v3.

**Terminología:** de cara al usuario se habla de **contenedores** (como habla el ecosistema Cypress); el contrato TypeScript conserva los nombres internos (`shardCount`, `ShardPlan`) por estabilidad de API.

## 3. Entrada

### 3.1 Modo preferente: un report por shard

Cada contenedor de la pipeline ya produce su propio report (un mochawesome JSON — o el resultado del Module API — por contenedor, subido como artifact). La herramienta acepta **N ficheros a la vez** y de ahí deduce:

- `N` actual = número de ficheros.
- Tiempo real de cada shard = contenido de cada fichero.
- Duración por test = material para replanificar.

### 3.2 Modo degradado: un report fusionado

Un único report + `N` declarado por el usuario. La configuración actual se **modela** (reparto por cantidad) en vez de medirse. La salida debe indicar que es modelada.

### 3.3 Parámetros manuales

- **Setup por shard** (obligatorio para hablar de coste; default sugerido en UI: 30–60 s). En v2 podrá medirse desde la API del CI (duración del job − tiempo de tests).
- **Precio por minuto de máquina** (opcional; activa € en todas las salidas).
- `maxShards`, objetivo (sección 5.4). (Workers no: en Cypress cada contenedor ejecuta sus specs en serie.)

### 3.4 Casos límite

- Ficheros de formatos mezclados → error claro.
- Fichero sin tests → warning, se ignora como shard vacío.
- Autodetección de formato como hasta ahora; `--input-format` para forzar.

## 4. Modelo de coste

Para una configuración de `N` shards con tiempos de test `t_1..t_N` y setup `s`:

```text
wall_i    = cola simulada del shard i con W workers   // W=1 → wall_i = Σ t del shard
feedback  = max(wall_i) + s                           // lo que espera el humano
billedMs  = Σ wall_i + N·s                            // lo que factura la nube
€         = billedMs → minutos × precio               // solo si hay precio
```

Consecuencias útiles (deben aparecer como mensajes cuando apliquen):

- **Reequilibrar con el mismo N y los mismos workers no cambia el coste** (mismo trabajo, mismos setups); solo reduce la espera. Es gratis.
- **Los workers son gratis en la factura**: misma máquina, menos tiempo de pared, menos minutos facturados. Los shards, en cambio, añaden setup. "Más workers antes que más máquinas" es un consejo válido, con la letra pequeña de 4.1.

### 4.1 Modelo de workers (aparcado — concepto Playwright)

**Cypress no tiene workers**: un navegador por contenedor, specs en serie — `workers` se fuerza siempre a 1 y nada del producto visible lo expone. El simulador de workers permanece en el código (extra no documentado, junto al lector Playwright) por si se reactiva. Lo que sigue documenta ese modelo aparcado.

Dos niveles de paralelismo distintos: los **shards** deciden qué tests van a cada máquina; los **workers** deciden cómo se consumen dentro de ella.

1. **Simulación fiel, no óptima:** la cola de un shard se recorre en orden y cada tarea va al worker que antes queda libre, sin reordenar (así funciona Playwright). El flag `optimal` del B&B certifica la partición por trabajo; el feedback reportado sale siempre de la simulación.
2. **Default de CI:** Playwright usa `workers: 1` en CI salvo configuración explícita. Secuencial es el caso más común, no una suposición del modelo.
3. **Acoplamiento con la granularidad:** sin `fullyParallel`, la unidad real de reparto entre workers es el *fichero* (los tests de un spec van al mismo worker, en serie). Regla: con `workers > 1`, granularidad fichero por defecto; granularidad test solo si `fullyParallel: true` está confirmado.
4. **Escalado optimista:** el simulador asume que W workers escalan perfecto. En runners pequeños, dos navegadores se estorban (escalado sublineal, más riesgo de flaky). Toda recomendación de subir workers incluye la advertencia de validarlo con una ejecución real.
5. **Lectura automática:** el report JSON de Playwright incluye su config resuelta con `workers`; en modo por-shard, la situación actual lo lee de ahí (fallback: flag manual).
6. **Cypress no tiene workers:** un navegador por contenedor, tests en serie. Con reports de Cypress, `workers` se fuerza a 1 y los findings de workers no aplican.

## 5. Salida

### 5.1 Situación actual (medida)

Shards, tiempo por shard, feedback, coste (ms y €), y **desequilibrio**: cuánto antes termina el shard más rápido respecto al más lento ("estás pagando máquinas paradas").

### 5.2 Escenarios: qué calcula el motor y qué se muestra

El **motor** sigue calculando los cuatro escenarios como consultas sobre la frontera de repartos óptimos (y el JSON los lleva todos):

| # | Escenario | Definición exacta |
|---|-----------|-------------------|
| 1 | **Reequilibrar** | Reparto óptimo con el `N` actual. Δcoste = 0 por definición. Incluye plan aplicable (5.3). |
| 2 | **Misma espera, menor coste** | `argmin coste` sujeto a `feedback ≤ feedback_actual`. Empates → menos shards. |
| 3 | **Mismo coste, menor espera** | `argmin feedback` sujeto a `coste ≤ coste_actual`. Empates → menos shards. |
| 4 | **Por objetivo** | Según sección 5.4. |

La **presentación** (web y salida de texto/markdown) muestra:

1. La situación actual (5.1).
2. **Reequilibrar**, siempre visible: es el único movimiento gratis (mismas máquinas, Δcoste = 0) y aplica se elija el objetivo que se elija.
3. **Un único movimiento elegido**, controlado por el selector de objetivo (5.4). Los escenarios 2 y 3 no desaparecen: son los *valores por defecto* de los objetivos parametrizados (`max-feedback` prellenado con la espera actual ≡ escenario 2; `budget` prellenado con el coste actual ≡ escenario 3).

Si el movimiento elegido no existe (p. ej. nada cumple el presupuesto), se dice explícitamente, nunca se inventa. Si coincide con el reequilibrio, se muestra una sola tarjeta que lo indica.

### 5.3 Plan aplicable (cerrar el hueco modelo-realidad)

El tiempo prometido por un reparto óptimo **no** se consigue con `--shard=i/N` (que reparte por cantidad). El plan se materializa como algo **ejecutable hoy**: la lista de ficheros de spec de cada shard, con el comando del runner detectado —

- **Playwright:** `npx playwright test <specs del shard i>` por job.
- **Cypress:** `npx cypress run --spec "<specs del shard i>"` por contenedor.

El reparto se calcula a **granularidad de fichero** (no se puede rutar medio fichero a un shard). Y el cierre real del círculo: los exporters `github`/`bitbucket` generan el **YAML completo** donde cada job paralelo corre exactamente su lista — la salida del advisor se pega directamente en la config del CI. Nunca se emite un flag que el runner no soporte.

### 5.4 Objetivos

Los que se exponen en la UI/CLI:

- **`recommended`** (default) — el codo de la frontera: el punto de máxima curvatura, donde el siguiente shard deja de pagar lo que cuesta. Es el criterio de recomendación y se presenta con ese nombre (internamente es el kind `balanced` del core).
- **`fastest`** — mínima espera, cueste lo que cueste.
- **`max-feedback <T>`** — el más barato con feedback ≤ T. En la web, el campo viene **prellenado con la espera actual medida** (≡ "misma espera, más barato").
- **`budget <X>`** — el más rápido con coste ≤ X. En la web, prellenado con el **coste actual medido** (≡ "mismo coste, más rápido").

Solo en el core (sin UI): `cheapest` (degenerado: con setup > 0 siempre es 1 shard; equivale a `max-feedback ∞`) y el peso numérico coste/tiempo (avanzado, para consumidores de la librería).

### 5.5 Findings (la voz del consejero)

Frases, no solo números. Obligatorias cuando aplican:

- **Sobrefragmentación:** "Usas 10 shards, pero a partir de 6 solo pagas más: +31 % de coste por −35 s."
- **Infrafragmentación:** "Con 5 shards reducirías la espera un 42 % por +€0.12 por ejecución."
- **Workers antes que máquinas** *(aparcado con el modelo de workers, 4.1 — no aplica a Cypress)*.
- **Suelo / cuello de botella (FR-10 clásico):** "A partir de N=3 la espera no baja: 'checkout.spec.ts' (8m 51s) marca el suelo. Considera trocearlo (granularidad / fullyParallel)."
- **Desequilibrio actual** (solo modo por-shard): ver 5.1.
- **Flaky:** tests con retries y su coste ("3 tests flaky quemaron 1m 54s de máquina en esta ejecución").

### 5.6 Frontera

Se mantiene para la gráfica (todas las N evaluadas), añadiendo € por punto cuando hay precio. **Toda la planificación opera a granularidad de fichero** — frontera, escenarios, modelo del actual en modo fusionado y el suelo de 5.5 — porque una spec es indivisible: no se puede rutar medio fichero a un shard. Así, cada número mostrado es **alcanzable por el plan emitido** (5.3); el motor nunca promete un tiempo que solo existiría troceando specs. (Corolario: el orden interno de una spec — p. ej. sanity antes que regression — se preserva siempre, porque la spec viaja entera a su shard.)

## 6. Contrato TypeScript (core)

```ts
/** Un fichero de report tal y como llega. */
export interface ReportFile {
  name: string;                 // para mensajes: "shard-3.json"
  content: string | unknown;    // JSON crudo o ya parseado
}

export type AnalyzeInput =
  | { kind: 'per-shard'; reports: ReportFile[] }                      // preferente
  | { kind: 'merged'; report: ReportFile; currentShardCount?: number }; // degradado

export interface CostModel {
  startupOverheadMs: number;    // setup por shard (manual en v1)
  pricePerMinute?: number;      // activa €
  currency?: string;            // default '€'
}

export type Objective =
  | { kind: 'balanced' } | { kind: 'fastest' } | { kind: 'cheapest' }
  | { kind: 'max-feedback'; feedbackMs: number }
  | { kind: 'budget'; costMs: number }
  | { kind: 'weight'; costPerFeedbackMinute: number };

export interface MeasuredCurrent {
  shardCount: number;
  shardTimesMs: number[];       // tiempos reales por shard (solo per-shard)
  feedbackTimeMs: number;
  costMs: number;
  imbalanceMs: number;          // max(t) - min(t)
  measured: boolean;            // false en modo degradado (modelado)
}

export interface ShardPlan {
  shards: string[][];           // ids de tarea por shard (reparto óptimo)
  specs: string[][];            // ficheros de spec por shard (lo aplicable: 5.3)
}

export interface Scenario {
  id: 'rebalance' | 'same-feedback-cheaper' | 'same-cost-faster' | 'objective';
  config: ConfigPoint;          // el ConfigPoint existente (+ € derivado al presentar)
  vsCurrent?: { feedbackDeltaMs: number; costDeltaMs: number };
  reason: string;               // una frase: por qué este punto
  plan?: ShardPlan;             // cómo aplicarlo (5.3)
  sameAs?: Scenario['id'];      // si coincide con otro escenario
  objective?: Objective;        // solo en id 'objective': el objetivo que lo produjo (para etiquetar)
}

export interface Findings {
  warnings: string[];           // frases de 5.5, ya redactadas en el core
  flaky: { id: string; title: string; retries: number; wastedMs: number }[];
}

export interface AdvisorResult {
  current?: MeasuredCurrent;
  scenarios: Scenario[];
  frontier: ConfigPoint[];
  findings: Findings;
  tasks: AtomicTask[];
  runner: 'playwright' | 'cypress'; // detectado del report; decide el comando del plan (5.3)
}

export function advise(input: AnalyzeInput, cost: CostModel, options?: {
  objective?: Objective; workersPerShard?: number; maxShards?: number;
}): AdvisorResult;
```

`analyze()` actual puede conservarse como capa interna; `advise()` es la nueva puerta pública que consumen CLI, web y API.

## 7. CLI

```text
ci-shard-advisor <reports...> [options]

  --setup <duration>       setup por shard (ej: 45s)          [requerido para coste]
  --price <num>            €/minuto de máquina                [opcional, activa €]
  --shards <n>             solo en modo fusionado (degradado)
  --objective <recommended|fastest>   (default: recommended, el codo)
  --max-feedback <dur>     objetivo: el más barato dentro del SLA
  --budget <€|dur>         objetivo: el más rápido dentro del presupuesto
  --max-shards <n>
  --format <text|json|markdown|github|bitbucket>
  --input-format <auto|playwright|cypress|mochawesome>

Quality gates (renombrados para no chocar con los objetivos):
  --gate-feedback <dur>    exit 1 si el mejor feedback supera el límite
  --gate-cost-waste <pct>  exit 1 si tu config actual desperdicia > pct%
```

**Cambio rompedor documentado:** los antiguos `--max-feedback`/`--max-cost-waste` como *gates* pasan a `--gate-*`; `--priority` se sustituye por `--objective` y los flags de meta.

### 7.1 Mock del output de texto (números ilustrativos)

```text
$ ci-shard-advisor artifacts/shard-*.json --setup 45s --price 0.08

CI Shard Advisor
================

Suite: 214 tests, 38m 12s of test time (Cypress, 4 container reports)

Your current setup (measured)
  4 containers
  Feedback time: 14m 15s   (slowest shard: #3)
  Billed cost:   41m 12s  →  €3.30 per run
  ⚠ Imbalance: shard #4 finishes 5m 48s before shard #3.
    You are paying for idle machines.

Your moves
  Free) Rebalance your 4 containers   feedback 10m 25s (−3m 50s)   cost €3.30 (±0)
     Same machines, specs redistributed by duration. Rebalancing is free.
     Apply (each container runs its own list):
       container 1: npx cypress run --spec "checkout.cy.ts"
       container 2: npx cypress run --spec "cart.cy.ts,search.cy.ts"
       ...
     (--format github emits the full workflow)

  Recommended) 5 containers           feedback 9m 02s (−5m 13s)   cost €3.28 (−€0.02)
     The knee of the cost/time frontier — past it, containers stop paying off.
     Apply (each container runs its own list): ...

(el segundo bloque cambia con --objective/--max-feedback/--budget; si el
movimiento elegido coincide con el rebalance, se emite una sola entrada)

Warnings
  • Past 6 shards feedback stops improving: 'checkout.spec.ts' (8m 51s)
    gates every run. Consider splitting it before adding machines.
  • 3 flaky tests wasted 1m 54s in retries this run.

Frontier (shards · feedback · billed · price)
  1   38m 57s   38m 57s   €3.12
  2   19m 56s   39m 42s   €3.18
  3   13m 29s   40m 27s   €3.24
  ...
```

## 8. Web

- Demo precargada al abrir (se mantiene), mostrando: card de situación actual + card de **rebalance** (siempre visible) + **una card del movimiento elegido** + findings + gráfica de frontera con € en tooltip.
- **Demo Cypress** (per-contenedor, con retries para mostrar el finding de flaky y el comando `--spec`).
- Selector de objetivo (5.4): `Recommended` (default) · `Fastest` · `Espera máxima` (campo prellenado con la espera actual) · `Presupuesto` (campo prellenado con el coste actual). Cambiar el selector cambia la card del movimiento y el marcador *recommended* de la gráfica.
- Si el movimiento elegido coincide con el rebalance, se muestra una sola card que lo indica.
- Upload **múltiple** (N ficheros a la vez) además de único.
- Inputs: setup, precio/min, contenedores (solo en modo fusionado), objetivo.
- Todo en cliente (privacidad intacta).
- **Desplegada** en GitHub Pages o Vercel, con enlace en la cabecera del README. Sin esto, la fase no está terminada.

## 9. Requisitos funcionales (criterios de aceptación)

- **FR-1 Entrada por shard:** acepta ≥2 reports PW o Cypress/mochawesome; deduce N y tiempos por shard; mezcla de formatos → error claro.
- **FR-2 Modo degradado:** 1 report + `--shards N`; la salida marca la config actual como *modelada*.
- **FR-3 Coste:** con `--price`, todos los outputs muestran €; sin él, tiempo de máquina. Fórmulas de la sección 4, con tests.
- **FR-4 Actual medida:** feedback, coste, imbalance y shard más lento correctos contra fixtures. Si los reports de Playwright traen `config.workers`, se usa; si no, flag manual (default 1).
- **FR-5 Escenario reequilibrio:** Δcoste = 0 exacto; incluye `ShardPlan`; las `specs` por shard cubren cada fichero exactamente una vez y el reparto es óptimo a granularidad de fichero.
- **FR-6 Misma espera menor coste:** cumple su definición formal (tabla 5.2) contra la frontera; si no existe, lo dice.
- **FR-7 Mismo coste menor espera:** ídem.
- **FR-8 Objetivos:** los seis tipos de la 5.4; `max-feedback`/`budget` verificados con tests de frontera.
- **FR-9 Findings:** cada frase de 5.5 se emite exactamente cuando su condición se cumple (tests con fixtures que disparan cada una, incluida `playwright-bottleneck.json`).
- **FR-10 Flaky:** lista con retries y `wastedMs = Σ duración de intentos extra`.
- **FR-11 Exporters:** text/json/markdown consistentes entre sí (mismo summary); github/bitbucket generan el YAML del escenario elegido con la **lista exacta de specs por job** (5.3), con el comando del runner detectado.
- **FR-12 Web:** criterios de la sección 8, cubiertos por E2E (Playwright) incluida la subida múltiple y la privacidad (sin peticiones de red con el report).
- **FR-13 Workers forzados a 1:** con reports de Cypress, `workers` es siempre 1 (specs en serie por contenedor); pedir otro valor no cambia nada. El modelo de workers y su finding quedan aparcados en el código (4.1), cubiertos por sus tests.

## 10. Qué se conserva, qué cambia, qué se aparca

**Se conserva tal cual:** scheduler completo (LPT, B&B, bounds, workers), `evaluateConfig`/`buildFrontier`, `findElbow`, lectores PW/Cypress/mochawesome, quality gates (renombrados), tests existentes.

**Cambia:** puerta pública (`advise()` con `AnalyzeInput`), `recommend()` se convierte en la capa de escenarios, exporters ganan € y findings, CLI (flags de la sección 7), web (cards y upload múltiple).

**Se aparca:** lectores JUnit y **Playwright** (código y tests se quedan, fuera del README/pitch), **modelo de workers** y su finding (4.1), medición de setup vía APIs de CI (v3), exportadores GitLab/Jenkins (v3).

## 11. Invariantes del motor (no negociables)

1. El core no importa nada de `apps/` ni de frameworks. El scheduler sigue trabajando con `readonly number[]`.
2. **El motor nunca miente:** si el B&B no certifica el óptimo dentro del presupuesto, `optimal: false` + cota + gap.
3. Ninguna cota inferior puede superar al óptimo (por eso `avgBound` es continuo, sin `ceil`).
4. Salidas deterministas (sin locale, sin reloj) para que los snapshots sean estables.
5. Los tests con aleatoriedad usan el PRNG con semilla (`mulberry32`), nunca `Math.random()`.
6. La simulación de workers no reordena la cola (modelo fiel de Playwright, no optimizador). El feedback reportado sale siempre de la simulación, nunca de la partición teórica.
7. **Granularidad de fichero end-to-end (5.6):** frontera, escenarios, modelo del actual y suelo se calculan sobre ficheros de spec, nunca sobre tests sueltos — todo número prometido es alcanzable por el plan emitido.
