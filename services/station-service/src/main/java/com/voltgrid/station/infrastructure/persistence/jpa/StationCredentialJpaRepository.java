package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StationCredentialJpaRepository
        extends JpaRepository<StationCredentialEntity, String> {

    List<StationCredentialEntity> findByStationIdAndStatus(String stationId, String status);

    List<StationCredentialEntity> findByStationId(String stationId);

    Optional<StationCredentialEntity> findFirstByStationIdAndStatusOrderByCreatedAtDesc(String stationId, String status);
}
