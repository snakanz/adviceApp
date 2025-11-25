-- Simplify business types and align client_business_types schema
-- Standardise business types to: Investment, Mortgage, Protection, Other
-- Add fee/close-date/notes fields and remove contribution-specific columns.

-- 0) Ensure core columns exist on client_business_types
ALTER TABLE client_business_types
  ADD COLUMN IF NOT EXISTS iaf_expected NUMERIC,
  ADD COLUMN IF NOT EXISTS expected_close_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS not_proceeding BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS not_proceeding_reason TEXT,
  ADD COLUMN IF NOT EXISTS not_proceeding_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1) Drop old CHECK constraint on business_type so we can remap values
ALTER TABLE client_business_types
  DROP CONSTRAINT IF EXISTS client_business_types_business_type_check;

-- 2) Remap existing business_type values to the new simplified set
UPDATE client_business_types
SET business_type = CASE
  WHEN business_type IN ('Pension', 'ISA', 'Bond') THEN 'Investment'
  WHEN business_type IN ('Insurance', 'Protection') THEN 'Protection'
  WHEN business_type = 'Mortgage' THEN 'Mortgage'
  ELSE 'Other'
END;

-- 3) Add new CHECK constraint restricting to the simplified set
ALTER TABLE client_business_types
  ADD CONSTRAINT client_business_types_business_type_check
  CHECK (business_type IN ('Investment', 'Mortgage', 'Protection', 'Other'));

-- 4) Drop dependent view before removing contribution columns
DROP VIEW IF EXISTS client_business_summary;

-- 5) Drop contribution_method / regular_contribution* columns and related constraint
ALTER TABLE client_business_types
  DROP CONSTRAINT IF EXISTS client_business_types_contribution_method_check;

ALTER TABLE client_business_types
  DROP COLUMN IF EXISTS contribution_method,
  DROP COLUMN IF EXISTS regular_contribution_amount,
  DROP COLUMN IF EXISTS regular_contribution;

-- 6) Recreate client_business_summary view without contribution fields and without non-existent columns
CREATE OR REPLACE VIEW client_business_summary AS
SELECT
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    COUNT(cbt.id) as business_type_count,
    ARRAY_AGG(
        DISTINCT cbt.business_type
        ORDER BY cbt.business_type
    ) as business_types,
    SUM(cbt.business_amount) as total_business_amount,
    SUM(cbt.iaf_expected) as total_iaf_expected
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.email;

COMMENT ON VIEW client_business_summary IS 'Summary view of clients with their business types aggregated (simplified schema).';

