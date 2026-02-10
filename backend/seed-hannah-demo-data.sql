-- ============================================================================
-- DEMO DATA SEED SCRIPT FOR Hannah@advicly.co.uk
-- 15 clients, 30 past meetings, 10 future meetings
-- Focus: UK tax year end 25/26, IHT planning, pension drawdown
-- All meetings via Zoom
-- ============================================================================

-- Step 1: Get Hannah's user ID and tenant ID
-- We'll use variables via a DO block
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  -- Client IDs
  c1 UUID := gen_random_uuid();
  c2 UUID := gen_random_uuid();
  c3 UUID := gen_random_uuid();
  c4 UUID := gen_random_uuid();
  c5 UUID := gen_random_uuid();
  c6 UUID := gen_random_uuid();
  c7 UUID := gen_random_uuid();
  c8 UUID := gen_random_uuid();
  c9 UUID := gen_random_uuid();
  c10 UUID := gen_random_uuid();
  c11 UUID := gen_random_uuid();
  c12 UUID := gen_random_uuid();
  c13 UUID := gen_random_uuid();
  c14 UUID := gen_random_uuid();
  c15 UUID := gen_random_uuid();
  -- Meeting IDs (we need to track them for action items)
  m_id INTEGER;
BEGIN

-- Look up Hannah
SELECT id, tenant_id INTO v_user_id, v_tenant_id
FROM users
WHERE email = 'hannah@advicly.co.uk';

IF v_user_id IS NULL THEN
  RAISE EXCEPTION 'User hannah@advicly.co.uk not found';
END IF;

RAISE NOTICE 'Found user: %, tenant: %', v_user_id, v_tenant_id;

-- ============================================================================
-- CLIENTS (15 UK-based clients)
-- ============================================================================
INSERT INTO clients (id, advisor_id, tenant_id, name, email, phone, date_of_birth, gender, pipeline_stage, priority_level, status, notes, tags, source, last_contact_date, next_follow_up_date, created_at)
VALUES
  (c1, v_user_id, v_tenant_id, 'James Whitfield', 'james.whitfield@outlook.com', '+44 7700 900123', '1962-03-15', 'Male', 'qualified', 1, 'active', 'Retired headteacher. Large DB pension considering drawdown for tax-free cash. Concerned about IHT for his estate.', ARRAY['high-value','pension','iht'], 'referral', '2026-02-05', '2026-02-12', NOW() - INTERVAL '4 months'),
  (c2, v_user_id, v_tenant_id, 'Sarah Mitchell', 'sarah.mitchell@gmail.com', '+44 7911 123456', '1970-08-22', 'Female', 'proposal', 2, 'active', 'Business owner selling company. Needs CGT planning and reinvestment strategy. Interested in VCT/EIS for tax relief.', ARRAY['cgt','business-owner','high-value'], 'website', '2026-02-03', '2026-02-14', NOW() - INTERVAL '3 months'),
  (c3, v_user_id, v_tenant_id, 'David and Patricia Chen', 'david.chen@btinternet.com', '+44 7456 789012', '1958-11-30', 'Male', 'negotiation', 1, 'active', 'Retired couple. Combined pensions over £1.2m. Reviewing drawdown strategy before tax year end. IHT planning for two children.', ARRAY['pension','drawdown','iht','high-value'], 'referral', '2026-02-07', '2026-02-10', NOW() - INTERVAL '6 months'),
  (c4, v_user_id, v_tenant_id, 'Emma Hartley', 'emma.hartley@yahoo.co.uk', '+44 7823 456789', '1975-05-14', 'Female', 'qualified', 2, 'active', 'GP partner. High earner, annual allowance tapering concerns. Wants to maximise pension contributions before April.', ARRAY['pension','high-earner','annual-allowance'], 'referral', '2026-02-01', '2026-02-15', NOW() - INTERVAL '2 months'),
  (c5, v_user_id, v_tenant_id, 'Robert Blackwood', 'r.blackwood@hotmail.co.uk', '+44 7934 567890', '1955-01-08', 'Male', 'closed_won', 3, 'active', 'Retired engineer. Already in drawdown. Annual review of withdrawal strategy and fund performance. Estate worth £1.8m, needs IHT mitigation.', ARRAY['drawdown','iht','annual-review'], 'existing', '2026-01-28', '2026-04-15', NOW() - INTERVAL '14 months'),
  (c6, v_user_id, v_tenant_id, 'Fiona Campbell', 'fiona.campbell@sky.com', '+44 7712 345678', '1968-09-03', 'Female', 'prospecting', 3, 'active', 'Recently divorced. Received pension sharing order. Needs advice on consolidation and investment strategy.', ARRAY['pension','divorce','new-client'], 'cold-call', '2026-01-20', '2026-02-20', NOW() - INTERVAL '1 month'),
  (c7, v_user_id, v_tenant_id, 'Thomas and Helen Wright', 'tom.wright@icloud.com', '+44 7845 678901', '1960-07-19', 'Male', 'qualified', 2, 'active', 'Both approaching retirement. Want to understand pension freedoms and tax-efficient drawdown. Total pensions circa £800k.', ARRAY['pension','drawdown','retirement-planning'], 'referral', '2026-02-04', '2026-02-18', NOW() - INTERVAL '3 months'),
  (c8, v_user_id, v_tenant_id, 'Amira Patel', 'amira.patel@gmail.com', '+44 7956 789012', '1980-12-25', 'Female', 'prospecting', 3, 'active', 'Pharmacist. Wants to start pension contributions and ISA savings. First-time investor, relatively straightforward.', ARRAY['new-investor','isa','pension'], 'website', '2026-01-15', '2026-02-25', NOW() - INTERVAL '1 month'),
  (c9, v_user_id, v_tenant_id, 'George Pemberton', 'george.pemberton@outlook.com', '+44 7867 890123', '1950-04-11', 'Male', 'closed_won', 1, 'active', 'Widower, age 75. Estate worth £2.5m. Urgent IHT planning — new IHT rules on pensions from April 2027. Wants to gift and use trusts.', ARRAY['iht','trusts','high-value','urgent'], 'referral', '2026-02-06', '2026-02-13', NOW() - INTERVAL '18 months'),
  (c10, v_user_id, v_tenant_id, 'Catherine Lloyd', 'c.lloyd@virginmedia.com', '+44 7678 901234', '1972-02-28', 'Female', 'proposal', 2, 'active', 'Senior solicitor. Maximising pension carry-forward before tax year end. Also wants to use remaining ISA allowance and explore JISA for children.', ARRAY['carry-forward','isa','pension','high-earner'], 'referral', '2026-02-02', '2026-02-16', NOW() - INTERVAL '5 months'),
  (c11, v_user_id, v_tenant_id, 'Mark and Louise Henderson', 'mark.henderson@gmail.com', '+44 7789 012345', '1965-06-10', 'Male', 'qualified', 2, 'active', 'Both public sector workers. Looking at pension commutation options and whether to take tax-free cash or leave in scheme.', ARRAY['pension','public-sector','tax-free-cash'], 'website', '2026-01-25', '2026-02-22', NOW() - INTERVAL '2 months'),
  (c12, v_user_id, v_tenant_id, 'Priya Sharma', 'priya.sharma@outlook.com', '+44 7890 123456', '1978-10-17', 'Female', 'prospecting', 4, 'active', 'IT consultant, contractor through limited company. Wants advice on extracting profits tax-efficiently and pension contributions via company.', ARRAY['ltd-company','pension','tax-planning'], 'cold-call', '2026-01-10', '2026-03-01', NOW() - INTERVAL '1 month'),
  (c13, v_user_id, v_tenant_id, 'William Ashton', 'w.ashton@talktalk.net', '+44 7901 234567', '1948-08-05', 'Male', 'negotiation', 1, 'active', 'Age 77, recently diagnosed health issues. Wants to accelerate IHT planning. Estate includes property portfolio worth £3m. Needs whole-of-estate review.', ARRAY['iht','property','urgent','high-value'], 'referral', '2026-02-08', '2026-02-11', NOW() - INTERVAL '8 months'),
  (c14, v_user_id, v_tenant_id, 'Olivia Norris', 'olivia.norris@gmail.com', '+44 7012 345678', '1985-03-21', 'Female', 'prospecting', 3, 'active', 'Teacher. Wants to understand Teachers Pension and whether to make additional voluntary contributions before April.', ARRAY['teachers-pension','avc','new-client'], 'website', '2026-01-30', '2026-02-28', NOW() - INTERVAL '3 weeks'),
  (c15, v_user_id, v_tenant_id, 'Richard and Janet Gallagher', 'richard.gallagher@btinternet.com', '+44 7123 456789', '1957-12-01', 'Male', 'closed_won', 2, 'active', 'Long-standing clients. Annual review due. Drawdown portfolio £650k. Want to discuss new IHT rules impact on their estate plan.', ARRAY['drawdown','iht','annual-review'], 'existing', '2026-02-09', '2026-04-01', NOW() - INTERVAL '24 months');

-- Update meeting counts and last contact for clients
UPDATE clients SET meeting_count = 0, active_meeting_count = 0 WHERE id IN (c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15);

-- ============================================================================
-- BUSINESS TYPES for clients
-- ============================================================================
INSERT INTO client_business_types (client_id, business_type, business_amount, iaf_expected, expected_close_date, stage, notes)
VALUES
  (c1, 'Investment', 450000, 4500, '2026-03-31', 'In Progress', 'DB pension transfer to drawdown'),
  (c1, 'Protection', 0, 1200, '2026-04-15', 'Not Written', 'Life cover review post-retirement'),
  (c2, 'Investment', 800000, 8000, '2026-03-15', 'Waiting to Sign', 'CGT reinvestment into VCT/EIS portfolio'),
  (c3, 'Investment', 1200000, 12000, '2026-03-31', 'In Progress', 'Joint drawdown strategy restructure'),
  (c3, 'Other', 0, 2500, '2026-04-30', 'Not Written', 'IHT trust setup and gifting strategy'),
  (c4, 'Investment', 60000, 600, '2026-04-05', 'In Progress', 'Annual pension contribution top-up'),
  (c5, 'Investment', 750000, 3750, '2026-04-01', 'Completed', 'Annual drawdown review and rebalance'),
  (c6, 'Investment', 180000, 1800, '2026-05-15', 'Not Written', 'Pension sharing order consolidation'),
  (c7, 'Investment', 800000, 8000, '2026-03-31', 'In Progress', 'Joint retirement drawdown setup'),
  (c8, 'Investment', 25000, 250, '2026-06-01', 'Not Written', 'First ISA and pension setup'),
  (c9, 'Other', 2500000, 15000, '2026-03-15', 'In Progress', 'Whole estate IHT mitigation plan'),
  (c9, 'Investment', 500000, 5000, '2026-03-31', 'Waiting to Sign', 'Discounted gift trust setup'),
  (c10, 'Investment', 120000, 1200, '2026-04-05', 'In Progress', 'Pension carry-forward and ISA top-up'),
  (c11, 'Investment', 350000, 3500, '2026-04-30', 'Not Written', 'Pension commutation analysis'),
  (c12, 'Investment', 100000, 1000, '2026-05-15', 'Not Written', 'Ltd company pension and extraction strategy'),
  (c13, 'Other', 3000000, 18000, '2026-03-10', 'Waiting to Sign', 'Accelerated IHT plan with property trusts'),
  (c13, 'Investment', 400000, 4000, '2026-03-20', 'In Progress', 'Investment portfolio restructure for IHT'),
  (c14, 'Investment', 15000, 150, '2026-04-05', 'Not Written', 'Teachers pension AVC assessment'),
  (c15, 'Investment', 650000, 3250, '2026-04-01', 'Completed', 'Annual drawdown review'),
  (c15, 'Other', 0, 2000, '2026-04-15', 'In Progress', 'IHT plan update for new pension rules');

-- ============================================================================
-- PAST MEETINGS (30 meetings, spread over last 4 months)
-- ============================================================================

-- Meeting 1: James Whitfield - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c1, v_tenant_id, 'Intro Meeting - James Whitfield', 'Intro Meeting',
  '2025-10-15 10:00:00+00', '2025-10-15 11:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"james.whitfield@outlook.com","name":"James Whitfield"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Good morning James, thanks for joining. I understand you''re looking at your retirement options. Can you tell me about your current situation?

James: Yes, thanks Hannah. I retired from teaching last year. I have a Teachers'' Pension of about £28,000 per year, and I also have an old defined benefit scheme from when I worked in the private sector briefly — that''s worth around £450,000 as a transfer value.

Hannah: That''s a good position to be in. What are your main concerns?

James: Well, two things really. First, I''d like to understand whether it makes sense to transfer the DB pension into drawdown so I can access the tax-free cash. And second, my estate is worth quite a lot now with the house and everything — probably around £1.5 million — and I''m worried about inheritance tax for my two children.

Hannah: Those are both really important considerations. On the DB transfer, we''d need to do a thorough analysis comparing the guaranteed income versus the flexibility of drawdown. The FCA requires us to demonstrate that a transfer is in your best interest. On the IHT side, with the new rules coming in regarding pensions being brought into the estate for IHT purposes from April 2027, it''s actually quite timely to be looking at this now.

James: Yes, I read about the pension IHT changes. That''s partly what prompted me to get in touch.

Hannah: Absolutely. Let me explain the process. We''ll start with a full fact-find, gather all your financial information, and then I''ll prepare a comprehensive suitability report. For the DB transfer specifically, I''ll need to obtain a transfer value quotation from your scheme. Shall we go ahead and start that process?

James: Yes please, let''s do that.',
  '• Retired headteacher with DB pension transfer value ~£450k
• Concerned about IHT — estate ~£1.5m
• Interested in DB pension transfer to drawdown for tax-free cash
• Aware of upcoming IHT changes to pensions from April 2027
• Next steps: Full fact-find and DB transfer value quotation',
  'Initial consultation with James Whitfield regarding DB pension transfer and IHT planning. Client has a Teachers Pension (£28k pa) and a private sector DB scheme with ~£450k transfer value. Estate worth approximately £1.5m. Key drivers: accessing tax-free cash via drawdown and mitigating IHT exposure, particularly given the 2027 pension IHT rule changes.',
  NOW() - INTERVAL '4 months')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c1, v_user_id, 'Request DB pension transfer value quotation from scheme administrators', 1, true, 0),
  (m_id, c1, v_user_id, 'Schedule full fact-find meeting with James', 2, true, 1),
  (m_id, c1, v_user_id, 'Send IHT planning overview document to James', 3, true, 2);

-- Meeting 2: Sarah Mitchell - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c2, v_tenant_id, 'Intro Meeting - Sarah Mitchell', 'Intro Meeting',
  '2025-11-05 14:00:00+00', '2025-11-05 15:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"sarah.mitchell@gmail.com","name":"Sarah Mitchell"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Hi Sarah, welcome. I understand you''re going through quite a significant financial change at the moment.

Sarah: Yes, I''m in the process of selling my software consultancy. We''ve had an offer of £2.2 million, and I''m trying to work out what to do with the proceeds from a tax perspective.

Hannah: Congratulations on the sale. That''s a significant sum. Have you spoken to your accountant about the CGT implications?

Sarah: Yes, my accountant mentioned Business Asset Disposal Relief, so the first million would be taxed at 10%. But the rest would be at 20%, which is a lot of tax. She suggested I speak to a financial planner about investment strategies that might help with tax relief.

Hannah: Your accountant is right about BADR. For the proceeds above that, there are some interesting options. VCTs — Venture Capital Trusts — offer 30% income tax relief on investments up to £200,000 per tax year. EIS — Enterprise Investment Schemes — also offer 30% relief with no annual limit, though they''re higher risk. Both need to be held for qualifying periods.

Sarah: That sounds promising. What about pensions? I haven''t really been paying into one much because I was reinvesting in the business.

Hannah: That''s very common for business owners. We should look at maximising your pension contributions. You can carry forward unused allowances from the previous three tax years, which could mean a significant contribution before April 5th.

Sarah: Yes, I want to get as much done before the end of this tax year as possible.',
  '• Selling software consultancy for £2.2m
• BADR applicable on first £1m (10% CGT), remainder at 20%
• Interested in VCT/EIS for tax relief on reinvestment
• Minimal pension contributions historically — carry-forward opportunity
• Wants to act before April 5th tax year end
• Next steps: Full financial review and VCT/EIS research',
  'Sarah Mitchell is selling her software consultancy for £2.2m. CGT planning needed — BADR on first £1m, 20% on remainder. Exploring VCT and EIS investments for tax relief, plus pension carry-forward before tax year end.',
  NOW() - INTERVAL '3 months')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c2, v_user_id, 'Research suitable VCT options for Sarah — minimum 5-year hold period', 1, true, 0),
  (m_id, c2, v_user_id, 'Calculate pension carry-forward availability for last 3 tax years', 1, true, 1),
  (m_id, c2, v_user_id, 'Prepare CGT projection report showing tax savings from VCT/EIS', 2, false, 2);

-- Meeting 3: David & Patricia Chen - Cashflow Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c3, v_tenant_id, 'Cashflow Meeting - David & Patricia Chen', 'Cashflow Meeting',
  '2025-10-28 09:30:00+00', '2025-10-28 10:30:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"david.chen@btinternet.com","name":"David Chen"},{"email":"patricia.chen@btinternet.com","name":"Patricia Chen"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Good morning David, Patricia. Today I want to walk through the cashflow model I''ve prepared based on the information you gave me last time.

David: Great, we''ve been looking forward to this.

Hannah: So looking at your combined position: David, your SIPP is valued at approximately £720,000 and Patricia, yours is around £510,000. Together that''s £1.23 million. Your combined state pensions will be about £22,000 per year when Patricia reaches state pension age next year. Your annual expenditure target is £65,000.

Patricia: Yes, that feels about right. We want to maintain our current lifestyle — the house is paid off, so it''s mostly living expenses and holidays.

Hannah: The cashflow model shows that if we draw from David''s pension first, taking the 25% tax-free cash of £180,000 and then drawing the rest as income, while leaving Patricia''s to grow for now, you''ll have a very sustainable income throughout retirement. The key is managing the drawdown to stay within the basic rate tax band where possible.

David: What about the IHT issue? I read that pensions are going to be counted in the estate from 2027.

Hannah: Yes, that''s a significant change. Currently your pensions sit outside your estate for IHT purposes. From April 2027, they''ll be included. With your combined estate — property at around £800,000, savings of £200,000, plus the pensions — you''re looking at a total estate north of £2.2 million. The nil-rate bands for a married couple are £1 million including the residence nil-rate band, so there could be a substantial IHT bill.

Patricia: That''s worrying. What can we do?

Hannah: Several things. We should consider accelerating your drawdown slightly to fund gifts to your children — using the annual exemption and potentially larger gifts that would be exempt after seven years. We should also look at whether a whole-of-life policy in trust might be appropriate to cover any remaining liability.',
  '• Combined pensions: £1.23m (David £720k, Patricia £510k)
• State pensions: ~£22k pa combined
• Annual expenditure target: £65k
• Cashflow model shows sustainable drawdown strategy
• IHT concern: total estate ~£2.2m, significant exposure from 2027
• Strategy: phased drawdown, gift planning, possible whole-of-life cover
• Next steps: Detailed drawdown schedule and IHT mitigation plan',
  'Cashflow review for David and Patricia Chen. Combined pensions £1.23m, targeting £65k pa. Cashflow model demonstrates sustainability. Major concern is IHT from 2027 pension inclusion — total estate ~£2.2m. Discussed phased drawdown, gift strategy and possible whole-of-life cover.',
  NOW() - INTERVAL '3 months' - INTERVAL '10 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c3, v_user_id, 'Prepare detailed drawdown schedule — David first, Patricia deferred', 1, true, 0),
  (m_id, c3, v_user_id, 'Model IHT liability under new 2027 rules with current estate', 1, true, 1),
  (m_id, c3, v_user_id, 'Research whole-of-life policy options written in trust', 2, false, 2),
  (m_id, c3, v_user_id, 'Draft gifting schedule using annual exemptions and PETs', 2, true, 3);

-- Meeting 4: Emma Hartley - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c4, v_tenant_id, 'Intro Meeting - Emma Hartley', 'Intro Meeting',
  '2025-12-03 16:00:00+00', '2025-12-03 16:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"emma.hartley@yahoo.co.uk","name":"Emma Hartley"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Hi Emma, thanks for making time in what I know is a busy schedule. You mentioned you''re a GP partner?

Emma: Yes, I''ve been a partner at our practice for eight years now. My income varies but it''s usually around £130,000 to £140,000, and I''m getting increasingly confused about how much I can put into my pension with all the tapering rules.

Hannah: I completely understand. The annual allowance tapering is one of the most complex areas of pension legislation. Essentially, if your threshold income is over £200,000 or your adjusted income is over £260,000, your annual allowance starts to taper down from £60,000. For every £2 of adjusted income over £260,000, you lose £1 of allowance, down to a minimum of £10,000.

Emma: My income is below those thresholds, so I should be fine with the full £60,000?

Hannah: It depends on how we calculate it. As a GP partner, we need to include your NHS pension contributions as part of the calculation. The employer contributions count towards both the threshold and the annual allowance. Let me do a proper calculation once I have all the figures.

Emma: OK. And I want to maximise what I put in before April. I have some savings sitting in a current account earning very little.

Hannah: We can look at carry-forward from the previous three tax years too. If you haven''t used your full allowance in those years, you can carry the unused amount forward. Given you''re a higher rate taxpayer, pension contributions give you 40% tax relief, so it''s very efficient.',
  '• GP partner, income £130-140k
• Concerned about annual allowance tapering
• Likely under threshold but needs proper calculation including NHS pension
• Wants to maximise pension contributions before April 5th
• Has savings in current account to deploy
• Carry-forward opportunity from previous 3 years
• Next steps: Gather pension statements and calculate available allowance',
  'Initial meeting with Dr Emma Hartley. GP partner earning £130-140k. Needs annual allowance tapering assessment including NHS pension employer contributions. Wants to maximise pension input before tax year end. Carry-forward calculation needed.',
  NOW() - INTERVAL '2 months' - INTERVAL '5 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c4, v_user_id, 'Request NHS pension annual statements for last 3 years from Emma', 1, true, 0),
  (m_id, c4, v_user_id, 'Calculate annual allowance tapering position including employer contributions', 1, false, 1),
  (m_id, c4, v_user_id, 'Model carry-forward availability and recommend contribution amount', 2, false, 2);

-- Meeting 5: Robert Blackwood - Performance Meeting (Annual Review)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c5, v_tenant_id, 'Performance Meeting - Robert Blackwood', 'Performance Meeting',
  '2026-01-28 11:00:00+00', '2026-01-28 12:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"r.blackwood@hotmail.co.uk","name":"Robert Blackwood"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Robert, good to see you. Let''s go through your annual review. Your drawdown portfolio is currently valued at £752,000, which is up from £718,000 this time last year, despite your withdrawals.

Robert: That''s reassuring. I''ve been taking £3,500 per month.

Hannah: Yes, that''s £42,000 per year. Combined with your state pension of £11,500, your total income is about £53,500. The portfolio returned 7.2% gross last year, which after charges and your withdrawals still gave a positive real return. The asset allocation is currently 55% equities, 30% bonds, 10% alternatives, and 5% cash.

Robert: Good. I''m not planning to change my withdrawals. But I''m worried about this IHT pension rule change. My estate is worth about £1.8 million including the house and the pension. My wife passed three years ago so I only have the single nil-rate band.

Hannah: That''s a very valid concern. With the transferable nil-rate band from your late wife, you actually have £650,000 of nil-rate bands available — £325,000 standard plus £325,000 transferred. However, the residence nil-rate band may also apply if you''re leaving the house to direct descendants, which could add up to £350,000. So potentially £1 million of allowances. But with an £1.8 million estate, there''s still significant exposure.

Robert: What do you suggest?

Hannah: I''d recommend we look at a structured gifting programme. You could gift from your drawdown income without affecting your lifestyle. We should also consider whether a bare trust or discretionary trust might work for some of the investment portfolio. And we should absolutely review your will and existing estate planning in light of these changes.',
  '• Drawdown portfolio: £752k (up from £718k), 7.2% gross return
• Withdrawing £42k pa, plus state pension £11.5k = £53.5k total
• Asset allocation: 55/30/10/5 (equities/bonds/alts/cash)
• Estate: ~£1.8m, single + transferred NRB = £650k + potential RNRB
• IHT exposure significant — needs gifting programme and trust review
• Next steps: Gifting strategy proposal and trust options',
  'Annual performance review for Robert Blackwood. Drawdown portfolio at £752k, sustainable withdrawal rate. Main concern is IHT under new 2027 pension rules — estate £1.8m. Recommended structured gifting and trust options.',
  NOW() - INTERVAL '12 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c5, v_user_id, 'Prepare IHT exposure calculation under 2027 rules including pension', 1, false, 0),
  (m_id, c5, v_user_id, 'Draft structured gifting programme — annual exemptions plus PETs', 2, false, 1),
  (m_id, c5, v_user_id, 'Arrange meeting with Robert''s solicitor to review will', 3, false, 2);

-- Meeting 6: Fiona Campbell - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c6, v_tenant_id, 'Intro Meeting - Fiona Campbell', 'Intro Meeting',
  '2026-01-20 13:00:00+00', '2026-01-20 13:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"fiona.campbell@sky.com","name":"Fiona Campbell"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Fiona, thank you for getting in touch. You mentioned in your email that you''re going through a divorce and have received a pension sharing order.

Fiona: Yes, the divorce was finalised last month. I''ve been awarded 40% of my ex-husband''s pension, which my solicitor says is worth about £180,000 as a transfer value. I also have my own small workplace pension of about £45,000. I''m 57, so I''ve got a few years before I can think about retirement.

Hannah: I''m sorry to hear about the divorce, but let''s make sure we get the best outcome for you financially. The pension sharing order gives you a pension credit which we need to transfer into an arrangement in your name. We should also look at consolidating your existing workplace pension so everything is in one place and easier to manage.

Fiona: That makes sense. I don''t really understand pensions very well — my ex always handled the finances.

Hannah: That''s completely normal and nothing to worry about. We''ll take it step by step. The good news is you have time on your side. With about 10 years to retirement, we can invest the pension credit for growth. We''ll need to think about your attitude to risk and what your retirement income needs might look like.

Fiona: I''m going back to work full-time — I work in HR — so I''ll be earning again. I don''t need the pension money now.',
  '• Recently divorced, pension sharing order for £180k
• Own workplace pension: £45k
• Age 57, planning to work until late 60s
• Going back to full-time work in HR
• Needs pension credit transfer and consolidation
• Risk assessment required
• Next steps: Transfer pension credit, consolidate, and invest for growth',
  'Intro meeting with Fiona Campbell post-divorce. Pension sharing order credit of £180k plus own workplace pension £45k. Age 57, returning to work. Needs pension credit transfer, consolidation, and growth-oriented investment strategy.',
  NOW() - INTERVAL '20 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c6, v_user_id, 'Initiate pension credit transfer from ex-husband''s scheme', 1, false, 0),
  (m_id, c6, v_user_id, 'Send risk assessment questionnaire to Fiona', 2, false, 1),
  (m_id, c6, v_user_id, 'Obtain workplace pension transfer value', 2, false, 2);

-- Meeting 7: George Pemberton - Cashflow Meeting (IHT Review)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c9, v_tenant_id, 'Cashflow Meeting - George Pemberton IHT Review', 'Cashflow Meeting',
  '2026-01-14 10:00:00+00', '2026-01-14 11:30:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"george.pemberton@outlook.com","name":"George Pemberton"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: George, thank you for coming in. As we discussed, the new IHT rules regarding pensions are going to have a significant impact on your estate planning. Let me walk through the updated position.

George: Please do. I''ve been losing sleep over this.

Hannah: Your total estate currently stands at approximately £2.5 million. That breaks down as: the house at £950,000, investment portfolio at £500,000, cash savings of £150,000, and your pension fund at £900,000. Currently the pension is outside the estate, but from April 2027 it will be included.

George: So the full £2.5 million will be subject to IHT?

Hannah: Essentially, yes. With the nil-rate band of £325,000 and the residence nil-rate band of £175,000 — assuming you''re leaving the house to your children — that''s £500,000 of allowances. The remaining £2 million would be taxed at 40%, giving an IHT bill of approximately £800,000.

George: Eight hundred thousand pounds. That''s horrifying.

Hannah: I understand. But there''s a lot we can do to reduce that. First, we should accelerate a gifting strategy. You can give away £3,000 per year tax-free, plus unlimited gifts out of normal expenditure if they come from income rather than capital. Second, we should look at setting up a discounted gift trust — you invest a lump sum, retain an income from it, and the remainder is immediately outside your estate.

George: How much should I put into a trust?

Hannah: I''d recommend £500,000 from your investment portfolio into a discounted gift trust. The discount — the value of your retained income — would mean perhaps £150,000 is treated as still in your estate, but the remaining £350,000 is immediately outside it. After seven years, the whole amount is excluded.

George: Let''s do it. What else?

Hannah: We should also look at drawing down your pension more aggressively and gifting the proceeds. If you draw from the pension now at your marginal rate, and gift the net amount, after seven years those gifts would also be outside the estate. Given the pension is going to be taxed at 40% IHT anyway from 2027, there may be a net saving in accelerating the drawdown.',
  '• Estate: £2.5m (house £950k, investments £500k, cash £150k, pension £900k)
• Post-2027 IHT bill estimate: ~£800k at 40%
• Recommended: £500k discounted gift trust from investment portfolio
• Accelerated pension drawdown to fund gifts as PETs
• Annual gifting using £3k exemption plus normal expenditure
• Urgency: 7-year clock for PETs
• Next steps: Set up discounted gift trust, draft gifting schedule',
  'Urgent IHT review for George Pemberton. Estate £2.5m, projected IHT bill £800k under 2027 pension inclusion rules. Recommending £500k discounted gift trust, accelerated pension drawdown with gifting, and annual exemption programme.',
  NOW() - INTERVAL '26 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c9, v_user_id, 'Prepare discounted gift trust application for £500k', 1, true, 0),
  (m_id, c9, v_user_id, 'Calculate net benefit of accelerated pension drawdown vs leaving for IHT', 1, true, 1),
  (m_id, c9, v_user_id, 'Draft 7-year gifting programme with tax projections', 2, false, 2),
  (m_id, c9, v_user_id, 'Liaise with George''s solicitor about updating his will', 2, false, 3);

-- Meeting 8: Catherine Lloyd - Cashflow Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c10, v_tenant_id, 'Cashflow Meeting - Catherine Lloyd Tax Year End', 'Cashflow Meeting',
  '2026-01-22 17:30:00+00', '2026-01-22 18:15:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"c.lloyd@virginmedia.com","name":"Catherine Lloyd"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Catherine, we''re now just over two months from the end of the tax year, so I wanted to go through your position and make sure we maximise your allowances.

Catherine: Perfect timing. I''ve had a good year — earnings around £155,000 including bonus.

Hannah: Great. So your pension position: you''ve contributed £25,000 this tax year through your employer scheme. Your annual allowance is £60,000, so you have £35,000 of unused allowance this year. Looking at carry-forward: in 2022/23 you used £30,000, in 2023/24 you used £28,000, and in 2024/25 you used £32,000. That gives you carry-forward of approximately £90,000 from those three years. Combined with this year''s remaining £35,000, you could contribute up to £125,000 in total.

Catherine: I can''t afford to put in £125,000 but I could manage £60,000 on top of what I''ve already contributed.

Hannah: That would be excellent. At your marginal tax rate of 45%, that''s £27,000 of tax relief. We should also make sure you''ve used your ISA allowance — £20,000 for this tax year. And you mentioned wanting to open Junior ISAs for your two children?

Catherine: Yes, they''re 8 and 11. I want to start saving for them. How much can I put in?

Hannah: The JISA limit is £9,000 per child per tax year. So £18,000 total for both children. Between the pension top-up, your ISA, and the JISAs, we''re looking at deploying about £98,000 before April.',
  '• Earnings: ~£155k including bonus
• Pension: £25k contributed, £35k remaining this year + £90k carry-forward
• Planning additional £60k pension contribution — £27k tax relief at 45%
• ISA: needs to use £20k allowance
• JISAs for two children: £9k each = £18k
• Total deployment before April: ~£98k
• Next steps: Execute pension contribution and set up JISAs',
  'Tax year end planning for Catherine Lloyd. High earner at £155k. Maximising pension via carry-forward (up to £125k available, contributing additional £60k). ISA £20k allocation plus JISAs for two children at £9k each. Total pre-April deployment ~£98k.',
  NOW() - INTERVAL '18 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c10, v_user_id, 'Process additional pension contribution of £60,000', 1, false, 0),
  (m_id, c10, v_user_id, 'Open JISA accounts for both children and fund £9k each', 2, false, 1),
  (m_id, c10, v_user_id, 'Invest remaining ISA allowance before April 5th', 2, false, 2);

-- Meeting 9: Thomas & Helen Wright - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c7, v_tenant_id, 'Intro Meeting - Thomas & Helen Wright', 'Intro Meeting',
  '2025-11-18 10:30:00+00', '2025-11-18 11:30:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"tom.wright@icloud.com","name":"Thomas Wright"},{"email":"helen.wright@icloud.com","name":"Helen Wright"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Thomas, Helen, lovely to meet you both. You''re both approaching retirement, is that right?

Thomas: Yes, I''m 65 and planning to retire in March. Helen is 64 and wants to carry on working part-time for another year or two.

Helen: I enjoy my work in the charity sector and it keeps me busy.

Hannah: That''s a great combination actually — it gives us more flexibility in how we structure things. What pensions do you both have?

Thomas: I have a SIPP worth about £520,000 and Helen has a workplace DC pension worth around £280,000.

Hannah: So £800,000 combined. And what income are you looking for in retirement?

Thomas: We''ve worked out we need about £50,000 per year before tax. The mortgage is paid off.

Hannah: With Helen continuing to work part-time at say £20,000, we only need to find £30,000 from pensions initially, rising to £50,000 when Helen fully retires. State pensions will come in at 67 for you both, adding roughly £23,000 combined. The cashflow looks very manageable. The key question is how to structure the drawdown tax-efficiently.

Thomas: We''re also wondering about whether to take the tax-free cash upfront or leave it in the pension.

Hannah: That''s one of the most important decisions. Taking 25% tax-free from Thomas''s SIPP would give you £130,000. However, if you don''t need it immediately, leaving it invested within the pension wrapper is more tax-efficient — especially given the upcoming IHT changes. Once you crystallise it, the money sits in your estate. Inside the pension currently, it doesn''t.',
  '• Thomas 65, retiring March. Helen 64, working part-time 1-2 more years
• Combined pensions: £800k (Thomas SIPP £520k, Helen DC £280k)
• Income target: £50k pa (initially £30k needed from pensions with Helen working)
• State pensions at 67 add ~£23k pa combined
• Tax-free cash decision — £130k available from Thomas SIPP
• Advised caution on crystallising TFC given IHT pension changes
• Next steps: Drawdown structure options and cashflow model',
  'Intro meeting with Thomas and Helen Wright. Combined pensions £800k, income target £50k pa. Thomas retiring March, Helen continuing part-time. Key decision around tax-free cash crystallisation vs leaving in pension wrapper given 2027 IHT changes.',
  NOW() - INTERVAL '2 months' - INTERVAL '22 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c7, v_user_id, 'Prepare cashflow model showing phased drawdown with Helen working part-time', 1, true, 0),
  (m_id, c7, v_user_id, 'Model tax-free cash scenarios: take now vs defer', 2, true, 1),
  (m_id, c7, v_user_id, 'Schedule follow-up to present drawdown options', 2, true, 2);

-- Meeting 10: William Ashton - Review Meeting (IHT Urgent)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c13, v_tenant_id, 'Review Meeting - William Ashton Estate Review', 'Review Meeting',
  '2026-02-08 09:00:00+00', '2026-02-08 10:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"w.ashton@talktalk.net","name":"William Ashton"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: William, thank you for meeting today. I understand there''s been a change in your health situation and you want to accelerate the estate planning.

William: Yes, I''ve been diagnosed with a heart condition. The doctors say it''s manageable but at 77, it''s made me think seriously about getting everything sorted for my children.

Hannah: I completely understand. Let''s look at where things stand. Your estate totals approximately £3 million: the family home at £1.2 million, two buy-to-let properties at £850,000 combined, your investment portfolio at £400,000, pensions at £350,000, and cash of £200,000.

William: The buy-to-lets are generating good rental income — about £36,000 a year. I don''t want to sell them.

Hannah: We don''t need to sell them. There are several strategies for property. First, we could transfer the buy-to-lets into a discretionary trust. The initial transfer would be a chargeable lifetime transfer but if it''s within your nil-rate band of £325,000, there''s no immediate tax. The combined value of £850,000 exceeds that, so we might consider transferring one property now and the other later.

William: What about the IHT bill on the rest?

Hannah: With allowances of £500,000 — your nil-rate band plus residence nil-rate band for the family home going to your children — the taxable estate is around £2.5 million, giving an IHT bill of approximately £1 million. We need to work quickly but methodically. I''d suggest: transfer one buy-to-let to a trust immediately, start a gifting programme from income, set up a whole-of-life policy in trust to cover some of the remaining liability, and review your pension nominations.

William: Let''s get started as soon as possible.',
  '• Estate: £3m (home £1.2m, BTL £850k, investments £400k, pension £350k, cash £200k)
• Health diagnosis — wants to accelerate IHT planning
• BTL income: £36k pa — doesn''t want to sell
• Projected IHT bill: ~£1m
• Plan: Trust one BTL property, gifting programme, whole-of-life policy in trust
• Review pension nominations urgently
• Next steps: Immediate trust setup and solicitor liaison',
  'Urgent IHT review for William Ashton following health diagnosis. Estate £3m, projected IHT £1m. Recommending property trust, structured gifting, whole-of-life cover, and pension nomination review. Time-sensitive.',
  NOW() - INTERVAL '1 day')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c13, v_user_id, 'Contact solicitor about discretionary trust for BTL property', 1, false, 0),
  (m_id, c13, v_user_id, 'Obtain whole-of-life insurance quotes written in trust', 1, false, 1),
  (m_id, c13, v_user_id, 'Review and update pension nomination forms', 1, false, 2),
  (m_id, c13, v_user_id, 'Draft gifting schedule from rental income', 2, false, 3);

-- Meeting 11: James Whitfield - Cashflow Meeting (follow-up)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c1, v_tenant_id, 'Cashflow Meeting - James Whitfield DB Transfer Analysis', 'Cashflow Meeting',
  '2025-11-20 10:00:00+00', '2025-11-20 11:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"james.whitfield@outlook.com","name":"James Whitfield"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: James, I''ve now received the transfer value from your scheme and completed the analysis. The transfer value is £462,000, slightly higher than we estimated. The scheme offers a guaranteed pension of £14,200 per year with 3% annual increases.

James: So what does the analysis show?

Hannah: The critical yield — the investment return needed to match the guaranteed benefits — is 4.8%. That''s achievable but not guaranteed. However, there are several factors in your favour for a transfer: you already have a secure income from the Teachers'' Pension, you''re in good health, and you have specific needs around tax-free cash and IHT planning that the DB scheme can''t address. The FCA framework suggests that having a secure income floor is important, and your Teachers'' Pension provides that.

James: What about the tax-free cash?

Hannah: If you transfer, you''d get 25% tax-free, which is £115,500. That''s a significant sum. If you leave the pension in the DB scheme, you don''t get any lump sum unless the scheme offers commutation, which yours doesn''t. For your IHT planning, having £115,500 outside the pension that you could gift is valuable — especially with the 7-year clock for potentially exempt transfers.

James: I think I''d like to go ahead with the transfer.

Hannah: I''ll prepare the formal recommendation report. We''ll need to discuss your investment strategy for the drawdown fund too.',
  '• DB transfer value confirmed: £462,000 (guaranteed £14,200 pa, 3% increases)
• Critical yield: 4.8% — achievable but not guaranteed
• Tax-free cash on transfer: £115,500
• Teachers Pension provides secure income floor
• Client wants to proceed with transfer
• Next steps: Suitability report and investment strategy for drawdown',
  'DB pension transfer analysis for James Whitfield. Transfer value £462k, critical yield 4.8%. Client has secure income via Teachers Pension. Transfer recommended for tax-free cash access and IHT planning flexibility. Formal recommendation to follow.',
  NOW() - INTERVAL '2 months' - INTERVAL '20 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c1, v_user_id, 'Prepare formal DB transfer suitability report', 1, true, 0),
  (m_id, c1, v_user_id, 'Design drawdown investment portfolio for James', 2, true, 1);

-- Meeting 12: Sarah Mitchell - Signup Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c2, v_tenant_id, 'Signup Meeting - Sarah Mitchell VCT/Pension', 'Signup Meeting',
  '2025-12-10 14:00:00+00', '2025-12-10 14:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"sarah.mitchell@gmail.com","name":"Sarah Mitchell"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Sarah, I''ve completed the research on VCT options and your pension carry-forward. Ready to go through the recommendations?

Sarah: Absolutely. The sale completes next month so I need to have a plan in place.

Hannah: For VCTs, I''m recommending a diversified portfolio across three established VCT managers: Octopus Titan, Maven Income and Growth, and British Smaller Companies. £60,000 per VCT, totalling £180,000. That gives you 30% income tax relief of £54,000. The minimum hold period is 5 years. For your pension, you have carry-forward available of £84,000 from the three prior tax years, plus the current year''s £60,000 allowance. I''d recommend using the full £144,000 — at your marginal rate of 45%, that''s tax relief of £64,800.

Sarah: So between VCTs and pension I''m saving over £118,000 in tax?

Hannah: Correct. Plus the pension contribution will reduce your adjusted net income, which could take you below the £100,000 threshold where your personal allowance starts being withdrawn. That would save an additional effective tax at 60% on income between £100,000 and £125,140.

Sarah: That''s brilliant. Let''s go ahead with all of it. Where do I sign?

Hannah: I''ll send you the application forms today. We need to move quickly on the VCTs as they often close their offers early when they reach capacity.',
  '• VCT portfolio: £180k across 3 managers — £54k income tax relief
• Pension carry-forward: £144k contribution — £64,800 tax relief at 45%
• Total tax savings: £118,800+
• Additional benefit: personal allowance restoration if income below £100k
• Client approved all recommendations
• Next steps: Submit VCT applications and pension contribution immediately',
  'Signup meeting with Sarah Mitchell. Agreed VCT portfolio of £180k (30% relief) and pension contribution of £144k using carry-forward (45% relief). Total tax savings exceed £118k. Applications to be submitted urgently before VCT offers close.',
  NOW() - INTERVAL '2 months')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c2, v_user_id, 'Submit VCT applications: Octopus Titan, Maven, British Smaller Companies', 1, true, 0),
  (m_id, c2, v_user_id, 'Process pension contribution of £144,000', 1, true, 1),
  (m_id, c2, v_user_id, 'Confirm personal allowance restoration calculation with accountant', 2, false, 2);

-- Meeting 13: David & Patricia Chen - Signup Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c3, v_tenant_id, 'Signup Meeting - Chen Drawdown Implementation', 'Signup Meeting',
  '2025-12-18 09:30:00+00', '2025-12-18 10:30:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"david.chen@btinternet.com","name":"David Chen"},{"email":"patricia.chen@btinternet.com","name":"Patricia Chen"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: David, Patricia, I''ve prepared the drawdown implementation plan based on our cashflow model. Are you ready to go through the details and sign off?

David: Yes, we''ve discussed it between ourselves and we''re keen to get started.

Hannah: Excellent. The plan is as follows. David, we''ll crystallise your entire SIPP of £720,000, taking the 25% tax-free cash of £180,000 into a separate cash account. The remaining £540,000 stays invested in drawdown. Your natural income yield from the portfolio will be approximately £20,000 per year, and we''ll supplement with capital withdrawals as needed to reach your £40,000 drawdown target.

Patricia: And mine stays untouched for now?

Hannah: Exactly. Your £510,000 continues to grow. When you reach state pension age, we''ll review whether to start drawing from yours. The tax-free cash from David''s pension — the £180,000 — I''d suggest we keep £50,000 in an easy-access savings account as your emergency reserve, and we''ll invest £130,000 into ISAs over the coming years using both your allowances at £20,000 each per year.

David: What about the IHT trusts we discussed?

Hannah: We''ll start the gifting programme from April. The first step is £3,000 each using your annual exemptions to your children. Then we''ll set up regular gifts from David''s drawdown income — because the income exceeds your needs, the excess qualifies as normal expenditure out of income, which is immediately exempt from IHT.

David: Sounds like a solid plan. Let''s sign everything today.',
  '• David SIPP: crystallise full £720k, TFC £180k to cash, £540k to drawdown
• Drawdown target: £40k pa from David (natural yield ~£20k + capital)
• Patricia pension: £510k untouched for now
• TFC deployment: £50k emergency reserve, £130k phased into ISAs
• Gifting programme from April: annual exemptions + normal expenditure
• Clients signed off on implementation
• Next steps: Execute crystallisation and fund transfers',
  'Implementation meeting for David and Patricia Chen. Crystallising David''s SIPP £720k, TFC £180k to cash, £540k drawdown. Patricia deferred. Gifting programme starting April using annual exemptions and normal expenditure out of income.',
  NOW() - INTERVAL '53 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c3, v_user_id, 'Execute SIPP crystallisation — £720k with 25% TFC', 1, true, 0),
  (m_id, c3, v_user_id, 'Set up drawdown payment schedule — £3,333/month', 1, true, 1),
  (m_id, c3, v_user_id, 'Open ISA accounts for both David and Patricia', 2, true, 2);

-- Meeting 14: Amira Patel - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c8, v_tenant_id, 'Intro Meeting - Amira Patel', 'Intro Meeting',
  '2026-01-15 12:00:00+00', '2026-01-15 12:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"amira.patel@gmail.com","name":"Amira Patel"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Amira, welcome. You mentioned you''re looking to start investing for the first time?

Amira: Yes. I''m a pharmacist, earning about £48,000. I''ve been putting money aside but it''s all in savings accounts earning very little. I have about £25,000 in cash and I want to do something more productive with it.

Hannah: That''s a great starting point. Before we invest anything, let''s make sure your foundations are solid. Do you have an emergency fund?

Amira: I think the £25,000 is my emergency fund at the moment. I don''t have any debts apart from my student loan.

Hannah: OK, so I''d suggest we keep £10,000 as your emergency fund in an easy-access savings account — that''s roughly three months of expenses. The remaining £15,000 we can look at investing. The most tax-efficient option for you is a Stocks and Shares ISA, where any growth and income is completely tax-free.

Amira: What about a pension? My employer offers one but I''m only contributing the minimum.

Hannah: Increasing your pension contributions is excellent value. Your employer likely matches contributions up to a certain level, so you''d be getting free money. At your salary, pension contributions also reduce your tax bill. I''d suggest increasing your pension contribution to at least whatever your employer will match, and then putting the £15,000 lump sum into an ISA.

Amira: That sounds sensible. I don''t know anything about choosing investments though.

Hannah: That''s what I''m here for. We''ll do a risk assessment and then I''ll recommend a suitable portfolio. Given your age and timeframe, we can afford to take a reasonable level of risk for growth.',
  '• Pharmacist earning £48k, first-time investor
• £25k cash savings, no debts except student loan
• Plan: £10k emergency fund, £15k into Stocks & Shares ISA
• Increase workplace pension to employer match level
• Risk assessment needed for ISA portfolio
• Next steps: Risk questionnaire, pension review, ISA setup',
  'Intro meeting with Amira Patel. First-time investor with £25k savings. Plan to split: £10k emergency fund, £15k Stocks & Shares ISA. Also increasing workplace pension contributions to employer match. Risk assessment to follow.',
  NOW() - INTERVAL '25 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c8, v_user_id, 'Send risk assessment questionnaire to Amira', 1, true, 0),
  (m_id, c8, v_user_id, 'Check employer pension matching levels', 2, false, 1),
  (m_id, c8, v_user_id, 'Prepare ISA investment recommendation based on risk profile', 2, false, 2);

-- Meeting 15: Mark & Louise Henderson - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c11, v_tenant_id, 'Intro Meeting - Mark & Louise Henderson', 'Intro Meeting',
  '2026-01-25 14:00:00+00', '2026-01-25 15:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"mark.henderson@gmail.com","name":"Mark Henderson"},{"email":"louise.henderson@gmail.com","name":"Louise Henderson"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Mark, Louise, thanks for getting in touch. You''re both in the public sector, is that right?

Mark: Yes, I''m a civil servant with 28 years'' service, and Louise is a nurse with 22 years in the NHS.

Louise: We''re both thinking about retirement in the next few years. Mark is 60 and I''m 59.

Hannah: You''re both in excellent defined benefit schemes — the Civil Service Pension Scheme and the NHS Pension Scheme. These provide guaranteed income, which is very valuable. What are your main questions?

Mark: We''re trying to understand the commutation options. I can take a lump sum by giving up some of my annual pension. The commutation factor is 12:1, meaning for every £1 of pension I give up, I get a £12 lump sum.

Hannah: A 12:1 commutation factor is actually quite good. The breakeven point is typically around 15-20 years, meaning if you live more than 15-20 years past retirement, you would have been better off keeping the pension income. But there''s a tax-planning angle too — the lump sum is tax-free, whereas the pension income is taxable.

Louise: I have a similar option with the NHS scheme. And we were wondering whether we should also be making Additional Voluntary Contributions before we retire.

Hannah: AVCs can be very effective for public sector workers. They grow tax-free and you can often take 25% of the AVC fund as an additional tax-free lump sum at retirement. Given the tax year ends in April, if you make AVC contributions now, you get tax relief for this tax year.',
  '• Mark: civil servant 28 years, age 60. Louise: NHS nurse 22 years, age 59
• Both in DB schemes with commutation options
• Mark commutation factor: 12:1 — reasonably favourable
• Discussing AVC contributions before tax year end
• Need to model commutation vs keeping full pension
• Next steps: Obtain pension forecasts and model commutation scenarios',
  'Intro meeting with Mark and Louise Henderson. Both public sector DB schemes (Civil Service and NHS). Exploring commutation options and AVCs before tax year end. Mark''s 12:1 commutation factor is favourable. Pension forecasts and modelling needed.',
  NOW() - INTERVAL '15 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c11, v_user_id, 'Request pension forecasts from Civil Service and NHS schemes', 1, false, 0),
  (m_id, c11, v_user_id, 'Model commutation scenarios for both Mark and Louise', 2, false, 1),
  (m_id, c11, v_user_id, 'Calculate AVC contribution benefits before April 5th', 2, false, 2);

-- Meeting 16: Thomas & Helen Wright - Cashflow Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c7, v_tenant_id, 'Cashflow Meeting - Wright Drawdown Options', 'Cashflow Meeting',
  '2025-12-15 10:30:00+00', '2025-12-15 11:30:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"tom.wright@icloud.com","name":"Thomas Wright"},{"email":"helen.wright@icloud.com","name":"Helen Wright"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Thomas, Helen, I''ve prepared three drawdown scenarios for your review based on the cashflow modelling.

Thomas: Great, we''ve been looking forward to seeing the numbers.

Hannah: Scenario A: Thomas takes full tax-free cash of £130,000 now, goes into drawdown drawing £30,000 per year. Helen continues working. When Helen retires, we start her drawdown too. The model shows your funds lasting until age 92 with 85% confidence. Scenario B: Thomas takes only 10% tax-free cash — £52,000 — and draws a smaller amount initially, preserving more capital. Funds last until age 95 at 90% confidence. Scenario C: No tax-free cash taken. Maximum preservation. Funds last beyond age 100.

Helen: What about the IHT angle you mentioned last time?

Hannah: Good question. Under the current rules, Scenario C is best for IHT because everything stays in the pension wrapper. But from April 2027, pensions will be included in the estate anyway, so that advantage disappears. After 2027, Scenario A might actually be better because you could use the tax-free cash for gifting, getting money out of the estate sooner.

Thomas: So if pensions are going to be taxed anyway, we might as well take the cash and use it productively.

Hannah: Essentially yes, as long as the drawdown is sustainable. I''d actually recommend a hybrid: take the full tax-free cash from Thomas''s SIPP but keep it invested in ISAs rather than spending it. That way it''s still growing but in a more flexible wrapper.',
  '• Three scenarios modelled: full TFC, partial TFC, no TFC
• Recommended hybrid: full TFC into ISAs, drawdown £30k pa
• Post-2027 IHT rules reduce advantage of keeping in pension
• Better to extract TFC and gift/invest flexibly
• Helen defers drawdown while working part-time
• Funds last to 92+ in recommended scenario
• Next steps: Finalise strategy choice and implementation',
  'Drawdown options presentation for Thomas and Helen Wright. Recommended hybrid: full TFC from Thomas SIPP into ISAs, drawdown £30k pa. Post-2027 IHT changes make extraction and flexible investing more tax-efficient than pension preservation.',
  NOW() - INTERVAL '56 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c7, v_user_id, 'Prepare implementation plan for hybrid drawdown strategy', 1, true, 0),
  (m_id, c7, v_user_id, 'Set up ISA accounts for Thomas and Helen', 2, false, 1);

-- Meeting 17: Priya Sharma - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c12, v_tenant_id, 'Intro Meeting - Priya Sharma', 'Intro Meeting',
  '2026-01-10 11:00:00+00', '2026-01-10 11:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"priya.sharma@outlook.com","name":"Priya Sharma"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Priya, thanks for getting in touch. You mentioned you''re contracting through a limited company?

Priya: Yes, I''m an IT consultant. My company turns over about £180,000 and after expenses I have about £140,000 of profit sitting in the company. I pay myself a salary of £12,570 — the personal allowance — and take dividends of about £50,000. But I feel like I should be doing more with the retained profits.

Hannah: You''re already using a tax-efficient salary/dividend split, which is good. The retained profit in the company is a great opportunity. One of the most tax-efficient things you can do is make pension contributions through the company. Employer pension contributions are a deductible business expense — they reduce your corporation tax bill — and there''s no National Insurance to pay on them, unlike salary.

Priya: How much can I put in?

Hannah: Up to £60,000 per tax year as the annual allowance. If you haven''t been contributing much, you may also have carry-forward from previous years. The company contribution doesn''t count towards your personal income, so it won''t affect your dividend tax position. The corporation tax saving alone at 25% means a £60,000 contribution effectively costs the company £45,000.

Priya: That''s interesting. I haven''t been putting anything into a pension from the company. So I might have three years of carry-forward?

Hannah: Potentially, yes. If your company year-end allows it, we could make a significant contribution before April. I''d also like to discuss whether you should be retaining profits for investment within the company versus extracting them. There are trade-offs depending on your long-term plans.',
  '• IT contractor, Ltd company, £180k turnover, £140k retained profit
• Current: £12,570 salary + £50k dividends
• No company pension contributions made — significant opportunity
• Up to £60k pa + carry-forward available
• Corporation tax deduction: £60k costs company £45k net
• Need to assess carry-forward and optimal contribution strategy
• Next steps: Review carry-forward, plan pension contribution timing',
  'Intro meeting with Priya Sharma, IT contractor via limited company. Significant retained profits of £140k. No pension contributions from company — major tax planning opportunity using employer contributions (£60k pa + carry-forward).',
  NOW() - INTERVAL '30 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c12, v_user_id, 'Request pension statements to verify carry-forward from last 3 years', 1, false, 0),
  (m_id, c12, v_user_id, 'Coordinate with Priya''s accountant on company year-end timing', 2, false, 1);

-- Meeting 18: Richard & Janet Gallagher - Performance Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c15, v_tenant_id, 'Performance Meeting - Gallagher Annual Review', 'Performance Meeting',
  '2026-02-09 10:00:00+00', '2026-02-09 11:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"richard.gallagher@btinternet.com","name":"Richard Gallagher"},{"email":"janet.gallagher@btinternet.com","name":"Janet Gallagher"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Richard, Janet, welcome to your annual review. Let me start with the portfolio performance. Your combined drawdown is now valued at £672,000, down slightly from £685,000 last year, but you''ve been withdrawing £36,000 per year so the underlying return was actually positive at 3.4%.

Richard: Given the markets this year, that doesn''t sound too bad.

Hannah: It''s been a challenging year for markets, but the diversified approach has helped. Your allocation is 50% global equities, 25% bonds, 15% alternatives, and 10% cash. The equity portion returned 5.2% while bonds were flat. I''d suggest we rebalance slightly — reduce cash to 7% and increase alternatives to 18%.

Janet: What about these new IHT pension rules we keep reading about?

Hannah: That was going to be the main topic for today. From April 2027, your pensions will be included in your estate for IHT. With your house at £550,000, savings of £100,000, and pensions of £672,000, your combined estate is approximately £1.32 million. With your nil-rate bands of £1 million including the residence nil-rate band for a married couple, you have some exposure of about £320,000, resulting in potential IHT of £128,000.

Richard: That''s not as bad as I feared, but still a lot of money.

Hannah: The good news is you can mitigate most of it through relatively simple measures. We could increase your drawdown slightly and gift the excess to your children. If we gift £10,000 per year from income — which is easily sustainable as your drawdown income exceeds your spending — after seven years that''s £70,000 out of the estate. Combined with annual exemptions of £6,000 per year, you could significantly reduce the exposure.',
  '• Portfolio: £672k (down from £685k after £36k withdrawals, 3.4% real return)
• Allocation: 50/25/15/10 equities/bonds/alts/cash — rebalance suggested
• IHT: estate ~£1.32m, exposure ~£320k, potential IHT £128k
• Mitigation: increase drawdown and gift excess to children
• Annual exemptions + PETs from income could eliminate most IHT
• Next steps: Rebalance portfolio and start gifting programme',
  'Annual review for Richard and Janet Gallagher. Drawdown portfolio £672k, 3.4% real return. IHT exposure of ~£320k under 2027 rules. Recommending portfolio rebalance and structured gifting programme from excess income to mitigate.',
  NOW() - INTERVAL '0 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c15, v_user_id, 'Execute portfolio rebalance: reduce cash to 7%, increase alternatives to 18%', 1, false, 0),
  (m_id, c15, v_user_id, 'Model gifting programme and project IHT reduction over 7 years', 2, false, 1),
  (m_id, c15, v_user_id, 'Update suitability report with new IHT pension rules impact', 2, false, 2);

-- Meeting 19: Olivia Norris - Intro Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c14, v_tenant_id, 'Intro Meeting - Olivia Norris', 'Intro Meeting',
  '2026-01-30 15:30:00+00', '2026-01-30 16:15:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"olivia.norris@gmail.com","name":"Olivia Norris"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Olivia, welcome. You mentioned you''re a teacher and want to understand your pension better?

Olivia: Yes, I''ve been teaching for 12 years. I know I''m in the Teachers'' Pension Scheme but I don''t really understand what I''ll get or whether I should be doing anything extra.

Hannah: The Teachers'' Pension is one of the best pension schemes in the country. It''s a career average scheme — your pension is based on your average earnings over your career, revalued each year. At 12 years'' service on a salary of around £40,000, your pension is building up nicely. You''re earning roughly 1/57th of your salary each year as pension.

Olivia: My friend said I should look at Additional Voluntary Contributions. Is that worth it?

Hannah: AVCs can be worthwhile. They sit alongside your Teachers'' Pension and grow in a separate pot. The advantage is you get tax relief on contributions. At your salary you''re a basic rate taxpayer, so every £80 you contribute effectively becomes £100 in your pension. You can take 25% of your AVC pot as tax-free cash at retirement, which the main Teachers'' Pension doesn''t easily allow.

Olivia: How much should I put in?

Hannah: It depends on your budget. Even £100-200 per month would make a meaningful difference over 25-30 years until retirement. The key is to start — compound growth does the heavy lifting over time. Before April 5th, you could make a lump sum AVC contribution for this tax year if you have savings available.

Olivia: I have about £5,000 I could put in.',
  '• Teacher, 12 years service, salary ~£40k
• In Teachers Pension Scheme (career average, 1/57th accrual)
• Interested in AVCs for additional retirement savings
• AVC gives tax relief + 25% TFC at retirement
• Could start £100-200/month or lump sum £5k before April
• Next steps: Set up AVC and recommend investment strategy within AVC',
  'Intro meeting with Olivia Norris. Teacher with 12 years'' service in TPS. Exploring AVCs for additional retirement provision. Could contribute £5k lump sum before tax year end plus ongoing monthly.',
  NOW() - INTERVAL '10 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c14, v_user_id, 'Set up AVC arrangement linked to Teachers Pension', 1, false, 0),
  (m_id, c14, v_user_id, 'Recommend AVC investment fund based on risk profile', 2, false, 1);

-- Meeting 20: George Pemberton - Signup Meeting (Trust)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c9, v_tenant_id, 'Signup Meeting - Pemberton Trust Implementation', 'Signup Meeting',
  '2026-02-06 10:00:00+00', '2026-02-06 11:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"george.pemberton@outlook.com","name":"George Pemberton"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: George, I''m pleased to say the discounted gift trust is ready to proceed. The provider has confirmed the terms based on your age and selected income level.

George: Excellent. Remind me of the numbers.

Hannah: You''re investing £500,000 into the trust. Based on your age of 75 and the 5% income withdrawal you''ve chosen, the discount — the actuarial value of your retained income rights — is approximately £165,000. This means £335,000 is immediately treated as a potentially exempt transfer. If you survive seven years, the full £500,000 is outside your estate. Even if you don''t survive seven years, the £165,000 was never in your estate in the first place.

George: And the income?

Hannah: You''ll receive 5% of the original investment each year — £25,000 — paid monthly at approximately £2,083. This is treated as a return of capital rather than income, so there''s no income tax liability until you''ve received back the full £500,000, which would take 20 years. Given the fund should grow over time, the actual pot should be worth more than the withdrawals.

George: What about the solicitor?

Hannah: I''ve spoken to your solicitor about updating your will. She''s suggested we meet together next month to align the will with the trust and your overall estate plan. I''ve also drafted the pension nomination forms to ensure your pension fund is directed to your children efficiently.',
  '• Discounted gift trust: £500k investment, £165k discount
• £335k immediately as PET, full £500k outside estate after 7 years
• Income: 5% = £25k pa (£2,083/month), tax-deferred
• Pension nominations updated for children
• Solicitor meeting planned to align will with trust
• Next steps: Execute trust, fund transfer, and solicitor meeting',
  'Trust implementation for George Pemberton. £500k discounted gift trust with £165k discount. Immediate PET of £335k. Income of £25k pa tax-deferred. Coordinating with solicitor on will update.',
  NOW() - INTERVAL '3 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c9, v_user_id, 'Execute fund transfer of £500k to discounted gift trust', 1, false, 0),
  (m_id, c9, v_user_id, 'Schedule joint meeting with solicitor for will update', 1, false, 1),
  (m_id, c9, v_user_id, 'Submit updated pension nomination forms', 2, false, 2);

-- Meetings 21-30: Additional past meetings to fill out the 30 total
-- Meeting 21: James Whitfield - Signup Meeting (DB Transfer)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c1, v_tenant_id, 'Signup Meeting - Whitfield DB Transfer Execution', 'Signup Meeting',
  '2026-01-08 10:00:00+00', '2026-01-08 10:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"james.whitfield@outlook.com","name":"James Whitfield"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: James, the suitability report is complete and I''m recommending the DB transfer proceeds. Let me walk through the key points. The transfer value of £462,000 will be moved into your new SIPP. We''ll crystallise immediately to take the 25% tax-free cash of £115,500 and the remaining £346,500 goes into drawdown invested in a balanced growth portfolio. I''ve selected a mix of global equity funds at 60%, multi-asset income at 25%, and short-duration bonds at 15%.

James: And the tax-free cash — we discussed using some for the IHT gifting?

Hannah: Exactly. I''d recommend keeping £30,000 in accessible savings and gifting £85,000 to your children now as potentially exempt transfers. After seven years they''re completely outside your estate.

James: Let''s sign everything.',
  '• DB transfer approved: £462k to SIPP
• TFC: £115,500 — £30k savings, £85k gifted to children as PETs
• Drawdown: £346,500 in balanced growth (60/25/15 equity/multi-asset/bonds)
• Suitability report signed and filed
• Next steps: Execute transfer and monitor',
  'DB transfer execution for James Whitfield. £462k transferred to SIPP, £115.5k TFC taken. £85k gifted to children as PETs for IHT. Drawdown portfolio established.',
  NOW() - INTERVAL '32 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c1, v_user_id, 'Submit DB pension transfer paperwork to scheme', 1, true, 0),
  (m_id, c1, v_user_id, 'Set up SIPP drawdown investment portfolio', 1, true, 1),
  (m_id, c1, v_user_id, 'Record PET gifts of £85k for IHT tracking', 2, true, 2);

-- Meeting 22: Emma Hartley - Cashflow Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c4, v_tenant_id, 'Cashflow Meeting - Hartley Pension Contribution Plan', 'Cashflow Meeting',
  '2026-01-17 16:30:00+00', '2026-01-17 17:15:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"emma.hartley@yahoo.co.uk","name":"Emma Hartley"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Emma, I''ve completed the annual allowance calculation. Good news — you''re comfortably within the full £60,000 allowance. Your adjusted income including NHS employer contributions is £178,000, well below the £260,000 tapering threshold. You''ve used £18,000 of this year''s allowance through your NHS pension accrual. Carry-forward from 2022/23 is £22,000, 2023/24 is £25,000, and 2024/25 is £20,000. Total available: £109,000 including current year.

Emma: Wonderful. I can afford to put in about £60,000 from savings. What''s the tax saving?

Hannah: At 40% higher rate relief, £60,000 saves you £24,000 in tax. And because it reduces your adjusted net income, you stay comfortably below any tapering concerns for future years too.',
  '• Annual allowance: full £60k, no tapering (adjusted income £178k)
• Current year used: £18k (NHS accrual), remaining: £42k
• Carry-forward: £67k from 3 prior years
• Total available: £109k
• Contributing £60k — tax saving £24k at 40% HR relief
• Next steps: Process pension contribution before April 5th',
  'Pension contribution planning for Emma Hartley. Full £60k allowance confirmed, no tapering. £60k additional contribution planned with £24k tax relief. Carry-forward verified.',
  NOW() - INTERVAL '23 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c4, v_user_id, 'Process £60,000 pension contribution before April 5th', 1, false, 0),
  (m_id, c4, v_user_id, 'Confirm contribution with SIPP provider and obtain tax relief', 2, false, 1);

-- Meeting 23: David & Patricia Chen - Review Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c3, v_tenant_id, 'Review Meeting - Chen Drawdown Progress', 'Review Meeting',
  '2026-02-07 09:30:00+00', '2026-02-07 10:15:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"david.chen@btinternet.com","name":"David Chen"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: David, quick update on the drawdown implementation. Everything is now live. Your drawdown fund stands at £538,000 and the first monthly payment of £3,333 was processed on the 1st. The tax-free cash of £180,000 has been split as agreed — £50,000 emergency fund and the first ISA contributions of £20,000 each for you and Patricia are invested. The remaining £90,000 is in a notice account earning 4.8% while we wait for next tax year''s ISA allowances.

David: Perfect. And the IHT planning?

Hannah: We''re on track. I''ve prepared the gifting schedule starting April. You and Patricia will each gift £3,000 to your children using annual exemptions, plus we''ll establish regular monthly gifts of £500 each from your excess drawdown income as normal expenditure. I''ve also had the whole-of-life insurance quotes back — £350 per month for £200,000 of cover written in trust, which would cover a good chunk of any remaining IHT liability.',
  '• Drawdown live: £538k fund, £3,333/month payments started
• TFC deployed: £50k emergency, £40k ISAs, £90k notice account
• Gifting schedule from April: £6k annual exemptions + £12k pa from income
• Whole-of-life quote: £350/month for £200k cover in trust
• Next steps: Confirm whole-of-life policy and finalise April gifting',
  'Progress review for David Chen. Drawdown fully operational. TFC deployed across emergency fund, ISAs, and notice account. Gifting schedule prepared for April start. Whole-of-life insurance quoted at £350/month for £200k.',
  NOW() - INTERVAL '2 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c3, v_user_id, 'Submit whole-of-life insurance application written in trust', 1, false, 0),
  (m_id, c3, v_user_id, 'Set up standing orders for April gifting programme', 2, false, 1);

-- Meeting 24: William Ashton - Cashflow Meeting (earlier)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c13, v_tenant_id, 'Cashflow Meeting - Ashton Estate Valuation', 'Cashflow Meeting',
  '2025-11-28 09:00:00+00', '2025-11-28 10:00:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"w.ashton@talktalk.net","name":"William Ashton"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: William, I''ve been gathering all the valuations we need for the estate plan. Your property portfolio: the family home is now valued at £1.2 million based on recent comparable sales, and the two buy-to-lets are £480,000 and £370,000 respectively. Your investment ISA is at £400,000, pension fund £350,000, and current accounts total £200,000. The total estate is just under £3 million.

William: It''s more than I thought. The house prices in the area have gone up quite a bit.

Hannah: They have. The positive news is that with careful planning we can significantly reduce the IHT exposure. I''m going to present a full estate plan at our next meeting with specific recommendations for trusts, gifting, and insurance.',
  '• Estate valuation complete: ~£3m total
• Home £1.2m, BTLs £850k, ISA £400k, pension £350k, cash £200k
• Property values higher than expected
• Full estate plan being prepared
• Next steps: Present detailed IHT mitigation strategy',
  'Estate valuation session for William Ashton. Total estate confirmed at approximately £3m. Property values higher than expected. Full IHT mitigation plan to follow.',
  NOW() - INTERVAL '73 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c13, v_user_id, 'Compile comprehensive estate plan with IHT projections', 1, true, 0),
  (m_id, c13, v_user_id, 'Research discretionary trust options for BTL properties', 2, true, 1);

-- Meeting 25: Robert Blackwood - Cashflow Meeting (earlier review)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c5, v_tenant_id, 'Cashflow Meeting - Blackwood Mid-Year Check', 'Cashflow Meeting',
  '2025-10-08 11:00:00+00', '2025-10-08 11:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"r.blackwood@hotmail.co.uk","name":"Robert Blackwood"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Robert, this is our six-month check-in. Your drawdown portfolio is at £738,000 as of this week. You''ve withdrawn £21,000 over the last six months. The portfolio returned 4.1% for the period, which is ahead of benchmark. Asset allocation remains within tolerance bands. No rebalancing needed at this point.

Robert: Good. I''m happy with things as they are. Any changes you''d recommend?

Hannah: Not at this stage. The portfolio is performing well and your withdrawal rate is sustainable at around 5.5% gross. I will flag that we should schedule a more detailed annual review in January to look at the IHT position in light of the 2027 changes. That will be the big topic for next year.

Robert: Agreed. Let''s book that in.',
  '• Portfolio: £738k, 4.1% return over 6 months (ahead of benchmark)
• Withdrawals: £21k in 6 months, sustainable at 5.5% gross
• Asset allocation within tolerance — no rebalancing needed
• IHT review flagged for January annual meeting
• Next steps: Annual review in January with IHT focus',
  'Mid-year review for Robert Blackwood. Portfolio at £738k, 4.1% half-year return. Sustainable withdrawal rate. Full IHT review planned for January.',
  NOW() - INTERVAL '4 months' - INTERVAL '1 day')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c5, v_user_id, 'Schedule comprehensive annual review in January with IHT focus', 2, true, 0);

-- Meeting 26: Catherine Lloyd - Intro Meeting (earlier)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c10, v_tenant_id, 'Intro Meeting - Catherine Lloyd', 'Intro Meeting',
  '2025-09-18 17:00:00+00', '2025-09-18 17:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"c.lloyd@virginmedia.com","name":"Catherine Lloyd"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Catherine, thanks for getting in touch. Tell me about your financial situation and what you''re looking for.

Catherine: I''m a senior solicitor, partner track. Earning about £150,000 with bonus potential. I feel like I should be doing more with my money. I have a workplace pension but I''m not sure if I''m maximising it, and I have savings I want to invest more effectively. I also have two young children and want to start saving for them.

Hannah: Those are all excellent goals. Let me ask a few questions to understand the full picture. Do you own your home?

Catherine: Yes, with a mortgage. About £280,000 remaining on a property worth £650,000. Fixed rate until 2027.

Hannah: Good. And your workplace pension — how much are you contributing?

Catherine: I think about 8% with a 5% employer match. So 13% total on my salary.

Hannah: That''s a solid foundation. At £150,000 salary, your combined pension contributions are about £19,500 per year. The annual allowance is £60,000, so there''s significant headroom. Plus with carry-forward we could go even further. I''d love to do a full review and come back with recommendations across pensions, ISAs, and the children''s savings. Shall we schedule a follow-up?',
  '• Senior solicitor, ~£150k + bonus
• Mortgage: £280k on £650k property, fixed to 2027
• Workplace pension: 8% employee + 5% employer = 13% (~£19.5k pa)
• Significant annual allowance headroom (£40.5k unused)
• Wants to maximise pension, ISA, and children''s savings
• Next steps: Full financial review and recommendations',
  'Intro meeting with Catherine Lloyd. Senior solicitor earning £150k+. Good pension foundation but significant room to optimise. Plans for ISA and children''s savings. Full review to follow.',
  NOW() - INTERVAL '4 months' - INTERVAL '22 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c10, v_user_id, 'Gather full financial information: pension statements, savings, outgoings', 1, true, 0),
  (m_id, c10, v_user_id, 'Research JISA options and providers', 2, true, 1);

-- Meeting 27: Thomas & Helen Wright - Signup Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c7, v_tenant_id, 'Signup Meeting - Wright Drawdown Setup', 'Signup Meeting',
  '2026-02-04 10:30:00+00', '2026-02-04 11:15:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"tom.wright@icloud.com","name":"Thomas Wright"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Thomas, we''re ready to implement the hybrid drawdown strategy. I have the paperwork here for you to sign. Thomas''s SIPP: full crystallisation of £520,000. TFC of £130,000 to be invested into ISAs over time. Drawdown set to £2,500 per month initially. Investment portfolio: 65% global equity, 20% bonds, 10% alternatives, 5% cash.

Thomas: Helen and I have agreed on this approach. Let''s sign it.

Hannah: Perfect. The first payment should come through within 3-4 weeks of the transfer completing. I''ll also open ISA accounts for both of you ready for the new tax year.',
  '• Implementation: Thomas SIPP £520k crystallised
• TFC: £130k for ISA phasing
• Drawdown: £2,500/month (£30k pa)
• Portfolio: 65/20/10/5 equity/bonds/alts/cash
• Both signed off — processing to begin
• Next steps: Monitor transfer and first payment',
  'Drawdown implementation for Thomas Wright. £520k crystallised, £130k TFC, £30k pa drawdown. Hybrid strategy with ISA phasing. Paperwork signed.',
  NOW() - INTERVAL '5 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c7, v_user_id, 'Submit SIPP crystallisation paperwork', 1, false, 0),
  (m_id, c7, v_user_id, 'Open ISA accounts for Thomas and Helen', 2, false, 1);

-- Meeting 28: Sarah Mitchell - Review Meeting
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c2, v_tenant_id, 'Review Meeting - Mitchell VCT/Pension Update', 'Review Meeting',
  '2026-02-03 14:00:00+00', '2026-02-03 14:30:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"sarah.mitchell@gmail.com","name":"Sarah Mitchell"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Sarah, quick update on where things stand. The VCT applications have all been processed. Octopus Titan: £60,000 invested, Maven: £60,000 invested, British Smaller Companies: £60,000 invested. Total VCT: £180,000 with £54,000 income tax relief confirmed. Your pension contribution of £144,000 has been processed and the tax relief claim is submitted to HMRC. You should see the relief in your next self-assessment.

Sarah: Fantastic. And the company sale?

Hannah: Completion is next week I believe? Once the funds arrive, we''ll need to look at the remaining proceeds. After VCTs and pension, you''ll still have significant capital to invest. I''d suggest a blend of ISA, GIA, and potentially some EIS for additional tax relief.

Sarah: Yes, completion is Thursday. Let''s meet again after the money comes through.',
  '• VCTs: £180k invested across 3 managers — £54k relief confirmed
• Pension: £144k contributed — tax relief claim submitted
• Company sale completing next week
• Remaining proceeds need investment strategy
• Consider ISA, GIA, and EIS for further tax relief
• Next steps: Post-completion meeting to invest remaining funds',
  'Update meeting with Sarah Mitchell. VCT and pension investments confirmed and processed. Total tax relief of £118.8k. Company sale completing next week — further investment planning needed.',
  NOW() - INTERVAL '6 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c2, v_user_id, 'Prepare post-sale investment strategy for remaining proceeds', 1, false, 0),
  (m_id, c2, v_user_id, 'Research EIS opportunities for further tax relief', 2, false, 1);

-- Meeting 29: George Pemberton - Performance Meeting (earlier)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c9, v_tenant_id, 'Performance Meeting - Pemberton Portfolio Review', 'Performance Meeting',
  '2025-10-22 10:00:00+00', '2025-10-22 10:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"george.pemberton@outlook.com","name":"George Pemberton"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: George, your investment portfolio stands at £512,000, up from £488,000 at our last review. That''s a return of 4.9% for the period. Your pension fund is at £905,000. Income withdrawals from the portfolio have been £15,000 over the period. Everything is running smoothly.

George: Good. Hannah, I''ve been reading about these pension IHT changes. Should we be worried?

Hannah: It''s definitely something we need to address. The government has announced that from April 2027, unused pension funds will be included in the calculation of a person''s estate for IHT. For you, with a pension of £900,000+, this could add £360,000+ to your IHT bill. I want to schedule a dedicated meeting to go through your options in detail.

George: Yes, let''s do that urgently please.',
  '• Investment portfolio: £512k (up from £488k, 4.9% return)
• Pension fund: £905k
• IHT concern raised about 2027 pension changes
• Potential additional IHT of £360k+ from pension inclusion
• Dedicated IHT planning meeting needed urgently
• Next steps: Schedule comprehensive IHT review',
  'Performance review for George Pemberton. Portfolio at £512k, 4.9% return. Pension at £905k. Client raised IHT concerns — dedicated planning session scheduled.',
  NOW() - INTERVAL '3 months' - INTERVAL '18 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c9, v_user_id, 'Schedule urgent IHT planning meeting for George', 1, true, 0),
  (m_id, c9, v_user_id, 'Research discounted gift trust providers and terms', 1, true, 1);

-- Meeting 30: Richard & Janet Gallagher - Cashflow Meeting (earlier)
INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, transcript, quick_summary, summary, created_at)
VALUES (v_user_id, c15, v_tenant_id, 'Cashflow Meeting - Gallagher Drawdown Review', 'Cashflow Meeting',
  '2025-11-12 10:00:00+00', '2025-11-12 10:45:00+00', 'manual', 'video', 'Zoom Meeting', 'completed',
  '[{"email":"richard.gallagher@btinternet.com","name":"Richard Gallagher"},{"email":"janet.gallagher@btinternet.com","name":"Janet Gallagher"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb,
  'Hannah: Richard, Janet, welcome to your autumn check-in. Portfolio is at £685,000, you''ve withdrawn £18,000 in the last six months. The underlying return was 2.8% — slightly below target but consistent with the cautious market conditions. Bond allocation has provided stability. I''m satisfied the strategy remains sound.

Richard: We''re comfortable. Same withdrawals continuing.

Janet: We were wondering about the state pension increase. Will that affect our plans?

Hannah: The state pension triple lock means it''s likely to increase by around 4% in April. That would add about £460 per year to each of your state pensions. It''s a modest but helpful increase. We''ll factor the updated figures into the cashflow model at your annual review in February.',
  '• Portfolio: £685k, 2.8% half-year return — below target but stable
• Withdrawals: £18k in 6 months (£36k pa), continuing unchanged
• State pension triple lock increase expected ~4% in April
• Adds ~£920 pa combined
• Strategy remains sound — no changes needed
• Next steps: Annual review in February with updated cashflow',
  'Autumn review for Richard and Janet Gallagher. Portfolio steady at £685k. Withdrawals sustainable. State pension increase in April to be factored into annual review.',
  NOW() - INTERVAL '89 days')
RETURNING id INTO m_id;

INSERT INTO transcript_action_items (meeting_id, client_id, advisor_id, action_text, priority, completed, display_order)
VALUES
  (m_id, c15, v_user_id, 'Update cashflow model with April state pension increases', 2, true, 0);

-- ============================================================================
-- FUTURE MEETINGS (10 meetings)
-- ============================================================================

INSERT INTO meetings (userid, client_id, tenant_id, title, type, starttime, endtime, meeting_source, location_type, location_details, status, attendees, created_at)
VALUES
  -- Future 1: James Whitfield - Performance Review
  (v_user_id, c1, v_tenant_id, 'Performance Meeting - Whitfield Drawdown Review', 'Performance Meeting',
   '2026-02-20 10:00:00+00', '2026-02-20 11:00:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"james.whitfield@outlook.com","name":"James Whitfield"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 2: Emma Hartley - Signup Meeting
  (v_user_id, c4, v_tenant_id, 'Signup Meeting - Hartley Pension Contribution', 'Signup Meeting',
   '2026-02-18 16:00:00+00', '2026-02-18 16:45:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"emma.hartley@yahoo.co.uk","name":"Emma Hartley"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 3: William Ashton - Signup Meeting (Trust Implementation)
  (v_user_id, c13, v_tenant_id, 'Signup Meeting - Ashton Trust and Insurance', 'Signup Meeting',
   '2026-02-14 09:00:00+00', '2026-02-14 10:00:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"w.ashton@talktalk.net","name":"William Ashton"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 4: Mark & Louise Henderson - Cashflow Meeting
  (v_user_id, c11, v_tenant_id, 'Cashflow Meeting - Henderson Commutation Analysis', 'Cashflow Meeting',
   '2026-02-22 14:00:00+00', '2026-02-22 15:00:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"mark.henderson@gmail.com","name":"Mark Henderson"},{"email":"louise.henderson@gmail.com","name":"Louise Henderson"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 5: Fiona Campbell - Cashflow Meeting
  (v_user_id, c6, v_tenant_id, 'Cashflow Meeting - Campbell Investment Strategy', 'Cashflow Meeting',
   '2026-02-25 13:00:00+00', '2026-02-25 13:45:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"fiona.campbell@sky.com","name":"Fiona Campbell"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 6: Catherine Lloyd - Signup Meeting
  (v_user_id, c10, v_tenant_id, 'Signup Meeting - Lloyd Tax Year End Actions', 'Signup Meeting',
   '2026-02-16 17:30:00+00', '2026-02-16 18:15:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"c.lloyd@virginmedia.com","name":"Catherine Lloyd"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 7: Priya Sharma - Cashflow Meeting
  (v_user_id, c12, v_tenant_id, 'Cashflow Meeting - Sharma Ltd Company Pension Plan', 'Cashflow Meeting',
   '2026-03-05 11:00:00+00', '2026-03-05 11:45:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"priya.sharma@outlook.com","name":"Priya Sharma"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 8: Olivia Norris - Cashflow Meeting (AVC Setup)
  (v_user_id, c14, v_tenant_id, 'Cashflow Meeting - Norris AVC Implementation', 'Cashflow Meeting',
   '2026-02-28 15:30:00+00', '2026-02-28 16:15:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"olivia.norris@gmail.com","name":"Olivia Norris"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 9: George Pemberton - Review Meeting (Solicitor coordination)
  (v_user_id, c9, v_tenant_id, 'Review Meeting - Pemberton Will and Trust Alignment', 'Review Meeting',
   '2026-03-12 10:00:00+00', '2026-03-12 11:00:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"george.pemberton@outlook.com","name":"George Pemberton"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW()),

  -- Future 10: Amira Patel - Signup Meeting (ISA Investment)
  (v_user_id, c8, v_tenant_id, 'Signup Meeting - Patel ISA and Pension Setup', 'Signup Meeting',
   '2026-03-10 12:00:00+00', '2026-03-10 12:45:00+00', 'manual', 'video', 'Zoom Meeting', 'scheduled',
   '[{"email":"amira.patel@gmail.com","name":"Amira Patel"},{"email":"hannah@advicly.co.uk","name":"Hannah Central"}]'::jsonb, NOW());

-- ============================================================================
-- UPDATE MEETING COUNTS on clients
-- ============================================================================
UPDATE clients c SET
  meeting_count = (SELECT COUNT(*) FROM meetings m WHERE m.client_id = c.id AND m.userid = v_user_id),
  active_meeting_count = (SELECT COUNT(*) FROM meetings m WHERE m.client_id = c.id AND m.userid = v_user_id AND m.status = 'scheduled'),
  last_meeting_date = (SELECT MAX(starttime) FROM meetings m WHERE m.client_id = c.id AND m.userid = v_user_id AND m.status = 'completed')
WHERE c.id IN (c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15);

RAISE NOTICE '✅ Demo data seeded successfully!';
RAISE NOTICE '  - 15 clients created';
RAISE NOTICE '  - 30 past meetings with transcripts and action items';
RAISE NOTICE '  - 10 future meetings scheduled';
RAISE NOTICE '  - 20 business type entries';

END $$;
