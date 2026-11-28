CREATE OR REPLACE VIEW transaction_integrity_status AS
SELECT
    transaction.station_id,
    transaction.transaction_id,
    first_receipt.sequence_number AS first_sequence_number,
    CASE
        WHEN first_receipt.sequence_number IS NULL
            OR first_receipt.event_type <> 'STARTED'
            OR first_receipt.sequence_number < 0
            OR first_receipt.sequence_number > transaction.last_sequence_number
            THEN 'UNKNOWN'
        WHEN transaction.status = 'ACTIVE'
            THEN 'IN_PROGRESS'
        WHEN NOT receipt_stats.has_end_receipt
            OR receipt_stats.receipt_count <>
                (transaction.last_sequence_number::bigint - first_receipt.sequence_number + 1)
            THEN 'INCOMPLETE'
        ELSE 'COMPLETE'
    END AS integrity_status
FROM charging_transactions transaction
LEFT JOIN LATERAL (
    SELECT receipt.sequence_number, receipt.event_type
    FROM transaction_event_receipts receipt
    WHERE receipt.station_id = transaction.station_id
      AND receipt.transaction_id = transaction.transaction_id
    ORDER BY receipt.sequence_number
    LIMIT 1
) first_receipt ON true
LEFT JOIN LATERAL (
    -- The receipt primary key is unique per transaction and sequence.
    SELECT
        COUNT(*) AS receipt_count,
        COUNT(*) FILTER (
            WHERE receipt.sequence_number = transaction.last_sequence_number
              AND receipt.event_type = 'ENDED'
        ) > 0 AS has_end_receipt
    FROM transaction_event_receipts receipt
    WHERE receipt.station_id = transaction.station_id
      AND receipt.transaction_id = transaction.transaction_id
      AND receipt.sequence_number BETWEEN first_receipt.sequence_number AND transaction.last_sequence_number
) receipt_stats ON true;
