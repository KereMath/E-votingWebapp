-- Create polls table
CREATE TABLE IF NOT EXISTS polls (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES admins(id),
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, setup_pending, active, closed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

-- Create poll_setup table for storing cryptographic parameters
CREATE TABLE IF NOT EXISTS poll_setup (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL UNIQUE REFERENCES polls(id) ON DELETE CASCADE,
    
    -- Pairing parameters (stored as hex strings)
    pairing_param TEXT NOT NULL,
    prime_order TEXT NOT NULL,
    g1 TEXT NOT NULL,
    g2 TEXT NOT NULL,
    h1 TEXT NOT NULL,
    
    -- Setup metadata
    security_level INTEGER NOT NULL DEFAULT 256,
    setup_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    setup_by INTEGER NOT NULL REFERENCES admins(id)
);

-- Create poll_voters junction table (which voters can vote in which poll)
CREATE TABLE IF NOT EXISTS poll_voters (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    voter_id INTEGER NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    voted_at TIMESTAMPTZ,
    UNIQUE(poll_id, voter_id)
);

-- Create indexes
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_created_by ON polls(created_by);
CREATE INDEX idx_poll_setup_poll_id ON poll_setup(poll_id);
CREATE INDEX idx_poll_voters_poll_id ON poll_voters(poll_id);
CREATE INDEX idx_poll_voters_voter_id ON poll_voters(voter_id);