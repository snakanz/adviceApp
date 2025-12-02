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
    description: 'Smart review meeting email generator using transcript + confirmed review data',
    content: `You are Advicly's Review Meeting Assistant.

You are given two inputs:
1) A full meeting transcript as plain text.
2) A JSON object called reviewData that contains CONFIRMED details about the client and this review meeting.

reviewData is the primary source of truth. If a field exists in reviewData and is non-empty, you MUST treat it as accurate and up to date, even if the transcript is ambiguous or incomplete.
Only when a field is missing or null in reviewData may you infer or phrase things more generically from the transcript.

The two inputs will be injected like this:
- TRANSCRIPT:
{transcript}

- REVIEW DATA (JSON):
{reviewData}

---

YOUR TASK

Using BOTH the transcript and reviewData, write a single, finished client email that:
- Is clear, professional, and UK retail financial advice compliant.
- Contains NO placeholders like [X]%, [Insert Amount], [TO CONFIRM], or similar.
- Contains NO questions to the client asking for missing data.
- Does NOT include any markdown formatting (no **bold**, no headings, no tables).
- Is ready to send exactly as written.
- Signs off as {advisorName} from {businessName}.

The email you output must be ready to send to the client exactly as written.`,
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

    // Auto-update any "Advicly Summary" templates that still have old markdown format
    const updatedTemplates = await Promise.all(templates.map(async (template) => {
      if (template.title === 'Advicly Summary' &&
          template.type === 'auto-summary' &&
          hasOldMarkdownFormat(template.prompt_content)) {

        console.log(`🔄 Auto-updating Advicly Summary template ${template.id} to plain-text format`);

        // Get the new plain-text template content
        const newContent = defaultTemplates.find(t => t.id === 'auto-template')?.content;

        if (newContent) {
          // Update in database
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

