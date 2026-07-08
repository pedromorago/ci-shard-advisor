# Integración con Xray (Jira)

[Xray](https://www.getxray.app/) es una herramienta de gestión de pruebas dentro
de Jira: modela *Tests*, *Test Executions* y *Test Plans* como issues, y permite
**importar los resultados de la automatización** para tener trazabilidad entre los
tests automáticos y los requisitos/bugs de Jira.

La vía de integración más portable es **JUnit XML**, que es lo que emiten todas las
suites de este proyecto. Este documento explica el flujo (no hay un Jira real
conectado; es la documentación de cómo se integraría).

## De dónde sale el JUnit XML

| Suite | Cómo |
| --- | --- |
| Unit / integración / componente / contract (vitest) | `pnpm test:junit` → `reports/junit/results.xml` por paquete |
| E2E web (Playwright) | reporter `junit` → `apps/web/reports/junit/e2e.xml` |
| E2E web (Cypress) | `mocha-junit-reporter` → `apps/web/reports/junit/cypress-*.xml` |
| API (JUnit 5 + REST Assured) | Surefire → `apps/api/rest-assured/target/surefire-reports/*.xml` |

`pnpm test:junit` (raíz) genera el XML de todos los paquetes vitest de una vez.

## Cómo se importa a Xray

1. **Ejecutas la suite** en CI y obtienes el/los JUnit XML.
2. **Subes el resultado** a Xray, que crea un *Test Execution* con un *Test* por
   cada `<testcase>`:
   - **Xray Cloud** (REST v2, con token):
     ```bash
     curl -H "Authorization: Bearer $XRAY_TOKEN" \
       -F "file=@apps/web/reports/junit/e2e.xml" \
       https://xray.cloud.getxray.app/api/v2/import/execution/junit?projectKey=CSA
     ```
   - **Xray Server/DC**: `POST /rest/raven/1.0/import/execution/junit?projectKey=CSA`.
   - O manualmente desde la UI de Jira: *Test Execution → Import Results*.
3. Xray asocia los resultados al *Test Plan* / *Test Execution* y los deja
   trazables desde la historia o el bug correspondiente.

## Vincular un test automático con un Test de Jira

Xray hace *matching* por el nombre del test. La convención habitual es **incluir la
clave del issue de Jira en el título del test**; así Xray lo enlaza con el *Test*
existente (o lo crea):

```ts
// vitest / Playwright
it('CSA-123 recommends fewer shards when overhead dominates', () => { /* ... */ });
```

```java
// JUnit 5
@Test
@DisplayName("CSA-124 analyze response matches the JSON Schema")
void analyzeMatchesSchema() { /* ... */ }
```

Al importar, el `<testcase name="CSA-123 ...">` permite a Xray mapear ese resultado
al Test `CSA-123`. Para BDD, Xray también soporta importar/exportar *Cucumber* y
generar *feature files* desde los Tests de Jira.

## En CI

El workflow de GitHub Actions puede publicar estos XML como artefactos o llamar al
endpoint de import de Xray tras la fase de test, cerrando el ciclo
automatización → Jira.
