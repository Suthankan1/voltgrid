CREATE TABLE station_status_projections (
    station_id VARCHAR(128) PRIMARY KEY,
    current_status VARCHAR(32) NOT NULL,
    last_event_id UUID NOT NULL,
    status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX uq_station_status_projections_last_event_id
    ON station_status_projections (last_event_id);