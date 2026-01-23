const express = require('express');
const router = express.Router();
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { isSupabaseAvailable } = require('../lib/supabase');
const { GENERATION_MODES } = require('../services/emailPromptEngine');

// Build the Annual Review template content from the emailPromptEngine source of truth
function buildReviewTemplateContent() {
  const engineInstructions = GENERATION_MODES['review-summary'].instructions;
  // Replace engine placeholders with template display placeholders
  const displayContent = engineInstructions
    .replace('[client name]', '{clientName}')
    .replace('[meeting date]', '{meetingDate}')
    .replace('[Adviser name]', '{advisorName}')
    .replace('[Business name]', '{businessName}');

  return `Write a comprehensive annual review follow-up email for {advisorName} from {businessName} to send to their client {clientName} after a review meeting on {meetingDate}.

${displayContent}

---

TRANSCRIPT TO ANALYSE:
{transcript}

---

Now generate the complete review email. Extract all specific data from the transcript. Plain text only, ready to send.`;
}

// Build the Advicly Summary template content from the emailPromptEngine source of truth
// This ensures the Templates page always shows exactly what the engine uses for generation
function buildAdviclyTemplateContent() {
  const engineInstructions = GENERATION_MODES['auto-summary'].instructions;
  // Replace engine placeholders with template display placeholders
  const displayContent = engineInstructions
    .replace('[Adviser name]', '{advisorName}')
    .replace('[Business name]', '{businessName}');

  return `Write a clear, friendly follow-up email for {advisorName} from {businessName} to send to their client {clientName} after a financial planning meeting on {meetingDate}.

${displayContent}

---

TRANSCRIPT TO ANALYSE:
{transcript}

---

Now generate the complete email. Extract real figures and details from the transcript. Plain text only, ready to copy and send.`;
}

// Default templates to seed the database
const defaultTemplates = [
  {
    id: 'auto-template',
    title: 'Advicly Summary',
    description: 'AI-powered professional follow-up email that extracts key details and action items from your meeting',
    get content() { return buildAdviclyTemplateContent(); },
    type: 'auto-summary',
    is_default: true
  },
  {
    id: 'review-template',
    title: 'Annual Review',
    description: 'Comprehensive annual review email with all standard sections - extracts all client data, figures, and recommendations',
    get content() { return buildReviewTemplateContent(); },
    type: 'review-summary',
    is_default: true
  }
];

// Helper function to check if Advicly Summary template needs updating
// Compares stored template against the current emailPromptEngine source of truth
function hasOldSummaryFormat(promptContent) {
  if (!promptContent) return false;

  // Get the current canonical content from the engine
  const currentContent = buildAdviclyTemplateContent();

  // If stored content doesn't match current engine content, it's outdated
  // Use a key phrase check rather than full equality to handle minor whitespace differences
  const hasCurrentWritingStyle = promptContent.includes('WRITING STYLE:') &&
                                  promptContent.includes('QUALITY STANDARDS:') &&
                                  promptContent.includes('STRUCTURE (use as guidance, not rigid sections)');

  if (!hasCurrentWritingStyle) return true;

  // Also check for explicitly old patterns
  return promptContent.includes('## Key Discussion Points') ||
         promptContent.includes('**1. [Main Topic]**') ||
         promptContent.includes('Use bolded headings for clarity') ||
         promptContent.includes('Role: You are a professional financial advisor') ||
         promptContent.includes('CRITICAL FORMAT RULES') ||
         (promptContent.includes('EMAIL STRUCTURE:') && promptContent.includes('GREETING (1 line)')) ||
         (promptContent.includes('CRITICAL DATA ACCURACY RULES') && !promptContent.includes('QUALITY STANDARDS'));
}

// Helper function to check if Review template has old format
// Compares stored template against the current emailPromptEngine source of truth
function hasOldReviewFormat(promptContent) {
  if (!promptContent) return false;

  // Check for the current format markers from the new engine
  const hasCurrentFormat = promptContent.includes('INVESTMENT KNOWLEDGE AND EXPERIENCE') &&
                           promptContent.includes('CAPACITY FOR LOSS') &&
                           promptContent.includes('ACTION LIST (NEXT STEPS)') &&
                           promptContent.includes('Kind regards,');

  if (!hasCurrentFormat) return true;

  // Also catch explicitly old patterns
  return promptContent.includes('reviewData is the primary source of truth') ||
         promptContent.includes('REVIEW DATA (JSON)') ||
         promptContent.includes('MY RECOMMENDATIONS') ||
         promptContent.includes('CRITICAL DATA ACCURACY RULES - READ CAREFULLY');
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

