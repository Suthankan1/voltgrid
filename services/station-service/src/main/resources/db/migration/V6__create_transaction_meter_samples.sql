CREATE TABLE transaction_meter_samples (
    id BIGSERIAL PRIMARY KEY,

    station_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,

    sequence_number INTEGER NOT NULL,

    sampled_at TIMESTAMPTZ NOT NULL,

    value NUMERIC(24, 8) NOT NULL,

    measurand VARCHAR(255),
    context VARCHAR(64),
    phase VARCHAR(32),
    location VARCHAR(64),

    unit VARCHAR(64),
    unit_multiplier INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT fk_transaction_meter_samples_transaction
        FOREIGN KEY (
            station_id,
            transaction_id
        )
        REFERENCES charging_transactions(
            station_id,
            transaction_id
        )
        ON DELETE CASCADE,

    CONSTRAINT chk_transaction_meter_samples_sequence
        CHECK (sequence_number >= 0)
);

CREATE INDEX idx_transaction_meter_samples_transaction
    ON transaction_meter_samples (
        station_id,
        transaction_id,
        sampled_at
    );