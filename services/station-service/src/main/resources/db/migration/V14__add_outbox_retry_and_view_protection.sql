ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE VIEW transaction_integrity_status AS
SELECT
    transaction.station_id,
    transaction.transaction_id,
    first_receipt.sequence_number
        AS first_sequence_number,

    CASE
        WHEN first_receipt.sequence_number IS NULL
            THEN 'UNKNOWN'

        WHEN first_receipt.event_type <> 'STARTED'
            THEN 'UNKNOWN'

        WHEN transaction.status = 'ACTIVE'
            THEN 'IN_PROGRESS'

        WHEN EXISTS (
            SELECT 1
            FROM generate_series(
                first_receipt.sequence_number,
                LEAST(transaction.last_sequence_number, first_receipt.sequence_number + 10000)
            ) AS expected(sequence_number)
            WHERE NOT EXISTS (
                SELECT 1
                FROM transaction_event_receipts receipt
                WHERE receipt.station_id =
                          transaction.station_id
                  AND receipt.transaction_id =
                          transaction.transaction_id
                  AND receipt.sequence_number =
                          expected.sequence_number
            )
        )
            THEN 'INCOMPLETE'

        ELSE 'COMPLETE'
    END AS integrity_status

FROM charging_transactions transaction

LEFT JOIN LATERAL (
    SELECT
        receipt.sequence_number,
        receipt.event_type
    FROM transaction_event_receipts receipt
    WHERE receipt.station_id =
              transaction.station_id
      AND receipt.transaction_id =
              transaction.transaction_id
    ORDER BY receipt.sequence_number ASC
    LIMIT 1
) first_receipt ON true;
