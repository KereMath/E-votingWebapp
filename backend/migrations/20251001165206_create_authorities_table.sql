-- Create authorities table
CREATE TABLE IF NOT EXISTS authorities (
    id SERIAL PRIMARY KEY,
    tc_hash VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link authorities to polls (n:m relationship)
CREATE TABLE IF NOT EXISTS poll_authorities (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    authority_id INTEGER NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
    -- Authority'nin bu poll için key'leri üretip üretmediği
    keys_generated BOOLEAN NOT NULL DEFAULT FALSE,
    keys_generated_at TIMESTAMPTZ,
    UNIQUE(poll_id, authority_id)
);

-- Indexes
CREATE INDEX idx_poll_authorities_poll_id ON poll_authorities(poll_id);
CREATE INDEX idx_poll_authorities_authority_id ON poll_authorities(authority_id);
CREATE INDEX idx_authorities_email ON authorities(email);
