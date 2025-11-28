-- Add stage column to client_business_types table
-- Valid values: 'Not Written', 'In Progress', 'Signed', 'Completed'
ALTER TABLE client_business_types 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Not Written' 
CHECK (stage IN ('Not Written', 'In Progress', 'Signed', 'Completed'));

-- Add comment for documentation
COMMENT ON COLUMN client_business_types.stage IS 'Stage of the business type: Not Written, In Progress, Signed, Completed';

