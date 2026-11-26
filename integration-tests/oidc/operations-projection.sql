-- Apply to the isolated Operations database after Flyway.
INSERT INTO station_status_projections
    (station_id, current_status, last_event_id, status_changed_at, updated_at, organization_id)
VALUES
    ('VG-FIXTURE-A-STATION', 'OFFLINE', 'a76c7adc-f85c-472d-8306-938d4202ab99', now(), now(), 'org_fixture_a')
ON CONFLICT (station_id) DO NOTHING;
