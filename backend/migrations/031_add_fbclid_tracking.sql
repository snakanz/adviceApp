-- Add Meta/Facebook click tracking columns for Conversions API attribution
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS fbclid TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS meta_purchase_sent BOOLEAN DEFAULT FALSE;
