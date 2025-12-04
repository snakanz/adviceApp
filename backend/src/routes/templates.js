const express = require('express');
const router = express.Router();
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { isSupabaseAvailable } = require('../lib/supabase');

// Default templates to seed the database
const defaultTemplates = [
  {
    id: 'auto-template',
    title: 'Advicly Summary',
    description: 'AI prompt for generating professional plain-text email summaries from meeting transcripts',
    content: `Role: You are a professional financial advisor's assistant helping {advisorName} write a follow-up email to a client after a meeting.

Goal: Generate a clear, professional, plain-text email that summarises the key discussion points and outlines next steps. This email should be ready to copy-paste and send with minimal editing.

CRITICAL FORMAT RULES:
1. NO markdown symbols whatsoever - no **, ##, *, bullets, or formatting characters
2. Use plain text only with natural paragraph breaks
3. Use numbered lists (1. 2. 3.) for action items - no bullets
4. Keep it concise - aim for 150-250 words maximum
5. Do NOT include subject lines or headers

Structure:
1. Warm opening - thank them for their time, reference the meeting naturally
2. Key points - summarise 2-4 main discussion topics in flowing paragraphs, include specific numbers/figures from the transcript
3. Next steps - list 3-5 clear action items with owners and timelines where mentioned
4. Closing - offer to help with questions, professional sign-off

Tone: Professional but warm. Write as if you're the advisor speaking directly to the client. Avoid jargon. Be specific with numbers and dates mentioned in the transcript.

Example format:

Hi {clientName},

It was great speaking with you today about your financial planning. Thank you for taking the time to discuss your goals.

We covered several important areas during our conversation. Regarding your pension, we discussed contributing 35,000 pounds from your limited company this tax year, which would provide significant tax benefits. We also reviewed your current protection arrangements and identified a gap in your life cover.

Here are the next steps we agreed:

1. I will prepare the written advice document for your pension contribution - expect this within two to three weeks
2. We will schedule a follow-up call to review the advice together
3. You will gather your latest pension statements for our records

Please let me know if you have any questions in the meantime. I look forward to our next conversation.

Best regards,
{advisorName}
{businessName}

Transcript:
{transcript}

Generate the email body only. No subject line. No markdown. Plain text only.`,
    type: 'auto-summary',
    is_default: true
  },
  {
    id: 'review-template',
    title: 'Review',
    description: 'Professional client review email generator - extracts data from transcripts and populates structured template',
    content: `You are "Client Review Assistant", a specialised AI designed to convert meeting transcripts into fully-structured client review emails for financial planning purposes. Your role is to extract information from the transcript and produce a polished, professional email following a strict template.

INPUT:
- Client Name: {clientName}
- Transcript: {transcript}
- Advisor: {advisorName} from {businessName}

---

EMAIL TEMPLATE STRUCTURE (MUST FOLLOW EXACT ORDER WITH SECTION HEADINGS)

Generate the email with these exact sections in this order:

---

1) PERSONALISED INTRODUCTION

Start with: "Dear [Client Name],"
Then: "Following our review meeting on [date from transcript], I have outlined the main points and my recommendations below."

---

2) YOUR CIRCUMSTANCES

Start with: "We discussed the following aspects of your financial situation, and you confirmed that none have changed materially since our last review:"
(If changes were mentioned in the transcript, rewrite accordingly to reflect those changes.)

For EACH of the following bullets, you MUST expand to at least 10 words:
- Health - e.g., "You remain in good health with no new concerns that may affect future financial planning, and you reported feeling stable and well overall."
- Personal circumstances - e.g., "Your employment, home life and family structure remain unchanged, with no expected adjustments in the foreseeable future."
- Income & expenditure - e.g., "Your income continues to be strong and reliable, and you do not anticipate any additional income needs or major expenditure changes over the next five years."
- Assets & liabilities - e.g., "Your property values and mortgage balances remain broadly aligned with previous assessments, with no new debts or liabilities added to your position."
- Emergency fund - e.g., "You continue to maintain a robust level of cash reserves across several accounts, which provides strong short-term financial security and flexibility."
- Tax status - e.g., "You remain an additional-rate taxpayer, and there are no expected near-term changes to your tax position."
- Capacity for loss - State whether this is unchanged and reference previous assessment.
- Attitude to risk - e.g., "Your attitude to risk remains Medium, reflecting your preference for balanced long-term growth while remaining comfortable with market volatility."

---

3) YOUR GOALS AND OBJECTIVES

Start with: "We reviewed your financial goals, confirming that no significant changes have occurred:"
(If changes exist, update wording accordingly.)

Include:
- Retirement planning - "Your intended retirement age remains [Age]."
- Capital growth objective - Target income/capital goal if mentioned.
- If cashflow modelling was discussed, include: "Updated cashflow modelling indicates a required return of [X]% p.a., or an additional contribution of [X] p.a., assuming a [X]% growth rate." (Only include if actual figures are in transcript.)
- Ongoing financial advice preference.
- Active investment management preference.
- Any additional goals (school fees, mortgage, etc.) as bullet points.

---

4) YOUR CURRENT INVESTMENTS

For each investment plan discussed in the transcript, summarise:
- Plan type (e.g., SJP Pension, ISA, etc.)
- Plan number (if mentioned, otherwise state "Not provided")
- Value (approximate if stated)
- Regular contributions (yes/no, amounts if known)

Then provide narrative covering:
- Investment performance since last review
- Fund selection and risk profile alignment
- Rebalancing discussion and outcome
- Legislation changes discussed
- New products/services discussed
- Suitability confirmation

---

5) INVESTMENT KNOWLEDGE & EXPERIENCE

Select ONE category based on transcript content and use the EXACT wording:

If NONE: "Having discussed this with you, we agreed you have no previous investment knowledge and experience because:"
Applicable bullets:
- You have not previously held investments outside of a bank, building society cash deposits, or National Savings & Investment products.

If LIMITED: "Having discussed this with you, we agreed you have limited investment knowledge and experience because:"
Applicable bullets:
- You have purchased investments where no significant investment volatility has been experienced since acquiring them.
- You hold investments; however, you have not made any active decisions.
- Your experience is limited to small Stocks & Shares ISAs.
- You hold investments in With-Profit Funds only and therefore have not experienced volatility due to the smoothing effect of bonuses.

If MODERATE: "Having discussed this with you, we agreed you have a moderate level of investment knowledge and experience because:"
Applicable bullets:
- You have purchased investments and experienced significant investment volatility.
- You have selected your own funds within a work-based pension instead of using the default fund.
- You have received advice to take Tax-Free Cash and have designated funds into Flexi-Access Drawdown.

If EXTENSIVE: "Having discussed this with you, we agreed you have an extensive level of investment knowledge and experience because:"
Applicable bullets:
- You regularly buy and sell shares or funds.
- You have purchased alternative investments such as hedge funds or commodities.
- You have investment experience through your employment.
- You are classed as a Professional Client.
- You have purchased shares in early-stage enterprise companies not yet listed on an exchange.

---

6) CAPACITY FOR LOSS

Select ONE category based on transcript content and use the EXACT wording:

If LOW: "We agreed you have a low capacity to withstand investment losses because:"
Applicable bullets:
- You have little net disposable income.
- You have limited ability to increase net disposable income because of high essential expenditure.
- You have minimal or no secured income.
- You have limited capital available to invest.
- You are already significantly exposed to investment risk through other investments.
- You are primarily reliant on income produced by your investments.
- Your emergency cash reserves would be rapidly exhausted if required.
- A significant fall in your investment value would negatively affect your short-term financial goals.

If MODERATE: "We agreed you have a moderate capacity to withstand investment losses because:"
Applicable bullets:
- You have sufficient disposable income and the ability to save regularly.
- Your investment portfolio is well diversified and not overly exposed to market risk.
- You are not primarily reliant on investment income.
- Your financial reserves would not be quickly exhausted if needed.
- A fall in investment value would impact goals, but you have flexibility to adjust plans accordingly.

If HIGH: "We agreed you have a high capacity to withstand investment losses because:"
Applicable bullets:
- You have a substantial, secure income and strong ability to save.
- You demonstrate robust financial planning and enjoy high disposable income.
- Your financial reserves would last several years if required for essential expenditure.
- You hold a well-diversified portfolio and maintain significant additional cash resources.

---

7) MY RECOMMENDATIONS

Summarise the key recommendations discussed in the meeting:
- Current investment suitability confirmation
- Recommended actions with clear steps
- Tax efficiency improvements
- Any product recommendations (ISAs, pension contributions, etc.)

---

8) PROTECTION

Use this default wording unless the transcript contradicts it:

"Having comprehensive insurance in place is fundamental to a strong financial plan and should include not just Life insurance but Income replacement and/or Critical Illness cover. We discussed your current protection policies and you confirmed you have employer cover in place. Note that if you change employer, there is no guarantee you will receive the same or better benefits which is why it is valuable to have personal protection as this is fully portable regardless of employer. This is an area we can assist in. Please let me know whether you would like to speak to my colleague who specialises in this area who can provide you guidance on best practice, structure and cost."

If no protection was confirmed:
"You did not confirm any existing protection policies. Please confirm your current Life, Income Protection, and Critical Illness cover so we can advise properly."

If personal protection is already in place, adjust the wording accordingly.

---

9) WILLS & POWER OF ATTORNEY

Default wording:
"I recommend that you make a valid will and keep it up to date with any future changes to your personal circumstances. This will should also include a Power of Attorney to ensure that decisions can be made on your behalf if you become unable to do so."

If the client already has these in place:
"You confirmed that you have an up-to-date will and Power of Attorney in place. We recommend reviewing these periodically to ensure they continue to reflect your wishes and circumstances."

---

10) INHERITANCE TAX PLANNING

Default wording:
"Your current assets and liabilities indicate a potential inheritance tax liability. You have opted not to address this currently as you are focused on wealth accumulation, but we will continue to monitor this and discuss planning options with you at future reviews."

If they are addressing IHT:
"We reviewed your estate planning position and you are actively addressing potential inheritance tax exposure through your existing planning strategy. We will continue to review this regularly."

If they do not have IHT exposure:
"Based on your current asset levels, no inheritance tax exposure is anticipated at present. We will continue to review this as part of future planning."

---

11) CASHFLOW MODELLING REFERENCE

If cashflow modelling was discussed, briefly reference it and the conclusions reached.

---

OUTPUT RULES

1. Write in UK English, professional but warm tone
2. Use section headings exactly as shown (e.g., "Your Circumstances", "Your Goals and Objectives")
3. NO markdown formatting (no **, no #, no tables)
4. NO placeholders like [X]% or [TO CONFIRM] - if data is missing, use neutral language
5. The email must be ready to send exactly as written
6. Sign off with: "Best regards," followed by {advisorName}

Generate the complete email now.`,
    type: 'review-summary',
    is_default: true
  }
];

// Helper function to check if a template has old markdown format
function hasOldMarkdownFormat(promptContent) {
  if (!promptContent) return false;
  // Check for common markdown patterns from the old template
  return promptContent.includes('## Key Discussion Points') ||
         promptContent.includes('**1. [Main Topic]**') ||
         promptContent.includes('Use bolded headings for clarity');
}

// Helper function to check if Review template has old format (missing 11-section structure)
function hasOldReviewFormat(promptContent) {
  if (!promptContent) return false;
  // The old Review template used reviewData JSON and didn't have the 11-section structure
  return promptContent.includes('reviewData is the primary source of truth') ||
         promptContent.includes('REVIEW DATA (JSON)') ||
         !promptContent.includes('EMAIL TEMPLATE STRUCTURE (MUST FOLLOW EXACT ORDER WITH SECTION HEADINGS)');
}

// GET /api/templates - Get all templates for the user
router.get('/', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Get user's templates from database
    const { data: templates, error } = await req.supabase
      .from('email_templates')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    // If no templates exist, seed with defaults
    if (!templates || templates.length === 0) {
      console.log('No templates found, seeding defaults...');
      const seededTemplates = await seedDefaultTemplates(req.supabase, userId);
      return res.json(seededTemplates);
    }

    // Auto-update any templates that have old formats
    const updatedTemplates = await Promise.all(templates.map(async (template) => {
      // Auto-update Advicly Summary templates with old markdown format
      if (template.title === 'Advicly Summary' &&
          template.type === 'auto-summary' &&
          hasOldMarkdownFormat(template.prompt_content)) {

        console.log(`🔄 Auto-updating Advicly Summary template ${template.id} to plain-text format`);

        const newContent = defaultTemplates.find(t => t.id === 'auto-template')?.content;

        if (newContent) {
          const { data: updated, error: updateError } = await req.supabase
            .from('email_templates')
            .update({
              prompt_content: newContent,
              description: 'AI prompt for generating professional plain-text email summaries from meeting transcripts',
              updated_at: new Date().toISOString()
            })
            .eq('id', template.id)
            .select()
            .single();

          if (!updateError && updated) {
            console.log(`✅ Updated Advicly Summary template ${template.id} to plain-text format`);
            return updated;
          }
        }
      }

      // Auto-update Review templates with old format (missing 11-section structure)
      if (template.title === 'Review' &&
          template.type === 'review-summary' &&
          hasOldReviewFormat(template.prompt_content)) {

        console.log(`🔄 Auto-updating Review template ${template.id} to 11-section format`);

        const newContent = defaultTemplates.find(t => t.id === 'review-template')?.content;

        if (newContent) {
          const { data: updated, error: updateError } = await req.supabase
            .from('email_templates')
            .update({
              prompt_content: newContent,
              description: 'Professional client review email generator - extracts data from transcripts and populates structured template',
              updated_at: new Date().toISOString()
            })
            .eq('id', template.id)
            .select()
            .single();

          if (!updateError && updated) {
            console.log(`✅ Updated Review template ${template.id} to 11-section format`);
            return updated;
          }
        }
      }

      return template;
    }));

    res.json(updatedTemplates);
  } catch (error) {
    console.error('Error in GET /templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to seed default templates
async function seedDefaultTemplates(supabase, userId) {
  const templatesToInsert = defaultTemplates.map(t => ({
    user_id: userId,
    title: t.title,
    description: t.description,
    prompt_content: t.content,
    type: t.type,
    is_default: t.is_default || false,
    version: 1
  }));

  const { data, error } = await supabase
    .from('email_templates')
    .insert(templatesToInsert)
    .select();

  if (error) {
    console.error('Error seeding templates:', error);
    return defaultTemplates.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      prompt_content: t.content,
      type: t.type,
      is_default: true
    }));
  }

  return data;
}

// GET /api/templates/:id - Get a single template
router.get('/:id', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: template, error } = await req.supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .single();

    if (error || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error in GET /templates/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates - Create a new template
router.post('/', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, prompt_content, type } = req.body;

    if (!title || !prompt_content) {
      return res.status(400).json({ error: 'Title and prompt content are required' });
    }

    const { data: template, error } = await req.supabase
      .from('email_templates')
      .insert({
        user_id: userId,
        title,
        description: description || '',
        prompt_content,
        type: type || 'custom',
        is_default: false,
        version: 1
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return res.status(500).json({ error: 'Failed to create template' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error in POST /templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/templates/:id - Update a template
router.put('/:id', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, description, prompt_content, type } = req.body;

    const { data: template, error } = await req.supabase
      .from('email_templates')
      .update({
        title,
        description,
        prompt_content,
        type,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return res.status(500).json({ error: 'Failed to update template' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error in PUT /templates/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await req.supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting template:', error);
      return res.status(500).json({ error: 'Failed to delete template' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /templates/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates/generate - Generate a template using AI
router.post('/generate', authenticateSupabaseUser, async (req, res) => {
  try {
    const { description, templateType } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const openai = require('../services/openai');
    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    // Get user profile for personalization
    const { data: user } = await req.supabase
      .from('users')
      .select('name, business_name')
      .eq('id', req.user.id)
      .single();

    const advisorName = user?.name || 'Financial Advisor';
    const businessName = user?.business_name || 'Financial Services';

    const prompt = `You are an expert at creating email templates for financial advisors.

Create a professional email template prompt for AI generation based on this description:
"${description}"

Template type: ${templateType || 'general email'}

The template should:
1. Be suitable for a financial advisor to send to clients
2. Use placeholders like {clientName}, {advisorName}, {businessName}, {transcript} where appropriate
3. Be professional, warm, and compliant with UK financial advice regulations
4. Include clear structure with greeting, main content, and sign-off
5. Sign off using the advisor's name: ${advisorName} from ${businessName}

Return ONLY the template prompt text, no additional explanation.`;

    const response = await openai.generateMeetingSummary(prompt, 'standard', { maxTokens: 1500 });

    res.json({
      generatedContent: response,
      suggestedTitle: `Custom: ${description.substring(0, 30)}...`,
      suggestedType: templateType || 'custom'
    });
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// GET /api/templates/user-profile - Get user profile for template personalization
router.get('/user-profile', authenticateSupabaseUser, async (req, res) => {
  try {
    const { data: user, error } = await req.supabase
      .from('users')
      .select('name, business_name, email')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      advisorName: user.name || user.email?.split('@')[0] || 'Financial Advisor',
      businessName: user.business_name || 'Financial Services',
      email: user.email
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

