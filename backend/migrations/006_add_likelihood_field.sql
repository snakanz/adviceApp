-- Migration: Add likelihood field to clients table
-- This field stores the likelihood percentage (0-100) of a client signing up

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS likelihood INTEGER DEFAULT 75 CHECK (likelihood >= 0 AND likelihood <= 100);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_clients_likelihood ON clients(likelihood);

-- Add comment
COMMENT ON COLUMN clients.likelihood IS 'Likelihood percentage (0-100) of client signing up';

