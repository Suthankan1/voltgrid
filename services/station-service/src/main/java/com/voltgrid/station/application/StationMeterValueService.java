package com.voltgrid.station.application;

import com.voltgrid.station.api.ocpp.TransactionEventRequest;
import com.voltgrid.station.application.security.TenantAccessDeniedException;
import com.voltgrid.station.domain.StationMeterValue;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.StationMeterValueEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.StationMeterValueJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class StationMeterValueService {

    private static final Logger log = LoggerFactory.getLogger(StationMeterValueService.class);

    private final StationMeterValueJpaRepository repository;
    private final ChargingStationJpaRepository chargingStationRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public StationMeterValueService(
            StationMeterValueJpaRepository repository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) ChargingStationJpaRepository chargingStationRepository
    ) {
        this.repository = repository;
        this.chargingStationRepository = chargingStationRepository;
    }

    public StationMeterValueService(StationMeterValueJpaRepository repository) {
        this(repository, null);
    }

    @Transactional
    public List<StationMeterValue> recordMeterValues(
            String stationId,
            int evseId,
            List<TransactionEventRequest.MeterValue> meterValues
    ) {
        if (meterValues == null || meterValues.isEmpty()) {
            return List.of();
        }

        var results = new ArrayList<StationMeterValue>();

        for (var mv : meterValues) {
            if (mv == null || mv.timestamp() == null || mv.timestamp().isBlank()) {
                continue;
            }

            Instant sampledAt;
            try {
                sampledAt = OffsetDateTime.parse(mv.timestamp()).toInstant();
            } catch (Exception ex) {
                try {
                    sampledAt = Instant.parse(mv.timestamp());
                } catch (Exception inner) {
                    log.warn("Invalid timestamp in MeterValues: {}", mv.timestamp());
                    continue;
                }
            }

            if (mv.sampledValue() == null) {
                continue;
            }

            for (var sv : mv.sampledValue()) {
                if (sv == null || sv.value() == null) {
                    continue;
                }

                String measurand = sv.measurand() != null && !sv.measurand().isBlank()
                        ? sv.measurand() : "Energy.Active.Import.Register";
                String context = sv.context() != null && !sv.context().isBlank()
                        ? sv.context() : "Sample.Periodic";
                String phase = sv.phase();
                String location = sv.location() != null && !sv.location().isBlank()
                        ? sv.location() : "Outlet";

                String rawUnit = sv.unitOfMeasure() != null && sv.unitOfMeasure().unit() != null
                        ? sv.unitOfMeasure().unit() : "Wh";
                int multiplier = sv.unitOfMeasure() != null && sv.unitOfMeasure().multiplier() != null
                        ? sv.unitOfMeasure().multiplier() : 0;

                BigDecimal rawValue = sv.value();
                BigDecimal normalizedValue;
                try {
                    normalizedValue = normalize(rawValue, rawUnit, multiplier);
                } catch (IllegalArgumentException ex) {
                    log.warn("Skipping meter value with invalid multiplier: {}", ex.getMessage());
                    continue;
                }

                var duplicate = repository.findDuplicate(
                        stationId,
                        evseId,
                        sampledAt,
                        measurand,
                        phase != null ? phase : "NONE",
                        context,
                        location
                );

                if (duplicate.isPresent()) {
                    var existing = duplicate.get();
                    if (existing.getRawValue().compareTo(rawValue) == 0) {
                        results.add(toDomain(existing));
                    } else {
                        log.warn("Conflicting meter value sample for station {} evse {} at {} (measurand={}, location={}): existing={}, incoming={}. Retaining authoritative existing sample.",
                                stationId, evseId, sampledAt, measurand, location, existing.getRawValue(), rawValue);
                        results.add(toDomain(existing));
                    }
                    continue;
                }

                var entity = new StationMeterValueEntity(
                        stationId,
                        evseId,
                        null,
                        null,
                        sampledAt,
                        rawValue,
                        normalizedValue,
                        measurand,
                        context,
                        phase,
                        location,
                        rawUnit,
                        multiplier
                );

                try {
                    entity = repository.save(entity);
                    results.add(toDomain(entity));
                } catch (org.springframework.dao.DataIntegrityViolationException dive) {
                    var fallback = repository.findDuplicate(
                            stationId, evseId, sampledAt, measurand, phase != null ? phase : "NONE", context, location
                    );
                    fallback.ifPresent(existing -> results.add(toDomain(existing)));
                }
            }
        }

        return List.copyOf(results);
    }

    public List<StationMeterValue> getMeterValues(
            String organizationId,
            String stationId,
            int evseId,
            int page,
            int size
    ) {
        validateStationTenant(organizationId, stationId);
        int boundedSize = Math.max(1, Math.min(size <= 0 ? 50 : size, 100));
        int boundedPage = Math.max(0, page);
        var pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "sampledAt"));
        return repository.findByStationIdAndEvseId(stationId, evseId, pageable)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    public List<StationMeterValue> getMeterValues(String stationId, int evseId) {
        return getMeterValues(null, stationId, evseId, 0, 50);
    }

    private void validateStationTenant(String organizationId, String stationId) {
        if (organizationId == null || organizationId.isBlank() || chargingStationRepository == null) {
            return;
        }
        var station = chargingStationRepository.findById(stationId);
        if (station.isEmpty() || station.get().getOrganizationId() == null || !station.get().getOrganizationId().equals(organizationId)) {
            throw new TenantAccessDeniedException("Station " + stationId + " does not belong to organization " + organizationId);
        }
    }

    BigDecimal normalize(BigDecimal rawValue, String unit, int multiplier) {
        if (multiplier < -12 || multiplier > 12) {
            throw new IllegalArgumentException("Meter value multiplier out of bounds [-12, 12]: " + multiplier);
        }

        BigDecimal scaled = rawValue;
        if (multiplier > 0) {
            scaled = rawValue.multiply(BigDecimal.TEN.pow(multiplier));
        } else if (multiplier < 0) {
            scaled = rawValue.divide(BigDecimal.TEN.pow(-multiplier), 8, RoundingMode.HALF_UP);
        }

        if ("kWh".equalsIgnoreCase(unit)) {
            return scaled.multiply(BigDecimal.valueOf(1000));
        } else if ("kW".equalsIgnoreCase(unit)) {
            return scaled.multiply(BigDecimal.valueOf(1000));
        }
        return scaled;
    }

    private StationMeterValue toDomain(StationMeterValueEntity entity) {
        return new StationMeterValue(
                entity.getId(),
                entity.getStationId(),
                entity.getEvseId(),
                entity.getConnectorId(),
                entity.getTransactionId(),
                entity.getSampledAt(),
                entity.getRawValue(),
                entity.getNormalizedValue(),
                entity.getMeasurand(),
                entity.getContext(),
                entity.getPhase(),
                entity.getLocation(),
                entity.getUnit(),
                entity.getUnitMultiplier()
        );
    }
}
