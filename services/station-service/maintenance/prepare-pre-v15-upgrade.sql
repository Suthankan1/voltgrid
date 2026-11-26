-- Run as a PostgreSQL superuser on the offline Station database, using psql ON_ERROR_STOP.
BEGIN;
SET LOCAL search_path = pg_catalog;

DO $preflight$
BEGIN
    IF to_regclass('public.flyway_schema_history') IS NULL
        OR to_regclass('public.charging_stations') IS NULL THEN
        RAISE EXCEPTION 'Expected a Flyway-managed Station schema in public';
    END IF;

    IF EXISTS (SELECT FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Inspect failed Flyway history before preparing the upgrade';
    END IF;

    IF EXISTS (SELECT FROM public.flyway_schema_history WHERE version = '15') THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT FROM public.flyway_schema_history WHERE version = '14')
        OR to_regclass('public.station_credentials') IS NOT NULL THEN
        RAISE EXCEPTION 'Expected the Station schema at V14 with V15 still pending';
    END IF;

    IF NOT EXISTS (SELECT FROM public.charging_stations WHERE char_length(id) > 59) THEN
        RETURN;
    END IF;

    CREATE SCHEMA IF NOT EXISTS voltgrid_v15_maintenance;

    CREATE OR REPLACE FUNCTION voltgrid_v15_maintenance.widen_credential_id()
    RETURNS event_trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = pg_catalog
    AS $trigger$
    BEGIN
        IF EXISTS (
            SELECT FROM pg_event_trigger_ddl_commands() AS command
            JOIN pg_class AS relation ON relation.oid = command.objid
            JOIN pg_attribute AS attribute ON attribute.attrelid = relation.oid
            WHERE command.classid = 'pg_class'::regclass
              AND command.command_tag = 'CREATE TABLE'
              AND relation.oid = to_regclass('public.station_credentials')
              AND attribute.attname = 'id'
              AND format_type(attribute.atttypid, attribute.atttypmod) = 'character varying(64)'
        ) THEN
            ALTER TABLE public.station_credentials ALTER COLUMN id TYPE varchar(300);
        END IF;
    END;
    $trigger$;

    DROP EVENT TRIGGER IF EXISTS voltgrid_widen_v15_credential_id;
    CREATE EVENT TRIGGER voltgrid_widen_v15_credential_id ON ddl_command_end
        WHEN TAG IN ('CREATE TABLE')
        EXECUTE FUNCTION voltgrid_v15_maintenance.widen_credential_id();
END;
$preflight$;

COMMIT;
