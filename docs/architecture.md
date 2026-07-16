# Arquitectura

> Nota: los docs internos están en español durante el desarrollo; se traducirán a inglés en la fase de polish.

## Estilo: hexagonal ligera (ports and adapters)

El dominio vive en el centro (`packages/core`) y todo lo demás son adaptadores finos. La idea completa cabe en una frase: **el core no sabe nada del mundo exterior**.

```text
   Web (React/Vite)      CLI (Node)      API local (Fastify)
          \                  |                  /
           v                 v                 v
                      packages/core
                    (TypeScript puro)
```

Reglas que nunca se rompen:

1. El core no importa React, ni HTTP, ni Commander, ni `fs`. Recibe datos y devuelve resultados.
2. Los adaptadores importan del core; el core jamás importa de los adaptadores.
3. La web solo renderiza y recoge inputs. La CLI solo parsea argumentos y muestra salida. La API solo valida HTTP y llama al core.

Se llama "ligera" porque solo existe el lado de entrada (driving side): no hay base de datos ni servicios externos, así que no hacen falta puertos de salida ni repositorios.

El "puerto" es el contrato TypeScript que el core expone (los tipos de `types/` y las firmas públicas de `src/index.ts`). Los adaptadores solo conocen ese contrato.

## Pipeline del core

La puerta pública es **`advise()`** (spec §6): recibe los reports (uno por
contenedor, o uno fusionado) y el modelo de coste, y devuelve un `AdvisorResult`
con la situación actual medida, los escenarios anclados a ella, los findings y
la frontera. Web, CLI y API consumen exclusivamente esa puerta.

```text
Cypress reports (Module API / mochawesome)   [aparcados: Playwright, JUnit]
      -> readers        (detectFormat + readReport: valida y extrae AtomicTask[])
      -> normalizer     (groupByFile: granularidad de fichero, invariante 11.7)
      -> scheduler      (Branch & Bound + LPT; asignación, makespan, gap)
      -> frontier/elbow (frontera coste-tiempo y su codo)
      -> advisor        (current medido · escenarios anclados · findings)
      == advise() ==>   AdvisorResult
      -> exporters      (toAdvisorText/Json/Markdown + YAML GitHub/Bitbucket)
```

(El simulador de workers sigue en el código bajo el scheduler, pero para
Cypress se fuerza `workers = 1` — FR-13; es un concepto Playwright aparcado.)

## La capa advisor: la voz del producto

Es la capa que convierte el motor en consejero (spec §5), y donde vive la
tesis del producto — «estás aquí; estos son tus movimientos»:

- **`current.ts`** — la situación actual: *medida* de un report por contenedor
  (`measureCurrent`) o *modelada* por reparto round-robin de ficheros cuando
  solo hay un report fusionado (`modelCurrent`, marcada `measured: false`).
- **`scenarios.ts`** — los cuatro escenarios de la tabla 5.2 como consultas
  sobre la frontera óptima, cada uno con su `ShardPlan` aplicable (listas de
  specs por contenedor). Si un objetivo parametrizado no tiene punto factible,
  el escenario se marca `unavailable`: **el motor nunca inventa** (§5.2).
- **`findings.ts`** — las frases del consejero (§5.5): sobrefragmentación,
  infrafragmentación, el suelo que marca la spec más pesada, y los flaky con su
  coste. Se redactan en el core para que todos los adaptadores digan lo mismo.
- **`reports.ts`** — la lectura de N ficheros (formato compartido o forzado;
  mezcla → error claro).

## Decisiones de diseño del scheduler

- El scheduler trabaja con `readonly number[]` (duraciones) y devuelve asignaciones por índice. No conoce `AtomicTask`: máxima pureza, tests triviales, y el normalizer es quien traduce.
- LPT no es la estrella: es el incumbente inicial (cota superior) del Branch & Bound y el respaldo cuando se agota el presupuesto de tiempo.
- `avgBound` se mantiene continuo (sin `ceil`). Con duraciones estrictamente enteras, `ceil(total/N)` sería una cota válida algo más ajustada, pero con duraciones fraccionarias dejaría de ser una cota válida (ejemplo: [1.5, 1.5] con N=2 tiene óptimo 1.5, y ceil(3/2)=2 lo superaría). Preferimos correcto y general.
- El motor nunca miente: si no certifica el óptimo dentro del presupuesto, devuelve `optimal: false` junto con la mejor solución, la cota inferior y el gap.
- El Branch & Bound ramifica asignando tareas de mayor a menor duración (una por nivel del árbol, decidiendo su shard). Colocar primero las grandes ajusta las cargas pronto y hace que la poda por incumbente corte mucho antes.
- Poda por cota: una colocación se descarta en cuanto su shard alcanzaría una carga `>=` al mejor makespan conocido, porque esa rama ya no puede mejorarlo.
- Ruptura de simetrías: como los shards son idénticos, dos con la misma carga son intercambiables; solo se expande el primero de cada carga distinta. Esto elimina el grueso del árbol simétrico (y hace que la primera tarea vaya siempre al shard 0).
- Presupuesto doble: `maxNodes` (determinista: mismo input → mismo output en cualquier máquina; es el que usa `advise()` en producción, invariante 11.4) y `timeBudgetMs` (reloj, disponible para consumidores de la librería que prefieran acotar latencia).
- El solver es exacto pero se valida contra un oracle de fuerza bruta en los tests (property testing sobre instancias pequeñas): la implementación lista se comprueba contra otra trivialmente correcta.

## Decisiones de diseño del simulador de workers

- El scheduler reparte tareas entre *shards* (máquinas de CI separadas) tratando cada shard como secuencial. Pero dentro de un shard Playwright usa varios *workers* en paralelo, así que el tiempo real del shard **no es la suma** de sus tareas. El simulador (`simulateShard`) modela esa cola interna.
- El simulador es un **modelo fiel del tool real, no un optimizador**: recorre las tareas en el orden dado y asigna cada una al worker que antes queda libre, **sin reordenar**. Puede dar tiempos peores que el óptimo, y eso es deseable: refleja lo que Playwright haría de verdad.
- El orden de la cola importa (el mismo multiconjunto en distinto orden da distinto makespan). El orden lo decide el normalizer; el simulador solo lo respeta.
- `simulateRun` orquesta un run completo: simula cada shard y el tiempo de pared del run es el del shard más lento (los shards corren en paralelo en máquinas distintas).
- Se testea con invariantes físicos (conservación del trabajo, cotas de tiempo) y con dos comprobaciones cruzadas: el simulador **nunca bate** el óptimo del Branch & Bound, y con 1 worker por shard el run reproduce **exactamente** el makespan del scheduler.

## Decisiones de diseño del recommender

- La frontera (`buildFrontier`) evalúa cada `shardCount` de 1 a `maxShards` y produce un punto `(tiempo de feedback, coste)`. Cada punto usa el reparto del Branch & Bound y los tiempos del simulador, así que la recomendación hereda su rigor.
- Modelo de coste, explícito y parametrizable (nada mágico): coste facturado **por máquina** = Σ por shard de (`startupOverheadMs` + tiempo del shard). El tiempo de feedback = tiempo del shard más lento + `startupOverheadMs`. `workersPerShard` y `startupOverheadMs` son parámetros con defaults neutros (1 y 0).
- La tensión: más shards bajan el tiempo (rendimientos decrecientes) pero suben el coste (cada máquina extra cuesta su arranque). Con 1 worker y overhead > 0 el coste es exactamente `trabajo_total + shards × overhead`.
- El codo (`findElbow`) es el punto de máxima curvatura: se normalizan ambos ejes a [0,1] (para que ninguna magnitud domine) y se elige el más alejado de la cuerda entre los extremos. Si un eje **no varía** (p.ej. overhead 0 → coste plano) no hay trade-off, así que se optimiza el otro cogiendo el **menor nº de shards** que lo alcanza (los shards extra que no cambian ni tiempo ni coste son desperdicio).
- Criterio de recomendación configurable (el **objetivo** de spec §5.4, por defecto el codo): `balanced` (el codo), `fastest`, `cheapest`, los parametrizados `max-feedback`/`budget` (el más barato dentro de un SLA / el más rápido dentro de un presupuesto) y el peso numérico `weight` para quien conoce su trade-off. Se exponen en web, CLI (`--objective` / `--max-feedback` / `--budget`) y API (`?objective=`); la comparación con la config actual la hace la capa advisor (escenarios con `vsCurrent`).
- QA destacable del recommender: el codo se valida con fixtures geométricos de resultado conocido y con una propiedad **metamórfica** (reescalar un eje no mueve el codo); la frontera con invariantes de monotonía; y el ahorro con aritmética comprobada a mano.

## Lectores por formato (Playwright y Cypress)

El motor es **agnóstico al framework**: lo único específico de cada herramienta es
el *lector* de entrada (parser + normalizer) que traduce su report a `AtomicTask[]`.
Los lectores soportados en el pitch son los de **Cypress**: Module API
([`cypress.ts`](../packages/core/src/report/cypress.ts)) y **mochawesome**
([`mochawesome.ts`](../packages/core/src/report/mochawesome.ts), el reporter JSON
estándar de Cypress/Mocha). El formato se **detecta por la forma** del report:
`runs` → Cypress, `results` → mochawesome. A partir de ahí (duraciones), scheduler,
recommender y exporters no saben ni les importa el origen. Añadir otro runner es
**un lector más**; nada del núcleo cambia. El formato puede forzarse desde el core
y la CLI (`--input-format`).

> Quedan **aparcados en el código** (testeados, fuera del pitch — `docs/CLAUDE.md`
> regla 4): los lectores de **Playwright** ([`parser.ts`](../packages/core/src/report/parser.ts))
> y **JUnit XML** ([`junit.ts`](../packages/core/src/report/junit.ts)), y el
> **modelo de workers** (concepto Playwright: en Cypress cada contenedor ejecuta
> sus specs en serie, `workers` se fuerza a 1).

## Decisiones de diseño del pipeline de datos (parser / normalizer)

- **Parser** (`parseReport`): acepta el JSON como string o ya parseado (el core no toca `fs`; leer es cosa del adaptador), valida solo el subconjunto del report de Playwright que consumimos y tolera campos extra u opcionales ausentes, para no romperse entre versiones. Falla con `ReportParseError` indicando la **ruta del campo** culpable.
- **Normalizer** (`normalize`): recorre las `suites` **recursivamente** (los `describe` anidan suites) y emite un `AtomicTask` por test (spec × proyecto). La duración es la **suma de todos los intentos**, porque los reintentos los re-ejecuta la máquina de CI y cuentan como carga. Mapea el estado de Playwright (`expected→passed`, `unexpected→failed`, `flaky`, `skipped`).
- **`readReport` / `detectFormat`**: la entrada de cada fichero — autodetección por forma del report (o formato forzado) y despacho al lector correcto. Sobre ellos, `readReports` (advisor) resuelve el modo per-shard/fusionado y el error de formatos mezclados. El punto de entrada del producto es `advise()`.
- QA destacable: el parser se prueba con una batería de reports **malformados** (JSON inválido, tipos incorrectos, campos ausentes) verificando la ruta del error; el resto del pipeline con un **fixture realista** (suites anidadas, multi-proyecto, un flaky con reintentos, un skipped, tags) y tests **end-to-end** que van del JSON al `AdvisorResult`.

## Decisiones de diseño de los exporters

- Los tres formatos legibles renderizan el mismo `AdvisorResult` (`toAdvisorText`, `toAdvisorMarkdown`) o su forma máquina (`toAdvisorObject`/`toAdvisorJson`: tiempos en ms crudos + precio derivado), así se mantienen **consistentes** entre sí — mismo summary, mismos escenarios, mismas frases de findings.
- `toGitHubActions` y `toBitbucketPipelines` cierran el bucle con la nube: a partir del `ShardPlan` del escenario elegido generan el YAML donde **cada job paralelo corre exactamente su lista de specs** y conserva su propio report — el input preferido del advisor para el siguiente análisis. Se exponen en la CLI (`--format github|bitbucket`). Ver [examples/ci](../examples/ci).
- Formato **determinista** a propósito: `formatDuration` no usa reloj ni locale (`toLocaleString` haría los snapshots *flaky*), y el solver usa presupuesto de nodos, no de reloj. Esto habilita **snapshot testing**: la salida formateada se congela y cualquier cambio salta como diff.
- QA destacable: texto y Markdown se fijan con **inline snapshots**; el JSON con aserciones estructurales + comprobación de que la salida es **byte-idéntica** entre llamadas (determinismo).
