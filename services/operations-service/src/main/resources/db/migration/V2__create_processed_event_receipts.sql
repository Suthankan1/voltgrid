CREATE TABLE processed_event_receipts (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(128) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL
);