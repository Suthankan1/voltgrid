CREATE INDEX idx_station_status_projections_status_station_id
    ON station_status_projections (
        current_status,
        station_id
    );