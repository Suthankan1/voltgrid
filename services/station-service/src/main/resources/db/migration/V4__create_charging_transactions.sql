CREATE TABLE charging_transactions (
    station_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    evse_id INTEGER NOT NULL,
    connector_id INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    last_sequence_number INTEGER NOT NULL,

    PRIMARY KEY (
        station_id,
        transaction_id
    ),

    CONSTRAINT fk_charging_transactions_station
        FOREIGN KEY (station_id)
        REFERENCES charging_stations(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_charging_transactions_evse
        CHECK (evse_id > 0),

    CONSTRAINT chk_charging_transactions_connector
        CHECK (connector_id > 0),

    CONSTRAINT chk_charging_transactions_sequence
        CHECK (last_sequence_number >= 0)
);