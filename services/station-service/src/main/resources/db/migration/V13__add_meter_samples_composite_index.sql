CREATE INDEX IF NOT EXISTS idx_meter_samples_station_tx_seq
    ON transaction_meter_samples (station_id, transaction_id, sequence_number ASC);
