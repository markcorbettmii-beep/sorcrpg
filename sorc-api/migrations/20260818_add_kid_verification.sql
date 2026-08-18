-- Add K-ID verification tracking columns to users table
ALTER TABLE users ADD COLUMN kid_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN kid_verified_at TIMESTAMP;
