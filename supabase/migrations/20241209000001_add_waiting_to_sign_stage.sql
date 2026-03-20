-- Add 'Waiting to Sign' to the stage column constraint in client_business_types table
-- This migration adds the new stage value while keeping 'Signed' for backwards compatibility

-- First, drop the existing constraint
ALTER TABLE client_business_types 
DROP CONSTRAINT IF EXISTS client_business_types_stage_check;

-- Add the new constraint with both 'Signed' and 'Waiting to Sign'
ALTER TABLE client_business_types 
ADD CONSTRAINT client_business_types_stage_check 
CHECK (stage IN ('Not Written', 'In Progress', 'Signed', 'Waiting to Sign', 'Completed'));

-- Update comment to reflect new valid values
COMMENT ON COLUMN client_business_types.stage IS 'Stage of the business type: Not Written, In Progress, Signed, Waiting to Sign, Completed';

