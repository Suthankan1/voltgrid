package com.voltgrid.station.application;

import com.voltgrid.station.api.ocpp.OcppMessageProcessor;
import com.voltgrid.station.application.security.TenantAccessDeniedException;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationJpaRepository;
import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
class StationMeterValueIntegrationTests {

    @Autowired
    private OcppMessageProcessor messageProcessor;

    @Autowired
    private StationMeterValueService meterValueService;

    @Autowired
    private ChargingStationJpaRepository stationRepository;

    @Autowired
    private com.voltgrid.station.infrastructure.persistence.jpa.OrganizationJpaRepository organizationRepository;

    @Autowired
    private JsonMapper jsonMapper;

    @BeforeEach
    void setupStations() {
        stationRepository.save(new ChargingStationEntity(
                "STATION-MV-01", "MV Station 1", com.voltgrid.station.domain.StationStatus.ONLINE
        ));
        stationRepository.save(new ChargingStationEntity(
                "STATION-MV-02", "MV Station 2", com.voltgrid.station.domain.StationStatus.ONLINE
        ));
        stationRepository.save(new ChargingStationEntity(
                "STATION-MV-03", "MV Station 3", com.voltgrid.station.domain.StationStatus.ONLINE
        ));
    }

    @Test
    void shouldIngestStandaloneMeterValuesWithRfc3339OffsetAndUnitNormalization() throws Exception {
        String stationId = "STATION-MV-01";
        String messageId = "msg-mv-001";

        // OCPP 2.0.1 MeterValues CALL frame with +05:30 offset and kWh multiplier
        String ocppCall = """
                [2, "%s", "MeterValues", {
                    "evseId": 1,
                    "meterValue": [
                        {
                            "timestamp": "2026-11-27T17:30:00+05:30",
                            "sampledValue": [
                                {
                                    "value": 12.5,
                                    "context": "Sample.Periodic",
                                    "measurand": "Energy.Active.Import.Register",
                                    "phase": "L1",
                                    "location": "Outlet",
                                    "unitOfMeasure": {
                                        "unit": "kWh",
                                        "multiplier": 0
                                    }
                                }
                            ]
                        }
                    ]
                }]
                """.formatted(messageId);

        String response = messageProcessor.process(stationId, ocppCall);
        assertThat(response).isNotNull();

        var responseNode = jsonMapper.readTree(response);
        assertThat(responseNode.get(0).asInt()).isEqualTo(3); // CALL_RESULT
        assertThat(responseNode.get(1).asText()).isEqualTo(messageId);

        var samples = meterValueService.getMeterValues(stationId, 1);
        assertThat(samples).isNotEmpty();

        var sample = samples.get(0);
        assertThat(sample.stationId()).isEqualTo(stationId);
        assertThat(sample.evseId()).isEqualTo(1);
        assertThat(sample.rawValue()).isEqualByComparingTo(new BigDecimal("12.5"));
        // 12.5 kWh normalized to Wh = 12500
        assertThat(sample.normalizedValue()).isEqualByComparingTo(new BigDecimal("12500"));
        assertThat(sample.unit()).isEqualTo("kWh");
        assertThat(sample.phase()).isEqualTo("L1");
    }

    @Test
    void shouldHandleDuplicateAndLateSamplesIdempotently() {
        String stationId = "STATION-MV-02";
        String messageId1 = "msg-mv-002";
        String messageId2 = "msg-mv-003";

        String ocppCall1 = """
                [2, "%s", "MeterValues", {
                    "evseId": 2,
                    "meterValue": [
                        {
                            "timestamp": "2026-11-27T12:00:00Z",
                            "sampledValue": [
                                {
                                    "value": 500.0,
                                    "context": "Sample.Periodic",
                                    "measurand": "Energy.Active.Import.Register",
                                    "location": "Outlet",
                                    "unitOfMeasure": { "unit": "Wh", "multiplier": 0 }
                                }
                            ]
                        }
                    ]
                }]
                """.formatted(messageId1);

        String ocppCall2 = """
                [2, "%s", "MeterValues", {
                    "evseId": 2,
                    "meterValue": [
                        {
                            "timestamp": "2026-11-27T12:00:00Z",
                            "sampledValue": [
                                {
                                    "value": 500.0,
                                    "context": "Sample.Periodic",
                                    "measurand": "Energy.Active.Import.Register",
                                    "location": "Outlet",
                                    "unitOfMeasure": { "unit": "Wh", "multiplier": 0 }
                                }
                            ]
                        }
                    ]
                }]
                """.formatted(messageId2);

        String response1 = messageProcessor.process(stationId, ocppCall1);
        assertThat(response1).contains("3", messageId1);

        // Send duplicate sample: should not throw duplicate key error or create duplicate rows
        String response2 = messageProcessor.process(stationId, ocppCall2);
        assertThat(response2).contains("3", messageId2);

        var samples = meterValueService.getMeterValues(stationId, 2);
        assertThat(samples).hasSize(1);
    }

    @Test
    void shouldPreserveDistinctMeasurementLocationsAtSameTimestamp() {
        String stationId = "STATION-MV-01";
        String messageId = "msg-mv-loc-distinct";

        // Same timestamp, same measurand, but distinct locations (Inlet vs Outlet)
        String ocppCall = """
                [2, "%s", "MeterValues", {
                    "evseId": 1,
                    "meterValue": [
                        {
                            "timestamp": "2026-11-27T14:00:00Z",
                            "sampledValue": [
                                {
                                    "value": 230.0,
                                    "context": "Sample.Periodic",
                                    "measurand": "Voltage",
                                    "location": "Inlet",
                                    "unitOfMeasure": { "unit": "V", "multiplier": 0 }
                                },
                                {
                                    "value": 228.5,
                                    "context": "Sample.Periodic",
                                    "measurand": "Voltage",
                                    "location": "Outlet",
                                    "unitOfMeasure": { "unit": "V", "multiplier": 0 }
                                }
                            ]
                        }
                    ]
                }]
                """.formatted(messageId);

        String response = messageProcessor.process(stationId, ocppCall);
        assertThat(response).contains("3", messageId);

        var samples = meterValueService.getMeterValues(stationId, 1);
        var inletSample = samples.stream().filter(s -> "Inlet".equals(s.location())).findFirst();
        var outletSample = samples.stream().filter(s -> "Outlet".equals(s.location())).findFirst();

        assertThat(inletSample).isPresent();
        assertThat(outletSample).isPresent();
        assertThat(inletSample.get().rawValue()).isEqualByComparingTo(new BigDecimal("230.0"));
        assertThat(outletSample.get().rawValue()).isEqualByComparingTo(new BigDecimal("228.5"));
    }

    @Test
    void shouldSafelyHandleConflictingDuplicateSamplesWithoutCorruptingData() {
        String stationId = "STATION-MV-02";

        String firstCall = """
                [2, "msg-conflict-1", "MeterValues", {
                    "evseId": 3,
                    "meterValue": [
                        {
                            "timestamp": "2026-11-27T15:00:00Z",
                            "sampledValue": [
                                {
                                    "value": 100.0,
                                    "context": "Sample.Periodic",
                                    "measurand": "Current.Import",
                                    "location": "Outlet",
                                    "unitOfMeasure": { "unit": "A", "multiplier": 0 }
                                }
                            ]
                        }
                    ]
                }]
                """;

        String conflictCall = """
                [2, "msg-conflict-2", "MeterValues", {
                    "evseId": 3,
                    "meterValue": [
                        {
                            "timestamp": "2026-11-27T15:00:00Z",
                            "sampledValue": [
                                {
                                    "value": 999.0,
                                    "context": "Sample.Periodic",
                                    "measurand": "Current.Import",
                                    "location": "Outlet",
                                    "unitOfMeasure": { "unit": "A", "multiplier": 0 }
                                }
                            ]
                        }
                    ]
                }]
                """;

        messageProcessor.process(stationId, firstCall);
        // Conflicting sample for exact same timestamp and location
        messageProcessor.process(stationId, conflictCall);

        var samples = meterValueService.getMeterValues(stationId, 3);
        assertThat(samples).hasSize(1);
        // Authoritative sample (100.0) retained
        assertThat(samples.get(0).rawValue()).isEqualByComparingTo(new BigDecimal("100.0"));
    }

    @Test
    void shouldRejectExcessiveMultipliers() {
        assertThatThrownBy(() -> meterValueService.normalize(BigDecimal.TEN, "Wh", 13))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bounds [-12, 12]");

        assertThatThrownBy(() -> meterValueService.normalize(BigDecimal.TEN, "Wh", -13))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bounds [-12, 12]");

        // Valid boundary values succeed
        assertThat(meterValueService.normalize(BigDecimal.ONE, "Wh", 12))
                .isEqualByComparingTo(new BigDecimal("1000000000000"));
        assertThat(meterValueService.normalize(new BigDecimal("1000000000000"), "Wh", -12))
                .isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void shouldProvideBoundedTenantScopedPagination() {
        String stationId = "STATION-MV-01";
        // Create an organization station
        organizationRepository.save(new com.voltgrid.station.infrastructure.persistence.jpa.OrganizationEntity(
                "org-alpha", "Alpha Org", "ACTIVE"
        ));
        stationRepository.save(new ChargingStationEntity(
                "STATION-ORG-TEST", "Org Station", com.voltgrid.station.domain.StationStatus.ONLINE,
                null, "org-alpha", null
        ));

        // Valid organization query succeeds
        var orgSamples = meterValueService.getMeterValues("org-alpha", "STATION-ORG-TEST", 1, 0, 10);
        assertThat(orgSamples).isNotNull();

        // Cross-tenant access denied
        assertThatThrownBy(() -> meterValueService.getMeterValues("org-beta", "STATION-ORG-TEST", 1, 0, 10))
                .isInstanceOf(TenantAccessDeniedException.class)
                .hasMessageContaining("does not belong to organization");
    }

    @Test
    void shouldRejectInvalidEvseIdInMeterValues() {
        String stationId = "STATION-MV-03";
        String messageId = "msg-mv-err";

        String invalidOcppCall = """
                [2, "%s", "MeterValues", {
                    "evseId": -1,
                    "meterValue": []
                }]
                """.formatted(messageId);

        String response = messageProcessor.process(stationId, invalidOcppCall);
        assertThat(response).contains("4", messageId, "FormatViolation");
    }
}
