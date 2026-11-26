-- V2: Add key_version column to authorization_tokens for versioned HMAC key rotation

ALTER TABLE authorization_tokens
    ADD COLUMN key_version VARCHAR(32) NOT NULL DEFAULT 'v1';

CREATE INDEX idx_auth_tokens_fingerprint_version ON authorization_tokens(token_fingerprint, key_version);
