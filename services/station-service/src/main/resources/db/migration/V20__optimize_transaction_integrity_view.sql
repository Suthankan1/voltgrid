-- Optimize transaction integrity view: replace generate_series with index-backed count/boundary invariants
-- Eliminates memory series explosion (DATA-002) and blind spots beyond 10,000 sequence jumps (BUG-001)

CREATE OR REPLACE VIEW transaction_integrity_status AS
SELECT
    transaction.station_id,
    transaction.transaction_id,
    first_receipt.sequence_number AS first_sequence_number,

    CASE
        WHEN first_receipt.sequence_number IS NULL
            THEN 'UNKNOWN'

        WHEN first_receipt.event_type <> 'STARTED'
            THEN 'UNKNOWN'

        WHEN transaction.status = 'ACTIVE'
            THEN 'IN_PROGRESS'

        WHEN receipt_stats.receipt_count < (transaction.last_sequence_number - first_receipt.sequence_number + 1)
            THEN 'INCOMPLETE'

        WHEN receipt_stats.max_sequence_number < transaction.last_sequence_number
            THEN 'INCOMPLETE'

        ELSE 'COMPLETE'
    END AS integrity_status

FROM charging_transactions transaction

LEFT JOIN LATERAL (
    SELECT
        receipt.sequence_number,
        receipt.event_type
    FROM transaction_event_receipts receipt
    WHERE receipt.station_id = transaction.station_id
      AND receipt.transaction_id = transaction.transaction_id
    ORDER BY receipt.sequence_number ASC
    LIMIT 1
) first_receipt ON true

LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT receipt.sequence_number) AS receipt_count,
        MAX(receipt.sequence_number) AS max_sequence_number
    FROM transaction_event_receipts receipt
    WHERE receipt.station_id = transaction.station_id
      AND receipt.transaction_id = transaction.transaction_id
) receipt_stats ON true;
