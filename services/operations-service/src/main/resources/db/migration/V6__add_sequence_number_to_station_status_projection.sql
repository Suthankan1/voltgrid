ALTER TABLE station_status_projections
    ADD COLUMN IF NOT EXISTS sequence_number BIGINT NOT NULL DEFAULT 0;
