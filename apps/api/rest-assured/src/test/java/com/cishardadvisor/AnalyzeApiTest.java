package com.cishardadvisor;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.not;

/**
 * REST Assured + JUnit 5 suite against the local CI Shard Advisor API.
 * Start the API first (`pnpm --filter @ci-shard-advisor/api start`), then run
 * `mvn test`. Override the target with -DAPI_BASE_URL or the API_BASE_URL env.
 */
class AnalyzeApiTest {

    private static final String REPORT = """
        {"suites":[{"specs":[
          {"title":"a","tags":["@sanity"],"tests":[{"status":"expected","results":[{"duration":10000}]}]},
          {"title":"b","tests":[{"status":"expected","results":[{"duration":20000}]}]},
          {"title":"c","tests":[{"status":"expected","results":[{"duration":30000}]}]}
        ]}]}
        """;

    /** Two shard reports with unequal wall time — a measurable per-shard setup. */
    private static final String PER_SHARD = """
        {"reports":[
          {"suites":[{"specs":[{"title":"a","tests":[{"status":"expected","results":[{"duration":50000}]}]}]}]},
          {"suites":[{"specs":[{"title":"b","tests":[{"status":"expected","results":[{"duration":10000}]}]}]}]}
        ]}
        """;

    @BeforeAll
    static void setUp() {
        String fromProp = System.getProperty("API_BASE_URL");
        String fromEnv = System.getenv("API_BASE_URL");
        RestAssured.baseURI = fromProp != null ? fromProp
                : (fromEnv != null ? fromEnv : "http://localhost:3001");
    }

    @Test
    @DisplayName("health check returns ok")
    void healthReturnsOk() {
        given()
        .when()
            .get("/health")
        .then()
            .statusCode(200)
            .body("status", equalTo("ok"));
    }

    @Test
    @DisplayName("advise returns the current situation, four moves and a frontier")
    void adviseReturnsMoves() {
        given()
            .contentType(ContentType.JSON)
            .body(REPORT)
        .when()
            .post("/advise")
        .then()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .body("totalTests", equalTo(3))
            .body("current.measured", equalTo(false))
            .body("scenarios.size()", equalTo(4))
            .body("frontier", not(empty()));
    }

    @Test
    @DisplayName("advise response matches the published JSON Schema (contract)")
    void adviseMatchesSchema() {
        given()
            .contentType(ContentType.JSON)
            .body(REPORT)
        .when()
            .post("/advise")
        .then()
            .statusCode(200)
            .body(matchesJsonSchemaInClasspath("advisor-result.schema.json"));
    }

    @Test
    @DisplayName("advise measures the current setup from per-shard reports")
    void adviseMeasuresPerShard() {
        given()
            .contentType(ContentType.JSON)
            .body(PER_SHARD)
        .when()
            .post("/advise")
        .then()
            .statusCode(200)
            .body("current.measured", equalTo(true))
            .body("current.shardCount", equalTo(2))
            .body("current.imbalanceMs", greaterThan(0));
    }

    @Test
    @DisplayName("a structurally invalid report is rejected with 400")
    void malformedReportIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"suites\":\"not-an-array\"}")
        .when()
            .post("/advise")
        .then()
            .statusCode(400)
            .body("error", containsString("suites"));
    }

    @Test
    @DisplayName("an invalid query parameter is rejected with 400")
    void invalidQueryParamIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .queryParam("workers", "lots")
            .body(REPORT)
        .when()
            .post("/advise")
        .then()
            .statusCode(400)
            .body("error", containsString("workers"));
    }
}
