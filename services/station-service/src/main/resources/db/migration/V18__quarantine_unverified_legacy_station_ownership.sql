-- V15 assigned the default organization before its backfill ran, leaving some legacy
-- stations with that organization and a NULL site. Those rows require explicit mapping.
UPDATE charging_stations
SET organization_id = NULL, site_id = NULL
WHERE organization_id = 'org_voltgrid_default';

-- Retain the station and its history when the existing site association is invalid.
UPDATE charging_stations AS station
SET site_id = NULL
WHERE station.site_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM sites
      WHERE id = station.site_id AND organization_id = station.organization_id
  );

ALTER TABLE sites ADD CONSTRAINT uk_sites_organization_id UNIQUE (organization_id, id);
ALTER TABLE charging_stations
    ADD CONSTRAINT ck_charging_station_site_requires_organization
        CHECK (site_id IS NULL OR organization_id IS NOT NULL),
    ADD CONSTRAINT fk_charging_station_site_organization
        FOREIGN KEY (organization_id, site_id) REFERENCES sites(organization_id, id);
