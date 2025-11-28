-- =====================================================
-- SECURITY FIX: Enable RLS on all exposed tables
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Enable RLS on calendly_webhook_subscriptions (has policies but RLS not enabled)
ALTER TABLE public.calendly_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on recall_webhook_events
ALTER TABLE public.recall_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy: Only allow access to webhook events for the user's own meetings
DROP POLICY IF EXISTS "Users can view own recall webhook events" ON public.recall_webhook_events;
CREATE POLICY "Users can view own recall webhook events" ON public.recall_webhook_events
    FOR ALL USING (
        meeting_id IN (
            SELECT id FROM meetings WHERE user_id = auth.uid()::text
        )
    );

-- 3. Enable RLS on calendly_webhook_events  
ALTER TABLE public.calendly_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy: Only allow access to webhook events for the user's own data
DROP POLICY IF EXISTS "Users can view own calendly webhook events" ON public.calendly_webhook_events;
CREATE POLICY "Users can view own calendly webhook events" ON public.calendly_webhook_events
    FOR ALL USING (
        user_id = auth.uid()::text
        OR user_id IS NULL -- Allow webhook processing before user association
    );

-- 4. Enable RLS on email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for email_templates
DROP POLICY IF EXISTS "Users can view own email templates" ON public.email_templates;
CREATE POLICY "Users can view own email templates" ON public.email_templates
    FOR SELECT USING (user_id = auth.uid()::text OR is_default = true);

DROP POLICY IF EXISTS "Users can create own email templates" ON public.email_templates;
CREATE POLICY "Users can create own email templates" ON public.email_templates
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own email templates" ON public.email_templates;
CREATE POLICY "Users can update own email templates" ON public.email_templates
    FOR UPDATE USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own email templates" ON public.email_templates;
CREATE POLICY "Users can delete own email templates" ON public.email_templates
    FOR DELETE USING (user_id = auth.uid()::text);

-- 5. Fix the security definer view - recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.client_business_summary;
CREATE VIEW public.client_business_summary AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    c.advisor_id,
    COALESCE(SUM(cbt.business_amount), 0) as total_business,
    COALESCE(SUM(cbt.iaf_expected), 0) as total_iaf,
    COUNT(DISTINCT cbt.id) as business_type_count
FROM clients c
LEFT JOIN client_business_types cbt ON c.id = cbt.client_id
GROUP BY c.id, c.name, c.advisor_id;

-- Grant appropriate permissions
GRANT SELECT ON public.client_business_summary TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.client_business_summary IS 'Client business summary - secured via underlying table RLS';

