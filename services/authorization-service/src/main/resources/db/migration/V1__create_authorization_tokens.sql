CREATE TABLE authorization_tokens (
    id UUID PRIMARY KEY,

    token_fingerprint VARCHAR(64) NOT NULL,

    status VARCHAR(16) NOT NULL,

    expires_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL,

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,

    CONSTRAINT uk_authorization_tokens_fingerprint
        UNIQUE (token_fingerprint),

    CONSTRAINT chk_authorization_tokens_status
        CHECK (status IN ('ACTIVE', 'BLOCKED'))
);