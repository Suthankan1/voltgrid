-- Run as the same maintenance administrator after upgrading, or when abandoning the upgrade.
BEGIN;
DROP EVENT TRIGGER IF EXISTS voltgrid_widen_v15_credential_id;
DROP FUNCTION IF EXISTS voltgrid_v15_maintenance.widen_credential_id();
DROP SCHEMA IF EXISTS voltgrid_v15_maintenance;
COMMIT;
