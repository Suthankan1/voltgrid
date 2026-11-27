package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface StationMeterValueJpaRepository extends JpaRepository<StationMeterValueEntity, Long> {

    List<StationMeterValueEntity> findByStationIdAndEvseIdOrderBySampledAtDesc(String stationId, int evseId);

    List<StationMeterValueEntity> findByStationIdAndTransactionIdOrderBySampledAtDesc(String stationId, String transactionId);

    @Query("SELECT m FROM StationMeterValueEntity m WHERE m.stationId = :stationId AND m.evseId = :evseId AND m.sampledAt = :sampledAt AND m.measurand = :measurand AND COALESCE(m.phase, 'NONE') = :phase AND COALESCE(m.context, 'NONE') = :context")
    Optional<StationMeterValueEntity> findDuplicate(
            @Param("stationId") String stationId,
            @Param("evseId") int evseId,
            @Param("sampledAt") Instant sampledAt,
            @Param("measurand") String measurand,
            @Param("phase") String phase,
            @Param("context") String context
    );
}
