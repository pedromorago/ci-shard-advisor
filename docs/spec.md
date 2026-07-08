# CI Shard Advisor — Especificación v2

> **Este documento es la fuente de verdad del producto.** Si el README, el código o cualquier conversación contradicen lo que dice aquí, gana este documento. Una feature está "terminada" cuando cumple sus criterios de aceptación (sección 9), tiene tests y no rompe los invariantes del motor (sección 12).

---

## 1. Caso de uso

Una empresa ejecuta pipelines E2E con **Playwright o Cypress** en un CI en la nube (Jenkins, GitHub Actions, Bitbucket Pipelines, GitLab CI — la plataforma es indiferente: el report lo genera el runner, no el CI). Para paralelizar, la pipeline levanta **varios contenedores (shards)**. Cada contenedor tiene un **tiempo de setup** (arranque, instalación, navegadores) que se suma a la factura por cada contenedor adicional.

La empresa recoge los datos de su **última ejecución** y la herramienta le devuelve:

1. Su situación actual **medida** (no modelada): shards, tiempos, coste, desequilibrio.
2. Un abanico de **movimientos posibles anclados a esa situación**, cada uno con su precio.

La voz del producto no es "el óptimo matemático es 5", sino: **"estás aquí; estos son tus movimientos y esto cuesta/ahorra cada uno".**

## 2. Alcance

**Dentro:** reports de Playwright (JSON) y Cypress (resultado de `cypress run` / mochawesome). Salida para GitHub Actions y Bitbucket Pipelines. Web estática, CLI y API local.

**Fuera (v1):** otros runners en el pitch (el lector JUnit permanece en el código como extra no documentado), lectura automática de APIs de CI, GitLab/Jenkins como exportadores de config.

## 3. Entrada

### 3.1 Modo preferente: un report por shard

Cada contenedor de la pipeline ya produce su propio report (Playwright: un JSON/blob por job del matrix, subido como artifact; Cypress: un mochawesome por contenedor). La herramienta acepta **N ficheros a la vez** y de ahí deduce:

- `N` actual = número de ficheros.
- Tiempo real de cada shard = contenido de cada fichero.
- Duración por test = material para replanificar.

### 3.2 Modo degradado: un report fusionado

Un único report + `N` declarado por el usuario. La configuración actual se **modela** (reparto por cantidad) en vez de medirse. La salida debe indicar que es modelada.

### 3.3 Parámetros manuales

- **Setup por shard** (obligatorio para hablar de coste; default sugerido en UI: 30–60 s). En v2 podrá medirse desde la API del CI (duración del job − tiempo de tests).
- **Precio por minuto de máquina** (opcional; activa € en todas las salidas).
- Workers por shard, `maxShards`, objetivo (sección 5.4).

### 3.4 Casos límite

- Ficheros de formatos mezclados → error claro.
- Fichero sin tests → warning, se ignora como shard vacío.
- Autodetección de formato como hasta ahora; `--input-format` para forzar.

## 4. Modelo de coste

Para una configuración de `N` shards con tiempos de test `t_1..t_N` y setup `s`:

```text
feedback  = max(t_i) + s                  // lo que espera el humano
billedMs  = Σ t_i + N·s                   // lo que factura la nube
€         = billedMs → minutos × precio   // solo si hay precio
```

Consecuencia útil (debe aparecer como mensaje): **reequilibrar con el mismo N no cambia el coste** (mismo trabajo total, mismos setups); solo reduce la espera. Es gratis.

## 5. Salida

### 5.1 Situación actual (medida)

Shards, tiempo por shard, feedback, coste (ms y €), y **desequilibrio**: cuánto antes termina el shard más rápido respecto al más lento ("estás pagando máquinas paradas").

### 5.2 Los cuatro escenarios (las "cards")

Todos se calculan sobre la frontera de repartos óptimos ya existente; son consultas + presentación:

| # | Escenario | Definición exacta |
|---|-----------|-------------------|
| 1 | **Reequilibrar** | Reparto óptimo con el `N` actual. Δcoste = 0 por definición. Incluye plan aplicable (5.3). |
| 2 | **Misma espera, menor coste** | `argmin coste` sujeto a `feedback ≤ feedback_actual`. Empates → menos shards. |
| 3 | **Mismo coste, menor espera** | `argmin feedback` sujeto a `coste ≤ coste_actual`. Empates → menos shards. |
| 4 | **Por objetivo** | Según sección 5.4. |

Si un escenario no existe (p. ej. nada es más barato cumpliendo la espera), se dice explícitamente, nunca se inventa. Si dos escenarios coinciden, se indica ("igual que el nº 3").

### 5.3 Plan aplicable (cerrar el hueco modelo-realidad)

El tiempo prometido por un reparto óptimo **no** se consigue con `--shard=i/N` (que reparte por cantidad). Cada escenario con reparto óptimo incluye cómo aplicarlo:

- **Playwright:** valor de `--shard-weights` y/o mapa de shards (qué specs van a cada shard).
- **Cypress:** lista de specs por contenedor (compatible con `--spec` o cypress-split).

### 5.4 Objetivos

`balanced` (codo, default) · `fastest` · `cheapest` · `max-feedback <T>` (el más barato con feedback ≤ T) · `budget <X>` (el más rápido con coste ≤ X) · peso numérico coste/tiempo (avanzado).

### 5.5 Findings (la voz del consejero)

Frases, no solo números. Obligatorias cuando aplican:

- **Sobrefragmentación:** "Usas 10 shards, pero a partir de 6 solo pagas más: +31 % de coste por −35 s."
- **Infrafragmentación:** "Con 5 shards reducirías la espera un 42 % por +€0.12 por ejecución."
- **Suelo / cuello de botella (FR-10 clásico):** "A partir de N=3 la espera no baja: 'checkout.spec.ts' (8m 51s) marca el suelo. Considera trocearlo (granularidad / fullyParallel)."
- **Desequilibrio actual** (solo modo por-shard): ver 5.1.
- **Flaky:** tests con retries y su coste ("3 tests flaky quemaron 1m 54s de máquina en esta ejecución").

### 5.6 Frontera

Se mantiene tal cual para la gráfica (todas las N evaluadas), añadiendo € por punto cuando hay precio.

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
  shardWeights?: string;        // Playwright --shard-weights
}

export interface Scenario {
  id: 'rebalance' | 'same-feedback-cheaper' | 'same-cost-faster' | 'objective';
  config: ConfigPoint;          // el ConfigPoint existente (+ € derivado al presentar)
  vsCurrent?: { feedbackDeltaMs: number; costDeltaMs: number };
  reason: string;               // una frase: por qué este punto
  plan?: ShardPlan;             // cómo aplicarlo (5.3)
  sameAs?: Scenario['id'];      // si coincide con otro escenario
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
  --workers <n>            workers por shard (default 1)
  --shards <n>             solo en modo fusionado (degradado)
  --objective <balanced|fastest|cheapest>
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

Suite: 214 tests, 38m 12s of test time (Playwright, 4 shard reports)

Your current setup (measured)
  4 shards × 1 worker
  Feedback time: 14m 15s   (slowest shard: #3)
  Billed cost:   41m 12s  →  €3.30 per run
  ⚠ Imbalance: shard #4 finishes 5m 48s before shard #3.
    You are paying for idle machines.

Your moves
  1) Rebalance your 4 shards      feedback 10m 25s (−3m 50s)   cost €3.30 (±0)
     Same machines, tests redistributed by duration. Rebalancing is free.
     Apply: npx playwright test --shard-weights=31,27,22,20

  2) Same wait, cheaper: 3 shards   feedback 13m 29s (−46s)    cost €3.24 (−€0.06, −2%)
     One fewer machine still beats your current wait.

  3) Same cost, faster: 5 shards    feedback 9m 02s (−5m 13s)  cost €3.28 (−€0.02)
     Your current budget buys a 37% faster pipeline.

  4) Balanced sweet spot: 5 shards  — same as move #3 for this suite.

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

- Demo precargada al abrir (se mantiene), ahora mostrando: card de situación actual + las 4 cards de movimientos + findings + gráfica de frontera con € en tooltip.
- Upload **múltiple** (N ficheros a la vez) además de único.
- Inputs: setup, precio/min, workers, objetivo.
- Todo en cliente (privacidad intacta).
- **Desplegada** en GitHub Pages o Vercel, con enlace en la cabecera del README. Sin esto, la fase no está terminada.

## 9. Requisitos funcionales (criterios de aceptación)

- **FR-1 Entrada por shard:** acepta ≥2 reports PW o Cypress/mochawesome; deduce N y tiempos por shard; mezcla de formatos → error claro.
- **FR-2 Modo degradado:** 1 report + `--shards N`; la salida marca la config actual como *modelada*.
- **FR-3 Coste:** con `--price`, todos los outputs muestran €; sin él, tiempo de máquina. Fórmulas de la sección 4, con tests.
- **FR-4 Actual medida:** feedback, coste, imbalance y shard más lento correctos contra fixtures.
- **FR-5 Escenario reequilibrio:** Δcoste = 0 exacto; incluye `ShardPlan`; el `--shard-weights` generado suma coherente con el reparto.
- **FR-6 Misma espera menor coste:** cumple su definición formal (tabla 5.2) contra la frontera; si no existe, lo dice.
- **FR-7 Mismo coste menor espera:** ídem.
- **FR-8 Objetivos:** los seis tipos de la 5.4; `max-feedback`/`budget` verificados con tests de frontera.
- **FR-9 Findings:** cada frase de 5.5 se emite exactamente cuando su condición se cumple (tests con fixtures que disparan cada una, incluida `playwright-bottleneck.json`).
- **FR-10 Flaky:** lista con retries y `wastedMs = Σ duración de intentos extra`.
- **FR-11 Exporters:** text/json/markdown consistentes entre sí (mismo summary); github/bitbucket generan config del escenario elegido.
- **FR-12 Web:** criterios de la sección 8, cubiertos por E2E (Playwright) incluida la subida múltiple y la privacidad (sin peticiones de red con el report).

## 10. Qué se conserva, qué cambia, qué se aparca

**Se conserva tal cual:** scheduler completo (LPT, B&B, bounds, workers), `evaluateConfig`/`buildFrontier`, `findElbow`, lectores PW/Cypress/mochawesome, quality gates (renombrados), tests existentes.

**Cambia:** puerta pública (`advise()` con `AnalyzeInput`), `recommend()` se convierte en la capa de escenarios, exporters ganan € y findings, CLI (flags de la sección 7), web (cards y upload múltiple).

**Se aparca:** lector JUnit (código se queda, fuera del README/pitch), medición de setup vía APIs de CI (v2), exportadores GitLab/Jenkins (v2).

## 11. Invariantes del motor (no negociables)

1. El core no importa nada de `apps/` ni de frameworks. El scheduler sigue trabajando con `readonly number[]`.
2. **El motor nunca miente:** si el B&B no certifica el óptimo dentro del presupuesto, `optimal: false` + cota + gap.
3. Ninguna cota inferior puede superar al óptimo (por eso `avgBound` es continuo, sin `ceil`).
4. Salidas deterministas (sin locale, sin reloj) para que los snapshots sean estables.
5. Los tests con aleatoriedad usan el PRNG con semilla (`mulberry32`), nunca `Math.random()`.
