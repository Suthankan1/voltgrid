-- Apply after Flyway, on the isolated station test database.
INSERT INTO organizations (id, name)
VALUES ('org_fixture_a', 'OIDC Fixture A'), ('org_fixture_b', 'OIDC Fixture B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_memberships (id, organization_id, user_id, user_email, role)
VALUES
    ('mem_fixture_a_owner', 'org_fixture_a', '65203c33-875b-499b-97d3-5851bc2eec61', 'operator-a@example.test', 'ORG_OWNER'),
    ('mem_fixture_b_support', 'org_fixture_b', '65203c33-875b-499b-97d3-5851bc2eec61', 'operator-a@example.test', 'SUPPORT'),
    ('mem_fixture_b_owner', 'org_fixture_b', '53ee9752-d68c-4e7c-9e76-a958720fa482', 'operator-b@example.test', 'ORG_OWNER')
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO charging_stations (id, name, status, organization_id)
VALUES
    ('VG-FIXTURE-A-STATION', 'Fixture A Charging Station', 'OFFLINE', 'org_fixture_a'),
    ('VG-FIXTURE-B-STATION', 'Fixture B Charging Station', 'OFFLINE', 'org_fixture_b')
ON CONFLICT (id) DO NOTHING;
