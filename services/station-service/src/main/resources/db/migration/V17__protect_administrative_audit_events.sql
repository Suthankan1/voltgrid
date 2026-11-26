CREATE FUNCTION reject_administrative_audit_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Administrative audit events are append-only';
END;
$$;

CREATE TRIGGER administrative_audit_events_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON administrative_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_administrative_audit_rewrite();
