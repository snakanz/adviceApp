-- Add client IP and user agent columns for Meta CAPI event match quality
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_client_ip TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_client_user_agent TEXT;
