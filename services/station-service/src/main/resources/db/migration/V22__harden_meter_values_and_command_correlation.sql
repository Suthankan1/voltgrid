-- Drop old unique index on meter values and recreate with location
DROP INDEX IF EXISTS uq_station_meter_values_sample;

CREATE UNIQUE INDEX uq_station_meter_values_sample 
    ON station_meter_values (
        station_id, 
        evse_id, 
        sampled_at, 
        measurand, 
        COALESCE(phase, 'NONE'), 
        COALESCE(context, 'NONE'), 
        COALESCE(location, 'NONE')
    );

-- Add remote_start_id and evse_id to station_commands for accurate correlation
ALTER TABLE station_commands ADD COLUMN IF NOT EXISTS remote_start_id INTEGER;
ALTER TABLE station_commands ADD COLUMN IF NOT EXISTS evse_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_station_commands_remote_start 
    ON station_commands (station_id, remote_start_id, status) 
    WHERE remote_start_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_station_commands_evse_status 
    ON station_commands (station_id, evse_id, status) 
    WHERE evse_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_station_commands_tx_status 
    ON station_commands (station_id, transaction_id, status) 
    WHERE transaction_id IS NOT NULL;
