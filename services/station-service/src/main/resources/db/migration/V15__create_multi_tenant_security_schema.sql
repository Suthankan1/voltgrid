-- V15: Multi-tenant organization model, station credentials, and administrative audit trail

-- 1. Organizations table
CREATE TABLE organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Sites table
CREATE TABLE sites (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_organization ON sites(organization_id);

-- 3. Organization Memberships table
CREATE TABLE organization_memberships (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_organization_user UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org ON organization_memberships(organization_id);

-- 4. Seed default organization and site for backward compatibility
INSERT INTO organizations (id, name, status, created_at, updated_at)
VALUES ('org_voltgrid_default', 'VoltGrid Commercial Operations', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO sites (id, organization_id, name, status, created_at)
VALUES ('site_voltgrid_colombo', 'org_voltgrid_default', 'Colombo Flagship Station', 'ACTIVE', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_memberships (id, organization_id, user_id, user_email, role, status, created_at, updated_at)
VALUES ('mem_default_admin', 'org_voltgrid_default', 'sub_admin_001', 'admin@voltgrid.lk', 'ORG_OWNER', 'ACTIVE', NOW(), NOW())
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO organization_memberships (id, organization_id, user_id, user_email, role, status, created_at, updated_at)
VALUES ('mem_default_operator', 'org_voltgrid_default', 'sub_operator_001', 'operator@voltgrid.lk', 'OPERATOR', 'ACTIVE', NOW(), NOW())
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 5. Alter charging_stations to add organization_id and site_id with default
ALTER TABLE charging_stations
    ADD COLUMN organization_id VARCHAR(64) REFERENCES organizations(id) DEFAULT 'org_voltgrid_default',
    ADD COLUMN site_id VARCHAR(64) REFERENCES sites(id);

-- Backfill existing charging stations to the default organization and site
UPDATE charging_stations
SET organization_id = 'org_voltgrid_default',
    site_id = 'site_voltgrid_colombo'
WHERE organization_id IS NULL;

-- Enforce NOT NULL and DEFAULT on organization_id
ALTER TABLE charging_stations
    ALTER COLUMN organization_id SET NOT NULL,
    ALTER COLUMN organization_id SET DEFAULT 'org_voltgrid_default';

CREATE INDEX idx_charging_stations_org ON charging_stations(organization_id);
CREATE INDEX idx_charging_stations_site ON charging_stations(site_id);

-- 6. Station Credentials table (OCPP Security Profile 2 basic auth & Profile 3 certificate foundation)
CREATE TABLE station_credentials (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(255) NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
    credential_type VARCHAR(32) NOT NULL DEFAULT 'BASIC_AUTH',
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_station_credentials_station_status ON station_credentials(station_id, status);

-- Seed default credentials for existing test stations (e.g. SHA-256 salted hash of 'StationSecret123!')
-- Hash format: pbkdf2:<salt_hex>:<hash_hex>
INSERT INTO station_credentials (id, station_id, credential_type, password_hash, status, created_at)
SELECT
    'cred_' || id,
    id,
    'BASIC_AUTH',
    'pbkdf2:766f6c746772696473616c74:3d1e289fcfa09be74dca7389104c8681b997c27181c4e7aa1bcceb942e038841', -- 'StationSecret123!'
    'ACTIVE',
    NOW()
FROM charging_stations
ON CONFLICT (id) DO NOTHING;

-- 7. Administrative Audit Events table (Append-only audit trail)
CREATE TABLE administrative_audit_events (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(32) NOT NULL DEFAULT 'USER',
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    outcome VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    correlation_id VARCHAR(128),
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_org_created ON administrative_audit_events(organization_id, created_at DESC);
CREATE INDEX idx_audit_events_resource ON administrative_audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_events_actor ON administrative_audit_events(actor_id, created_at DESC);
