-- 1. Standalone Station Meter Values Table
CREATE TABLE station_meter_values (
    id BIGSERIAL PRIMARY KEY,
    station_id VARCHAR(255) NOT NULL,
    evse_id INTEGER NOT NULL DEFAULT 0,
    connector_id INTEGER,
    transaction_id VARCHAR(255),
    sampled_at TIMESTAMPTZ NOT NULL,
    raw_value NUMERIC(24, 8) NOT NULL,
    normalized_value NUMERIC(24, 8) NOT NULL,
    measurand VARCHAR(128) NOT NULL DEFAULT 'Energy.Active.Import.Register',
    context VARCHAR(64) DEFAULT 'Sample.Periodic',
    phase VARCHAR(32),
    location VARCHAR(64) DEFAULT 'Outlet',
    unit VARCHAR(64) DEFAULT 'Wh',
    unit_multiplier INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_station_meter_values_evse CHECK (evse_id >= 0)
);

CREATE INDEX idx_station_meter_values_lookup 
    ON station_meter_values (station_id, evse_id, sampled_at DESC);

CREATE INDEX idx_station_meter_values_tx 
    ON station_meter_values (station_id, transaction_id, sampled_at DESC) 
    WHERE transaction_id IS NOT NULL;

CREATE UNIQUE INDEX uq_station_meter_values_sample 
    ON station_meter_values (station_id, evse_id, sampled_at, measurand, COALESCE(phase, 'NONE'), COALESCE(context, 'NONE'));

-- 2. Station Command Lifecycle Table
CREATE TABLE station_commands (
    id UUID PRIMARY KEY,
    station_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(128),
    payload TEXT,
    response_payload TEXT,
    transaction_id VARCHAR(255),
    requested_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ,
    observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_station_command_status CHECK (
        status IN ('REQUESTED', 'PENDING', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'UNCERTAIN', 'OBSERVED')
    )
);

CREATE INDEX idx_station_commands_station_status 
    ON station_commands (station_id, status, requested_at DESC);

CREATE INDEX idx_station_commands_message_id 
    ON station_commands (station_id, message_id);

CREATE UNIQUE INDEX uq_station_commands_idempotency 
    ON station_commands (station_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
