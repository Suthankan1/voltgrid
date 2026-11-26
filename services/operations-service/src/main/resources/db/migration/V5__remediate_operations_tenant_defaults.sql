-- V5: Remediate unsafe default tenant assignment on operations projections

-- 1. Remove default assignment to 'org_voltgrid_default' from station_status_projections
ALTER TABLE station_status_projections
    ALTER COLUMN organization_id DROP DEFAULT,
    ALTER COLUMN organization_id DROP NOT NULL;

-- Ownership of pre-V5 default rows must be established by a new authoritative event.
UPDATE station_status_projections SET organization_id = NULL
WHERE organization_id = 'org_voltgrid_default';
