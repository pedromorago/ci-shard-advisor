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
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;

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
    @DisplayName("analyze returns a recommendation over the posted report")
    void analyzeReturnsRecommendation() {
        given()
            .contentType(ContentType.JSON)
            .body(REPORT)
        .when()
            .post("/analyze")
        .then()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .body("totalTests", equalTo(3))
            .body("recommended.shardCount", greaterThanOrEqualTo(1))
            .body("frontier", not(empty()));
    }

    @Test
    @DisplayName("analyze response matches the published JSON Schema (contract)")
    void analyzeMatchesSchema() {
        given()
            .contentType(ContentType.JSON)
            .body(REPORT)
        .when()
            .post("/analyze")
        .then()
            .statusCode(200)
            .body(matchesJsonSchemaInClasspath("analysis-summary.schema.json"));
    }

    @Test
    @DisplayName("analyze compares against the current shard count")
    void analyzeComparesAgainstCurrent() {
        given()
            .contentType(ContentType.JSON)
            .queryParam("shards", 3)
            .queryParam("overheadMs", 30000)
            .body(REPORT)
        .when()
            .post("/analyze")
        .then()
            .statusCode(200)
            .body("current.shardCount", equalTo(3))
            .body("savings", notNullValue());
    }

    @Test
    @DisplayName("a structurally invalid report is rejected with 400")
    void malformedReportIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"suites\":\"not-an-array\"}")
        .when()
            .post("/analyze")
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
            .post("/analyze")
        .then()
            .statusCode(400)
            .body("error", containsString("workers"));
    }
}
