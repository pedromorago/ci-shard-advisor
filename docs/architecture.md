# Arquitectura

> Nota: los docs internos están en español durante el desarrollo; se traducirán a inglés en la fase de polish (decisión cerrada nº 20).

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

```text
Playwright JSON
      -> parser        (valida y extrae)
      -> normalizer    (AtomicTask[]; unidad: spec o test)
      -> classifier    (bloques: sanity, regression, ...)
      -> scheduler     (Branch & Bound + LPT; asignación, makespan, gap)
      -> workers       (simula la cola interna de Playwright por shard)
      -> recommender   (frontera coste-tiempo, codo, comparación con actual)
      -> exporters     (JSON, texto CLI, Markdown)
```

## Decisiones de diseño del scheduler

- El scheduler trabaja con `readonly number[]` (duraciones) y devuelve asignaciones por índice. No conoce `AtomicTask`: máxima pureza, tests triviales, y el normalizer es quien traduce.
- LPT no es la estrella: es el incumbente inicial (cota superior) del Branch & Bound y el respaldo cuando se agota el presupuesto de tiempo.
- `avgBound` se mantiene continuo (sin `ceil`). Con duraciones estrictamente enteras, `ceil(total/N)` sería una cota válida algo más ajustada, pero con duraciones fraccionarias dejaría de ser una cota válida (ejemplo: [1.5, 1.5] con N=2 tiene óptimo 1.5, y ceil(3/2)=2 lo superaría). Preferimos correcto y general.
- El motor nunca miente: si no certifica el óptimo dentro del presupuesto, devuelve `optimal: false` junto con la mejor solución, la cota inferior y el gap.
- El Branch & Bound ramifica asignando tareas de mayor a menor duración (una por nivel del árbol, decidiendo su shard). Colocar primero las grandes ajusta las cargas pronto y hace que la poda por incumbente corte mucho antes.
- Poda por cota: una colocación se descarta en cuanto su shard alcanzaría una carga `>=` al mejor makespan conocido, porque esa rama ya no puede mejorarlo.
- Ruptura de simetrías: como los shards son idénticos, dos con la misma carga son intercambiables; solo se expande el primero de cada carga distinta. Esto elimina el grueso del árbol simétrico (y hace que la primera tarea vaya siempre al shard 0).
- Presupuesto doble: `timeBudgetMs` (reloj, para uso real) y `maxNodes` (determinista, pensado para poder testear el camino de "presupuesto agotado" sin tests flaky).
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
- El codo (`findElbow`) es el punto de máxima curvatura: se normalizan ambos ejes a [0,1] (para que ninguna magnitud domine) y se elige el más alejado de la cuerda entre los extremos. En empates o curvas planas gana el menor `shardCount` (más barato).
- `recommend` orquesta todo y, dada la config actual del equipo (`currentShardCount`), cuantifica el ahorro (tiempo ganado y delta de coste) frente a la recomendación. La comparación es honesta: si el equipo ya ha pasado el codo, la recomendación sale más lenta pero más barata.
- QA destacable del recommender: el codo se valida con fixtures geométricos de resultado conocido y con una propiedad **metamórfica** (reescalar un eje no mueve el codo); la frontera con invariantes de monotonía; y el ahorro con aritmética comprobada a mano.
