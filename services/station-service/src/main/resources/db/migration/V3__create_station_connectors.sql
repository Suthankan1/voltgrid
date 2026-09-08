CREATE TABLE station_connectors (
    station_id VARCHAR(255) NOT NULL,
    evse_id INTEGER NOT NULL,
    connector_id INTEGER NOT NULL,
    status VARCHAR(255) NOT NULL,
    status_updated_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (
        station_id,
        evse_id,
        connector_id
    ),

    CONSTRAINT fk_station_connectors_station
        FOREIGN KEY (station_id)
        REFERENCES charging_stations(id)
        ON DELETE CASCADE
);