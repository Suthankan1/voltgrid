package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionPageFilter;
import com.voltgrid.station.domain.TransactionStatus;
import com.voltgrid.station.support.PostgresTestConfiguration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@Transactional
class JpaStationTransactionReaderIntegrationTests {

    @Autowired
    private ChargingTransactionJpaRepository repository;

    @Autowired
    private JpaStationTransactionReader reader;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        insertStation(
                "AWS-CP-001",
                "AWS Charger"
        );

        insertStation(
                "STATION-002",
                "Station 002"
        );

        repository.saveAll(
                List.of(
                        transaction(
                                "AWS-CP-001",
                                "AWS-DEMO-TX-0187",
                                "2026-09-18T09:01:00Z"
                        ),
                        transaction(
                                "AWS-CP-001",
                                "OTHER-TX",
                                "2026-09-18T08:01:00Z"
                        ),
                        transaction(
                                "STATION-002",
                                "AWS-DEMO-TX-999",
                                "2026-09-18T07:01:00Z"
                        )
                )
        );

        repository.flush();
    }

    @Test
    void shouldFilterBeforeApplyingPaginationAndCounts() {
        var result =
                reader.findPage(
                        0,
                        20,
                        new TransactionPageFilter(
                                "AWS-CP-001",
                                "DeMo"
                        )
                );

        assertEquals(
                1,
                result.content().size()
        );

        assertEquals(
                "AWS-CP-001",
                result
                        .content()
                        .getFirst()
                        .stationId()
        );

        assertEquals(
                "AWS-DEMO-TX-0187",
                result
                        .content()
                        .getFirst()
                        .transactionId()
        );

        assertEquals(
                1,
                result.totalElements()
        );

        assertEquals(
                1,
                result.totalPages()
        );

        assertFalse(
                result.hasNext()
        );
    }

    @Test
    void shouldTreatLikeWildcardsAsLiteralCharacters() {
        repository.saveAll(
                List.of(
                        transaction(
                                "AWS-CP-001",
                                "DEMO%_SPECIAL",
                                "2026-09-18T10:01:00Z"
                        ),
                        transaction(
                                "AWS-CP-001",
                                "DEMOAB_SPECIAL",
                                "2026-09-18T10:00:00Z"
                        )
                )
        );

        repository.flush();

        var result =
                reader.findPage(
                        0,
                        20,
                        new TransactionPageFilter(
                                "AWS-CP-001",
                                "%_"
                        )
                );

        assertEquals(
                1,
                result.content().size()
        );

        assertEquals(
                "DEMO%_SPECIAL",
                result
                        .content()
                        .getFirst()
                        .transactionId()
        );

        assertEquals(
                1,
                result.totalElements()
        );

        assertEquals(
                1,
                result.totalPages()
        );

        assertFalse(
                result.hasNext()
        );
    }

    private void insertStation(
            String stationId,
            String name
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO charging_stations (
                    id,
                    name,
                    status
                )
                VALUES (?, ?, ?)
                """,
                stationId,
                name,
                "ONLINE"
        );
    }

    private ChargingTransactionEntity transaction(
            String stationId,
            String transactionId,
            String startedAt
    ) {
        var started =
                Instant.parse(startedAt);

        return new ChargingTransactionEntity(
                new ChargingTransactionId(
                        stationId,
                        transactionId
                ),
                1,
                1,
                TransactionStatus.ENDED,
                started,
                started.plusSeconds(900),
                4
        );
    }
}