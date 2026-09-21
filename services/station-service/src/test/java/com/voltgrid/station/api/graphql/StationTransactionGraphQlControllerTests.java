package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.NetworkTransactionQueryService;
import com.voltgrid.station.application.NetworkTransactionSnapshot;
import com.voltgrid.station.application.PageResult;
import com.voltgrid.station.application.StationTransactionQueryService;
import com.voltgrid.station.application.TransactionCompletenessService;
import com.voltgrid.station.application.TransactionPageFilter;
import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionCompleteness;
import com.voltgrid.station.domain.TransactionDataStatus;
import com.voltgrid.station.domain.TransactionMeterSample;
import com.voltgrid.station.domain.TransactionStatus;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.graphql.test.autoconfigure.GraphQlTest;
import org.springframework.graphql.test.tester.GraphQlTester;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;

@GraphQlTest(
        StationTransactionGraphQlController.class
)
class StationTransactionGraphQlControllerTests {

    @Autowired
    private GraphQlTester graphQlTester;

    @MockitoBean
    private StationTransactionQueryService queryService;

    @MockitoBean
    private TransactionCompletenessService completenessService;

    @MockitoBean
    private NetworkTransactionQueryService networkTransactionQueryService;

    @Test
    void shouldQueryStationTransactions() {
        when(
                queryService.findByStationId(
                        "STATION-003"
                )
        ).thenReturn(
                List.of(
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-002",
                                1,
                                1,
                                TransactionStatus.ENDED,
                                Instant.parse(
                                        "2026-09-08T11:00:00Z"
                                ),
                                Instant.parse(
                                        "2026-09-08T11:30:00Z"
                                ),
                                3
                        ),
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-001",
                                1,
                                1,
                                TransactionStatus.ACTIVE,
                                Instant.parse(
                                        "2026-09-08T10:00:00Z"
                                ),
                                null,
                                1
                        )
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          stationTransactions(
                            stationId: "STATION-003"
                          ) {
                            stationId
                            transactionId
                            evseId
                            connectorId
                            status
                            startedAt
                            endedAt
                            lastSequenceNumber
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "stationTransactions"
                )
                .entityList(
                        ChargingTransactionView.class
                )
                .hasSize(2)
                .path(
                        "stationTransactions[0].transactionId"
                )
                .entity(String.class)
                .isEqualTo("TX-002")
                .path(
                        "stationTransactions[0].status"
                )
                .entity(String.class)
                .isEqualTo("ENDED")
                .path(
                        "stationTransactions[0].lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(3)
                .path(
                        "stationTransactions[1].transactionId"
                )
                .entity(String.class)
                .isEqualTo("TX-001")
                .path(
                        "stationTransactions[1].status"
                )
                .entity(String.class)
                .isEqualTo("ACTIVE");
    }

    @Test
    void shouldQueryNetworkTransactionsWithCompleteness() {
        var transaction = new ChargingTransaction(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse(
                        "2026-09-18T09:01:00Z"
                ),
                Instant.parse(
                        "2026-09-18T09:16:00Z"
                ),
                4
        );

        var completeness = new TransactionCompleteness(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                TransactionDataStatus.INCOMPLETE,
                0,
                4,
                List.of(2)
        );

        when(
                networkTransactionQueryService.findAll()
        ).thenReturn(
                List.of(
                        new NetworkTransactionSnapshot(
                                transaction,
                                completeness
                        )
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          networkTransactions {
                            transaction {
                              stationId
                              transactionId
                              evseId
                              connectorId
                              status
                              startedAt
                              endedAt
                              lastSequenceNumber
                            }

                            completeness {
                              status
                              firstSequenceNumber
                              lastSequenceNumber
                              missingSequenceNumbers
                            }
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "networkTransactions"
                )
                .entityList(
                        NetworkTransactionView.class
                )
                .hasSize(1)
                .path(
                        "networkTransactions[0].transaction.stationId"
                )
                .entity(String.class)
                .isEqualTo("AWS-CP-001")
                .path(
                        "networkTransactions[0].transaction.transactionId"
                )
                .entity(String.class)
                .isEqualTo("AWS-DEMO-TX-0187")
                .path(
                        "networkTransactions[0].transaction.status"
                )
                .entity(String.class)
                .isEqualTo("ENDED")
                .path(
                        "networkTransactions[0].transaction.lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(4)
                .path(
                        "networkTransactions[0].completeness.status"
                )
                .entity(String.class)
                .isEqualTo("INCOMPLETE")
                .path(
                        "networkTransactions[0].completeness.firstSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(0)
                .path(
                        "networkTransactions[0].completeness.lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(4)
                .path(
                        "networkTransactions[0].completeness.missingSequenceNumbers"
                )
                .entityList(Integer.class)
                .containsExactly(2);
    }

    @Test
    void shouldQueryPaginatedNetworkTransactionsWithCompleteness() {
        var transaction = new ChargingTransaction(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse(
                        "2026-09-18T09:01:00Z"
                ),
                Instant.parse(
                        "2026-09-18T09:16:00Z"
                ),
                4
        );

        var completeness = new TransactionCompleteness(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                TransactionDataStatus.INCOMPLETE,
                0,
                4,
                List.of(2)
        );

        when(
                networkTransactionQueryService.findPage(
                        0,
                        20,
                        TransactionPageFilter.empty()
                )
        ).thenReturn(
                new PageResult<>(
                        List.of(
                                new NetworkTransactionSnapshot(
                                        transaction,
                                        completeness
                                )
                        ),
                        0,
                        20,
                        41,
                        3,
                        true
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          networkTransactionPage(
                            page: 0
                            size: 20
                          ) {
                            content {
                              transaction {
                                stationId
                                transactionId
                                evseId
                                connectorId
                                status
                                startedAt
                                endedAt
                                lastSequenceNumber
                              }

                              completeness {
                                status
                                firstSequenceNumber
                                lastSequenceNumber
                                missingSequenceNumbers
                              }
                            }

                            page
                            size
                            totalElements
                            totalPages
                            hasNext
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "networkTransactionPage.content"
                )
                .entityList(
                        NetworkTransactionView.class
                )
                .hasSize(1)
                .path(
                        "networkTransactionPage.content[0].transaction.stationId"
                )
                .entity(String.class)
                .isEqualTo("AWS-CP-001")
                .path(
                        "networkTransactionPage.content[0].transaction.transactionId"
                )
                .entity(String.class)
                .isEqualTo("AWS-DEMO-TX-0187")
                .path(
                        "networkTransactionPage.content[0].transaction.evseId"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.content[0].transaction.connectorId"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.content[0].transaction.status"
                )
                .entity(String.class)
                .isEqualTo("ENDED")
                .path(
                        "networkTransactionPage.content[0].transaction.startedAt"
                )
                .entity(String.class)
                .isEqualTo(
                        "2026-09-18T09:01:00Z"
                )
                .path(
                        "networkTransactionPage.content[0].transaction.endedAt"
                )
                .entity(String.class)
                .isEqualTo(
                        "2026-09-18T09:16:00Z"
                )
                .path(
                        "networkTransactionPage.content[0].transaction.lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(4)
                .path(
                        "networkTransactionPage.content[0].completeness.status"
                )
                .entity(String.class)
                .isEqualTo("INCOMPLETE")
                .path(
                        "networkTransactionPage.content[0].completeness.firstSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(0)
                .path(
                        "networkTransactionPage.content[0].completeness.lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(4)
                .path(
                        "networkTransactionPage.content[0].completeness.missingSequenceNumbers"
                )
                .entityList(Integer.class)
                .containsExactly(2)
                .path(
                        "networkTransactionPage.page"
                )
                .entity(Integer.class)
                .isEqualTo(0)
                .path(
                        "networkTransactionPage.size"
                )
                .entity(Integer.class)
                .isEqualTo(20)
                .path(
                        "networkTransactionPage.totalElements"
                )
                .entity(Integer.class)
                .isEqualTo(41)
                .path(
                        "networkTransactionPage.totalPages"
                )
                .entity(Integer.class)
                .isEqualTo(3)
                .path(
                        "networkTransactionPage.hasNext"
                )
                .entity(Boolean.class)
                .isEqualTo(true);
    }

    @Test
    void shouldQueryPaginatedNetworkTransactionsWithFilters() {
        var transaction = new ChargingTransaction(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse(
                        "2026-09-18T09:01:00Z"
                ),
                Instant.parse(
                        "2026-09-18T09:16:00Z"
                ),
                4
        );

        var completeness = new TransactionCompleteness(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                TransactionDataStatus.INCOMPLETE,
                0,
                4,
                List.of(2)
        );

        var filter = new TransactionPageFilter(
                "AWS-CP-001",
                "demo"
        );

        when(
                networkTransactionQueryService.findPage(
                        0,
                        20,
                        filter
                )
        ).thenReturn(
                new PageResult<>(
                        List.of(
                                new NetworkTransactionSnapshot(
                                        transaction,
                                        completeness
                                )
                        ),
                        0,
                        20,
                        1,
                        1,
                        false
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          networkTransactionPage(
                            page: 0
                            size: 20
                            stationId: "AWS-CP-001"
                            transactionId: "demo"
                          ) {
                            content {
                              transaction {
                                stationId
                                transactionId
                                evseId
                                connectorId
                                status
                                startedAt
                                endedAt
                                lastSequenceNumber
                              }

                              completeness {
                                status
                                firstSequenceNumber
                                lastSequenceNumber
                                missingSequenceNumbers
                              }
                            }

                            page
                            size
                            totalElements
                            totalPages
                            hasNext
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "networkTransactionPage.content"
                )
                .entityList(
                        NetworkTransactionView.class
                )
                .hasSize(1)
                .path(
                        "networkTransactionPage.content[0].transaction.stationId"
                )
                .entity(String.class)
                .isEqualTo("AWS-CP-001")
                .path(
                        "networkTransactionPage.content[0].transaction.transactionId"
                )
                .entity(String.class)
                .isEqualTo("AWS-DEMO-TX-0187")
                .path(
                        "networkTransactionPage.content[0].transaction.evseId"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.content[0].transaction.connectorId"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.content[0].transaction.status"
                )
                .entity(String.class)
                .isEqualTo("ENDED")
                .path(
                        "networkTransactionPage.content[0].completeness.status"
                )
                .entity(String.class)
                .isEqualTo("INCOMPLETE")
                .path(
                        "networkTransactionPage.content[0].completeness.firstSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(0)
                .path(
                        "networkTransactionPage.content[0].completeness.lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(4)
                .path(
                        "networkTransactionPage.content[0].completeness.missingSequenceNumbers"
                )
                .entityList(Integer.class)
                .containsExactly(2)
                .path(
                        "networkTransactionPage.page"
                )
                .entity(Integer.class)
                .isEqualTo(0)
                .path(
                        "networkTransactionPage.size"
                )
                .entity(Integer.class)
                .isEqualTo(20)
                .path(
                        "networkTransactionPage.totalElements"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.totalPages"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.hasNext"
                )
                .entity(Boolean.class)
                .isEqualTo(false);
    }

    @Test
    void shouldQueryPaginatedNetworkTransactionsWithIntegrityFilter() {
        var transaction = new ChargingTransaction(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse(
                        "2026-09-18T09:01:00Z"
                ),
                Instant.parse(
                        "2026-09-18T09:16:00Z"
                ),
                4
        );

        var completeness = new TransactionCompleteness(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                TransactionDataStatus.INCOMPLETE,
                0,
                4,
                List.of(2)
        );

        var filter = new TransactionPageFilter(
                "AWS-CP-001",
                "demo",
                TransactionDataStatus.INCOMPLETE
        );

        when(
                networkTransactionQueryService.findPage(
                        0,
                        20,
                        filter
                )
        ).thenReturn(
                new PageResult<>(
                        List.of(
                                new NetworkTransactionSnapshot(
                                        transaction,
                                        completeness
                                )
                        ),
                        0,
                        20,
                        1,
                        1,
                        false
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          networkTransactionPage(
                            page: 0
                            size: 20
                            stationId: "AWS-CP-001"
                            transactionId: "demo"
                            integrityStatus: INCOMPLETE
                          ) {
                            content {
                              transaction {
                                stationId
                                transactionId
                                evseId
                                connectorId
                                status
                                startedAt
                                endedAt
                                lastSequenceNumber
                              }

                              completeness {
                                status
                                firstSequenceNumber
                                lastSequenceNumber
                                missingSequenceNumbers
                              }
                            }

                            page
                            size
                            totalElements
                            totalPages
                            hasNext
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "networkTransactionPage.content"
                )
                .entityList(
                        NetworkTransactionView.class
                )
                .hasSize(1)
                .path(
                        "networkTransactionPage.content[0].transaction.stationId"
                )
                .entity(String.class)
                .isEqualTo("AWS-CP-001")
                .path(
                        "networkTransactionPage.content[0].transaction.transactionId"
                )
                .entity(String.class)
                .isEqualTo("AWS-DEMO-TX-0187")
                .path(
                        "networkTransactionPage.content[0].completeness.status"
                )
                .entity(String.class)
                .isEqualTo("INCOMPLETE")
                .path(
                        "networkTransactionPage.content[0].completeness.missingSequenceNumbers"
                )
                .entityList(Integer.class)
                .containsExactly(2)
                .path(
                        "networkTransactionPage.page"
                )
                .entity(Integer.class)
                .isEqualTo(0)
                .path(
                        "networkTransactionPage.size"
                )
                .entity(Integer.class)
                .isEqualTo(20)
                .path(
                        "networkTransactionPage.totalElements"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.totalPages"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "networkTransactionPage.hasNext"
                )
                .entity(Boolean.class)
                .isEqualTo(false);
    }

    @Test
    void shouldQueryTransactionById() {
        when(
                queryService.findById(
                        "STATION-003",
                        "TX-0093"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-0093",
                                1,
                                1,
                                TransactionStatus.ENDED,
                                Instant.parse(
                                        "2026-09-08T12:00:00Z"
                                ),
                                Instant.parse(
                                        "2026-09-08T12:20:00Z"
                                ),
                                3
                        )
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          transaction(
                            stationId: "STATION-003"
                            transactionId: "TX-0093"
                          ) {
                            stationId
                            transactionId
                            evseId
                            connectorId
                            status
                            startedAt
                            endedAt
                            lastSequenceNumber
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "transaction.transactionId"
                )
                .entity(String.class)
                .isEqualTo("TX-0093")
                .path(
                        "transaction.status"
                )
                .entity(String.class)
                .isEqualTo("ENDED")
                .path(
                        "transaction.evseId"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "transaction.connectorId"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "transaction.lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(3)
                .path(
                        "transaction.endedAt"
                )
                .entity(String.class)
                .isEqualTo(
                        "2026-09-08T12:20:00Z"
                );
    }

    @Test
    void shouldReturnNullForUnknownTransaction() {
        when(
                queryService.findById(
                        "STATION-003",
                        "TX-404"
                )
        ).thenReturn(
                Optional.empty()
        );

        graphQlTester
                .document(
                        """
                        query {
                          transaction(
                            stationId: "STATION-003"
                            transactionId: "TX-404"
                          ) {
                            transactionId
                          }
                        }
                        """
                )
                .execute()
                .path("transaction")
                .valueIsNull();
    }

    @Test
    void shouldQueryTransactionMeterSamples() {
        when(
                queryService.findMeterSamples(
                        "STATION-003",
                        "TX-0093"
                )
        ).thenReturn(
                List.of(
                        new TransactionMeterSample(
                                "STATION-003",
                                "TX-0093",
                                1,
                                Instant.parse(
                                        "2026-09-08T12:05:00Z"
                                ),
                                new BigDecimal(
                                        "1250.50000000"
                                ),
                                "Energy.Active.Import.Register",
                                "Sample.Periodic",
                                null,
                                "Outlet",
                                "Wh",
                                0
                        ),
                        new TransactionMeterSample(
                                "STATION-003",
                                "TX-0093",
                                1,
                                Instant.parse(
                                        "2026-09-08T12:05:00Z"
                                ),
                                new BigDecimal(
                                        "7200.00000000"
                                ),
                                "Power.Active.Import",
                                "Sample.Periodic",
                                null,
                                "Outlet",
                                "W",
                                0
                        )
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          transactionMeterSamples(
                            stationId: "STATION-003"
                            transactionId: "TX-0093"
                          ) {
                            sequenceNumber
                            sampledAt
                            value
                            measurand
                            context
                            phase
                            location
                            unit
                            unitMultiplier
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "transactionMeterSamples"
                )
                .entityList(
                        TransactionMeterSampleView.class
                )
                .hasSize(2)
                .path(
                        "transactionMeterSamples[0].sequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(1)
                .path(
                        "transactionMeterSamples[0].value"
                )
                .entity(String.class)
                .isEqualTo(
                        "1250.50000000"
                )
                .path(
                        "transactionMeterSamples[0].measurand"
                )
                .entity(String.class)
                .isEqualTo(
                        "Energy.Active.Import.Register"
                )
                .path(
                        "transactionMeterSamples[0].unit"
                )
                .entity(String.class)
                .isEqualTo("Wh")
                .path(
                        "transactionMeterSamples[1].value"
                )
                .entity(String.class)
                .isEqualTo(
                        "7200.00000000"
                )
                .path(
                        "transactionMeterSamples[1].measurand"
                )
                .entity(String.class)
                .isEqualTo(
                        "Power.Active.Import"
                );
    }

    @Test
    void shouldQueryTransactionCompleteness() {
        when(
                completenessService.calculate(
                        "STATION-003",
                        "TX-0101"
                )
        ).thenReturn(
                new TransactionCompleteness(
                        "STATION-003",
                        "TX-0101",
                        TransactionDataStatus.INCOMPLETE,
                        0,
                        4,
                        List.of(2)
                )
        );

        graphQlTester
                .document(
                        """
                        query {
                          transactionCompleteness(
                            stationId: "STATION-003"
                            transactionId: "TX-0101"
                          ) {
                            status
                            firstSequenceNumber
                            lastSequenceNumber
                            missingSequenceNumbers
                          }
                        }
                        """
                )
                .execute()
                .path(
                        "transactionCompleteness.status"
                )
                .entity(String.class)
                .isEqualTo("INCOMPLETE")
                .path(
                        "transactionCompleteness.firstSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(0)
                .path(
                        "transactionCompleteness.lastSequenceNumber"
                )
                .entity(Integer.class)
                .isEqualTo(4)
                .path(
                        "transactionCompleteness.missingSequenceNumbers"
                )
                .entityList(Integer.class)
                .containsExactly(2);
    }
}