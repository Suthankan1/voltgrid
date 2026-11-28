package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ChargingStationJpaRepository
        extends JpaRepository<ChargingStationEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select station from ChargingStationEntity station where station.id = :id")
    Optional<ChargingStationEntity> findByIdForUpdate(String id);

    @Modifying
    @Query(value = """
            INSERT INTO charging_stations (id, name, status, organization_id, site_id)
            VALUES (:id, :name, :status, :organizationId, :siteId)
            ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    int insertStation(String id, String name, String status, String organizationId, String siteId);
}