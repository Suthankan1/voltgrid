CREATE TABLE transaction_event_receipts (
    station_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    sequence_number INTEGER NOT NULL,
    event_type VARCHAR(16) NOT NULL,

    PRIMARY KEY (
        station_id,
        transaction_id,
        sequence_number
    ),

    CONSTRAINT fk_transaction_event_receipts_transaction
        FOREIGN KEY (
            station_id,
            transaction_id
        )
        REFERENCES charging_transactions(
            station_id,
            transaction_id
        )
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,

    CONSTRAINT chk_transaction_event_receipts_sequence
        CHECK (sequence_number >= 0),

    CONSTRAINT chk_transaction_event_receipts_type
        CHECK (
            event_type IN (
                'STARTED',
                'UPDATED',
                'ENDED'
            )
        )
);