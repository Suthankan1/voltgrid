package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.graphql.test.autoconfigure.tester.AutoConfigureHttpGraphQlTester;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.graphql.test.tester.HttpGraphQlTester;

import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(
        webEnvironment = RANDOM_PORT,
        properties = {
                "spring.kafka.listener.auto-startup=false"
        }
)
@AutoConfigureHttpGraphQlTester
@Import(PostgresTestConfiguration.class)
class StationStatusGraphQlErrorE2EIntegrationTests {

    @Autowired
    private HttpGraphQlTester graphQlTester;

    @Test
    void shouldReturnBadRequestForPageSizeAboveMaximum() {
        graphQlTester
                .document(
                        """
                        query StationStatuses($first: Int!) {
                          stationStatuses(first: $first) {
                            edges {
                              node {
                                stationId
                              }
                            }
                          }
                        }
                        """
                )
                .variable(
                        "first",
                        101
                )
                .execute()
                .errors()
                .expect(
                        error ->
                                ErrorType.BAD_REQUEST.equals(
                                        error.getErrorType()
                                )
                                        && "Station status page size must be between 1 and 100"
                                        .equals(
                                                error.getMessage()
                                        )
                                        && "INVALID_PAGE_SIZE"
                                        .equals(
                                                error
                                                        .getExtensions()
                                                        .get(
                                                                "code"
                                                        )
                                        )
                )
                .verify();
    }

    @Test
    void shouldReturnBadRequestForPageSizeBelowMinimum() {
        graphQlTester
                .document(
                        """
                        query StationStatuses($first: Int!) {
                          stationStatuses(first: $first) {
                            edges {
                              node {
                                stationId
                              }
                            }
                          }
                        }
                        """
                )
                .variable(
                        "first",
                        0
                )
                .execute()
                .errors()
                .expect(
                        error ->
                                ErrorType.BAD_REQUEST.equals(
                                        error.getErrorType()
                                )
                                        && "INVALID_PAGE_SIZE"
                                        .equals(
                                                error
                                                        .getExtensions()
                                                        .get(
                                                                "code"
                                                        )
                                        )
                )
                .verify();
    }
}