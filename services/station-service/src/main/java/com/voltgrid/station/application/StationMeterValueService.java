package com.voltgrid.station.application;

import com.voltgrid.station.api.ocpp.TransactionEventRequest;
import com.voltgrid.station.domain.StationMeterValue;
import com.voltgrid.station.infrastructure.persistence.jpa.StationMeterValueEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.StationMeterValueJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    public StationMeterValueService(StationMeterValueJpaRepository repository) {
        this.repository = repository;
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
                BigDecimal normalizedValue = normalize(rawValue, rawUnit, multiplier);

                var duplicate = repository.findDuplicate(
                        stationId,
                        evseId,
                        sampledAt,
                        measurand,
                        phase != null ? phase : "NONE",
                        context
                );

                if (duplicate.isPresent()) {
                    results.add(toDomain(duplicate.get()));
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

                entity = repository.save(entity);
                results.add(toDomain(entity));
            }
        }

        return List.copyOf(results);
    }

    public List<StationMeterValue> getMeterValues(String stationId, int evseId) {
        return repository.findByStationIdAndEvseIdOrderBySampledAtDesc(stationId, evseId)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    private BigDecimal normalize(BigDecimal rawValue, String unit, int multiplier) {
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
