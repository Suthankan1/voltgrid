ALTER TABLE charging_stations
    ADD COLUMN IF NOT EXISTS connection_generation BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status_sequence_number BIGINT NOT NULL DEFAULT 0;
