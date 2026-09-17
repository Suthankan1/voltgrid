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
class StationStatusFilteringE2EIntegrationTests {

    @Autowired
    private HttpGraphQlTester graphQlTester;

    @Autowired
    private StationStatusProjectionRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    @Test
    void shouldFilterAndPaginateStationStatusesByStatus() {
        saveProjection(
                "STATION-001",
                "ONLINE"
        );

        saveProjection(
                "STATION-002",
                "UNAVAILABLE"
        );

        saveProjection(
                "STATION-003",
                "ONLINE"
        );

        saveProjection(
                "STATION-004",
                "ONLINE"
        );

        var firstPage =
                graphQlTester
                        .document(
                                """
                                query StationStatuses(
                                  $status: StationOperationalStatus!
                                ) {
                                  stationStatuses(
                                    first: 2,
                                    status: $status
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
                                "status",
                                "ONLINE"
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
                        "STATION-003"
                );

        firstPage
                .path(
                        "stationStatuses.edges[*].node.currentStatus"
                )
                .entityList(
                        String.class
                )
                .containsExactly(
                        "ONLINE",
                                "ONLINE"
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

        var secondPage =
                graphQlTester
                        .document(
                                """
                                query StationStatuses(
                                  $status: StationOperationalStatus!,
                                  $after: String!
                                ) {
                                  stationStatuses(
                                    first: 2,
                                    after: $after,
                                    status: $status
                                  ) {
                                    edges {
                                      node {
                                        stationId
                                        currentStatus
                                      }
                                    }
                                    pageInfo {
                                      hasNextPage
                                    }
                                  }
                                }
                                """
                        )
                        .variable(
                                "status",
                                "ONLINE"
                        )
                        .variable(
                                "after",
                                endCursor
                        )
                        .execute();

        secondPage
                .path(
                        "stationStatuses.edges[*].node.stationId"
                )
                .entityList(
                        String.class
                )
                .containsExactly(
                        "STATION-004"
                );

        secondPage
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
            String status
    ) {
        var changedAt =
                Instant.parse(
                        "2026-09-17T08:00:00Z"
                );

        repository.save(
                new StationStatusProjectionEntity(
                        stationId,
                        status,
                        UUID.randomUUID(),
                        changedAt,
                        changedAt.plusSeconds(
                                1
                        )
                )
        );
    }
}