-- Add authority management to polls
ALTER TABLE poll_authorities ADD COLUMN IF NOT EXISTS sgk1 TEXT;
ALTER TABLE poll_authorities ADD COLUMN IF NOT EXISTS sgk2 TEXT;
ALTER TABLE poll_authorities ADD COLUMN IF NOT EXISTS vkm1 TEXT;
ALTER TABLE poll_authorities ADD COLUMN IF NOT EXISTS vkm2 TEXT;
ALTER TABLE poll_authorities ADD COLUMN IF NOT EXISTS vkm3 TEXT;
ALTER TABLE poll_authorities ADD COLUMN IF NOT EXISTS keys_received_at TIMESTAMPTZ;

-- Master verification keys table
CREATE TABLE IF NOT EXISTS poll_mvk (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL UNIQUE REFERENCES polls(id) ON DELETE CASCADE,
    alpha2 TEXT NOT NULL,
    beta2 TEXT NOT NULL,
    beta1 TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    total_authorities INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by INTEGER NOT NULL REFERENCES admins(id)
);

CREATE INDEX idx_poll_mvk_poll_id ON poll_mvk(poll_id);