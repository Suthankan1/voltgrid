-- V4: Widen station_id to VARCHAR(255) for DATA-001 parity and add organization_id for multi-tenancy

-- 1. Widen station_id column to 255 characters
ALTER TABLE station_status_projections
    ALTER COLUMN station_id TYPE VARCHAR(255);

-- 2. Add organization_id column with default
ALTER TABLE station_status_projections
    ADD COLUMN organization_id VARCHAR(64) NOT NULL DEFAULT 'org_voltgrid_default';

CREATE INDEX idx_station_status_org ON station_status_projections(organization_id, station_id);
