CREATE TABLE IF NOT EXISTS voters (
    id SERIAL PRIMARY KEY,
    tc_hash VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_hash VARCHAR(64) NOT NULL UNIQUE,
    -- Bu seçmenin oy kullanıp kullanmadığını veya kimlik bilgilerinin
    -- doğrulanıp doğrulanmadığını takip etmek için bir durum alanı eklenebilir.
    -- status VARCHAR(50) NOT NULL DEFAULT 'registered', 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);