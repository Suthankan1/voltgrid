-- V16: Remediate unsafe multi-tenant defaults and predictable credentials (IAM-008)

-- 1. Widen station_credentials.id to VARCHAR(300) so 'cred_' || station_id cannot overflow
ALTER TABLE station_credentials
    ALTER COLUMN id TYPE VARCHAR(300);

-- 2. Remove default assignment to 'org_voltgrid_default' from charging_stations and allow nullable for unregistered hardware
ALTER TABLE charging_stations
    ALTER COLUMN organization_id DROP DEFAULT,
    ALTER COLUMN organization_id DROP NOT NULL;

-- 3. Remove predictable default credentials generated from synthetic seed (e.g. 'StationSecret123!')
DELETE FROM station_credentials
WHERE password_hash = 'pbkdf2:766f6c746772696473616c74:3d1e289fcfa09be74dca7389104c8681b997c27181c4e7aa1bcceb942e038841';

-- 4. Remove synthetic memberships introduced in development migration
DELETE FROM organization_memberships
WHERE id IN ('mem_default_admin', 'mem_default_operator');

-- 5. Quarantine legacy station assignments made by V15. Retain station and transaction IDs.
UPDATE charging_stations
SET organization_id = NULL, site_id = NULL
WHERE organization_id = 'org_voltgrid_default' AND site_id = 'site_voltgrid_colombo';

DELETE FROM sites
WHERE id = 'site_voltgrid_colombo'
  AND NOT EXISTS (SELECT 1 FROM charging_stations WHERE site_id = sites.id);
