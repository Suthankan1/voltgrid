ALTER TABLE outbox_events
    ADD COLUMN trace_context JSONB;

ALTER TABLE outbox_events
    ADD CONSTRAINT chk_outbox_events_trace_context_object
        CHECK (
            trace_context IS NULL
            OR jsonb_typeof(trace_context) = 'object'
        );