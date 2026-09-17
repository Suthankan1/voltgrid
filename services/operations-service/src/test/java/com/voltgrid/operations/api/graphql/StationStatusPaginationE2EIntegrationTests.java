package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.projection.station.StationStatusProjectionEntity;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.graphql.test.autoconfigure.tester.AutoConfigureHttpGraphQlTester;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.graphql.test.tester.HttpGraphQlTester;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(
        webEnvironment = RANDOM_PORT,
        properties = {
                "spring.kafka.listener.auto-startup=false"
        }
)
@AutoConfigureHttpGraphQlTester
@Import(PostgresTestConfiguration.class)
class StationStatusPaginationE2EIntegrationTests {

    @Autowired
    private HttpGraphQlTester graphQlTester;

    @Autowired
    private StationStatusProjectionRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    @Test
    void shouldPaginateStationStatusesUsingCursor()
            throws Exception {

        saveProjection(
                "STATION-001",
                "ONLINE",
                "2026-09-17T07:00:00Z"
        );

        saveProjection(
                "STATION-002",
                "UNAVAILABLE",
                "2026-09-17T07:01:00Z"
        );

        saveProjection(
                "STATION-003",
                "OFFLINE",
                "2026-09-17T07:02:00Z"
        );

        var firstPage =
                graphQlTester
                        .document(
                                """
                                query {
                                  stationStatuses(first: 2) {
                                    edges {
                                      cursor
                                      node {
                                        stationId
                                        currentStatus
                                      }
                                    }
                                    pageInfo {
                                      hasNextPage
                                      endCursor
                                    }
                                  }
                                }
                                """
                        )
                        .execute();

        firstPage
                .path(
                        "stationStatuses.edges[*].node.stationId"
                )
                .entityList(
                        String.class
                )
                .containsExactly(
                        "STATION-001",
                        "STATION-002"
                );

        firstPage
                .path(
                        "stationStatuses.pageInfo.hasNextPage"
                )
                .entity(
                        Boolean.class
                )
                .isEqualTo(
                        true
                );

        var endCursor =
                firstPage
                        .path(
                                "stationStatuses.pageInfo.endCursor"
                        )
                        .entity(
                                String.class
                        )
                        .get();

        assertThat(
                endCursor
        ).isNotBlank();

        graphQlTester
                .document(
                        """
                        query StationStatuses($after: String!) {
                          stationStatuses(
                            first: 2,
                            after: $after
                          ) {
                            edges {
                              node {
                                stationId
                                currentStatus
                              }
                            }
                            pageInfo {
                              hasNextPage
                              endCursor
                            }
                          }
                        }
                        """
                )
                .variable(
                        "after",
                        endCursor
                )
                .execute()
                .path(
                        "stationStatuses.edges[*].node.stationId"
                )
                .entityList(
                        String.class
                )
                .containsExactly(
                        "STATION-003"
                )
                .path(
                        "stationStatuses.pageInfo.hasNextPage"
                )
                .entity(
                        Boolean.class
                )
                .isEqualTo(
                        false
                );
    }

    private void saveProjection(
            String stationId,
            String status,
            String changedAt
    ) {
        var statusChangedAt =
                Instant.parse(
                        changedAt
                );

        repository.save(
                new StationStatusProjectionEntity(
                        stationId,
                        status,
                        UUID.randomUUID(),
                        statusChangedAt,
                        statusChangedAt.plusSeconds(
                                1
                        )
                )
        );
    }
}