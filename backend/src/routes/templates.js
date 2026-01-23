const express = require('express');
const router = express.Router();
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { isSupabaseAvailable } = require('../lib/supabase');

// Default templates to seed the database
const defaultTemplates = [
  {
    id: 'auto-template',
    title: 'Advicly Summary',
    description: 'AI-powered professional follow-up email that extracts key details and action items from your meeting',
    content: `Write a clear, friendly follow-up email for {advisorName} from {businessName} to send to their client {clientName} after a financial planning meeting on {meetingDate}.

WRITING STYLE:
- Plain text only (no markdown, no symbols).
- Professional but warm and natural - not overly formal.
- Write how a real adviser would write, not like a report.
- Avoid repetitive or formulaic phrasing.
- 180-280 words.

STRUCTURE (use as guidance, not rigid sections):

Start with a friendly greeting using the client's name.
Briefly thank them for their time and reference the meeting date and the main purpose of the discussion.
In a few natural paragraphs, summarise the key points discussed:
- What was reviewed or explored
- Any preferences, decisions, or concerns raised
- Any figures, percentages, or dates mentioned (exactly as stated)
- Group related topics together and keep the flow conversational

Include a short "Next steps" section using a numbered list:
- 3-6 clear actions
- Make it clear who is responsible for each action (I will / You will / We will)
- Include any timeframes mentioned in the meeting

Close the email warmly, inviting questions and confirming next contact.

End with:
Best regards,
{advisorName}
{businessName}

QUALITY STANDARDS:
- Every figure, date, and name you include MUST come directly from the transcript
- The email should feel like it was written by a real person who was in the meeting
- Use UK English spelling throughout (summarise, organise, favour, colour)
- Do NOT pad with generic financial advice or compliance statements not discussed
- Do NOT include topic areas that were not meaningfully discussed
- The level of detail should match the depth of the conversation

---

TRANSCRIPT TO ANALYSE:
{transcript}

---

Now generate the complete email. Extract real figures and details from the transcript. Plain text only, ready to copy and send.`,
    type: 'auto-summary',
    is_default: true
  },
  {
    id: 'review-template',
    title: 'Annual Review',
    description: 'Comprehensive annual review email - extracts all client data, figures, and recommendations from your meeting transcript',
    content: `You are "Client Review Assistant", a specialised AI that converts meeting transcripts into comprehensive annual review emails for UK financial advisors.

MEETING DETAILS (use these exact values):
- Meeting Date: {meetingDate}
- Client: {clientName}
- Advisor: {advisorName} from {businessName}

CRITICAL DATA ACCURACY RULES - READ CAREFULLY:
1. ONLY use information explicitly stated in the transcript - never invent details
2. Client name: Use EXACTLY as provided above: {clientName}
3. Meeting date: Use EXACTLY as provided above: {meetingDate} - do NOT guess a different date
4. Monetary values: Include ALL figures mentioned EXACTLY (e.g., "£250,000 pension value", "£1,500 monthly contribution")
5. Percentages: Quote EXACTLY as stated (e.g., "4.5% growth", "Medium risk profile")
6. Ages/dates: Use EXACTLY as mentioned (e.g., "retirement at age 60", "April 2025")
7. Plan numbers: Include if stated, otherwise write "reference on file"
8. If information is NOT in the transcript, use general language - NEVER guess specific figures

INPUT DATA:
- Transcript: {transcript}

---

EMAIL STRUCTURE (follow this exact format with these section headings):

---

Dear {clientName},

Following our review meeting on {meetingDate}, I have outlined the main points and my recommendations below.


YOUR CIRCUMSTANCES

We discussed the following aspects of your financial situation:

(For each item below, extract SPECIFIC details from the transcript. If a topic wasn't discussed, write "No changes discussed.")

Health: [Extract any health-related discussion or state "You confirmed you remain in good health."]

Personal circumstances: [Extract employment status, family situation changes, or state "No material changes to your personal circumstances."]

Income and expenditure: [Extract SPECIFIC income figures, salary amounts, or state current situation generally.]

Assets and liabilities: [List SPECIFIC property values, mortgage balances, savings amounts if mentioned. Include ALL figures from transcript.]

Emergency fund: [State specific cash reserve amounts if mentioned, or general position.]

Tax status: [Extract tax band, status if mentioned - e.g., "higher rate taxpayer", "additional rate".]

Capacity for loss: [Extract from transcript - LOW/MODERATE/HIGH and reason.]

Attitude to risk: [Extract EXACT risk profile if mentioned - e.g., "Balanced", "Medium", "Cautious".]


YOUR GOALS AND OBJECTIVES

[Extract ALL goals discussed. Include SPECIFIC figures:]

Retirement planning: [Extract retirement age, target income, pension goals with EXACT figures.]

Capital growth: [Extract target amounts, growth objectives.]

Income requirements: [Extract income needs in retirement, specific amounts.]

Other goals: [Extract any other objectives - school fees, property, inheritance, etc. with figures.]


YOUR CURRENT INVESTMENTS

[For EACH investment discussed, extract and list:]

[Plan Type] - [Provider if mentioned]
Value: [EXACT figure from transcript or "as per latest statement"]
Contributions: [Amount and frequency if mentioned]
Performance: [Specific performance figures if discussed]

[Repeat for each plan/account discussed]

Investment review summary:
- Performance assessment: [Extract specific commentary from transcript]
- Fund selection: [Extract any fund changes or confirmations]
- Risk alignment: [Extract risk profile match discussion]
- Rebalancing: [Extract any rebalancing decisions]


MY RECOMMENDATIONS

[Extract ALL recommendations from the transcript with SPECIFIC figures:]

1. [First recommendation with specific amounts/actions]
2. [Second recommendation]
3. [Continue for all recommendations discussed]

[Include specific contribution amounts, tax planning figures, product recommendations with values.]


PROTECTION

[Extract protection discussion. Include:]
- Current cover: [List specific policies/amounts if mentioned]
- Gaps identified: [List any protection gaps discussed]
- Recommendations: [Specific recommendations made]

[If not discussed, use: "We recommend reviewing your protection arrangements. Please let me know if you would like to discuss this with our protection specialist."]


WILLS AND POWER OF ATTORNEY

[Extract from transcript - do they have wills/POA in place? When last reviewed?]

[If not discussed, use: "We recommend ensuring you have an up-to-date will and Lasting Powers of Attorney in place."]


INHERITANCE TAX

[Extract IHT discussion with SPECIFIC figures if mentioned:]
- Current estate value estimate
- Potential IHT liability
- Planning strategies discussed

[If not discussed, use appropriate general statement based on context.]


NEXT STEPS

[List specific agreed actions with WHO is responsible and WHEN:]

1. [Action] - [Who] - [Timeframe]
2. [Continue for all agreed actions]


Please do not hesitate to contact me if you have any questions.

Best regards,
{advisorName}
{businessName}

---

OUTPUT RULES:
1. UK English spelling throughout
2. Use section headings EXACTLY as shown above
3. NO markdown formatting (no **, ##, *, bullet symbols) - use plain text only
4. Include EVERY specific figure, date, and name from the transcript
5. Never use placeholder text like "[X]%" or "[TO CONFIRM]" - if data missing, use general language
6. The email must be ready to send without editing
7. Double-check all numbers match the transcript exactly

Generate the complete review email now, extracting all specific data from the transcript.`,
    type: 'review-summary',
    is_default: true
  }
];

// Helper function to check if Advicly Summary template needs updating
function hasOldSummaryFormat(promptContent) {
  if (!promptContent) return false;
  // Check for patterns from older template versions
  return promptContent.includes('## Key Discussion Points') ||
         promptContent.includes('**1. [Main Topic]**') ||
         promptContent.includes('Use bolded headings for clarity') ||
         promptContent.includes('Role: You are a professional financial advisor') ||
         (promptContent.includes('CRITICAL FORMAT RULES') && !promptContent.includes('CRITICAL DATA ACCURACY RULES')) ||
         // Old format used rigid EMAIL STRUCTURE with section headers
         (promptContent.includes('EMAIL STRUCTURE:') && promptContent.includes('GREETING (1 line)')) ||
         // Old format used CRITICAL DATA ACCURACY RULES instead of QUALITY STANDARDS
         (promptContent.includes('CRITICAL DATA ACCURACY RULES') && !promptContent.includes('QUALITY STANDARDS')) ||
         // Check if template is missing the new WRITING STYLE section
         (promptContent.includes('{transcript}') && !promptContent.includes('WRITING STYLE:'));
}

// Helper function to check if Review template has old format
function hasOldReviewFormat(promptContent) {
  if (!promptContent) return false;
  // The old Review template didn't have the enhanced data extraction rules or meeting date placeholder
  return promptContent.includes('reviewData is the primary source of truth') ||
         promptContent.includes('REVIEW DATA (JSON)') ||
         (promptContent.includes('EMAIL TEMPLATE STRUCTURE') && !promptContent.includes('CRITICAL DATA ACCURACY RULES - READ CAREFULLY')) ||
         (promptContent.includes('Your Circumstances') && !promptContent.includes('For each item below, extract SPECIFIC details')) ||
         // New: Check if template is missing meeting date support
         (promptContent.includes('CRITICAL DATA ACCURACY RULES') && !promptContent.includes('{meetingDate}'));
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
      // Auto-update Advicly Summary templates with old format
      if (template.title === 'Advicly Summary' &&
          template.type === 'auto-summary' &&
          hasOldSummaryFormat(template.prompt_content)) {

        console.log(`🔄 Auto-updating Advicly Summary template ${template.id} to enhanced data extraction format`);

        const newContent = defaultTemplates.find(t => t.id === 'auto-template')?.content;
        const newDescription = defaultTemplates.find(t => t.id === 'auto-template')?.description;

        if (newContent) {
          const { data: updated, error: updateError } = await req.supabase
            .from('email_templates')
            .update({
              prompt_content: newContent,
              description: newDescription || 'AI-powered professional follow-up email that extracts key details and action items from your meeting',
              updated_at: new Date().toISOString()
            })
            .eq('id', template.id)
            .select()
            .single();

          if (!updateError && updated) {
            console.log(`✅ Updated Advicly Summary template ${template.id} to enhanced format`);
            return updated;
          }
        }
      }

      // Auto-update Review/Annual Review templates with old format
      if ((template.title === 'Review' || template.title === 'Annual Review') &&
          template.type === 'review-summary' &&
          hasOldReviewFormat(template.prompt_content)) {

        console.log(`🔄 Auto-updating Review template ${template.id} to enhanced data extraction format`);

        const newContent = defaultTemplates.find(t => t.id === 'review-template')?.content;
        const newDescription = defaultTemplates.find(t => t.id === 'review-template')?.description;
        const newTitle = defaultTemplates.find(t => t.id === 'review-template')?.title;

        if (newContent) {
          const { data: updated, error: updateError } = await req.supabase
            .from('email_templates')
            .update({
              title: newTitle || 'Annual Review',
              prompt_content: newContent,
              description: newDescription || 'Comprehensive annual review email - extracts all client data, figures, and recommendations from your meeting transcript',
              updated_at: new Date().toISOString()
            })
            .eq('id', template.id)
            .select()
            .single();

          if (!updateError && updated) {
            console.log(`✅ Updated Review template ${template.id} to enhanced format`);
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

