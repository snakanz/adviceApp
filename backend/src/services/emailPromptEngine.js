/**
 * Email Prompt Engine - Data-driven, transcript-led AI email generation
 *
 * This module replaces the old template-placeholder system with a structured,
 * multi-message prompt architecture that produces bespoke, accurate emails.
 *
 * Key principles:
 * - Structured data context (JSON) passed separately from instructions
 * - Conditional section inclusion based on transcript content
 * - Confidence scoring for all metadata
 * - Deterministic greeting/sign-off (injected by backend, not AI)
 * - Graceful omission of undiscussed topics
 */

// ============================================================================
// SYSTEM PROMPT - Fixed role definition and constraints
// ============================================================================

const SYSTEM_PROMPT = `You are a professional email writer for UK-based financial advisers. You produce client-ready follow-up emails based on meeting transcripts.

CORE PRINCIPLES:
1. ACCURACY OVER COMPLETENESS - Only include information explicitly stated in the transcript. If something is unclear or insufficiently detailed, omit it entirely rather than guess or partially fill it.
2. BESPOKE CONTENT - Every email must reflect what was actually discussed in THIS specific meeting. Never include generic sections or boilerplate about topics not covered.
3. NATURAL LANGUAGE - Write as a real adviser would. Vary your sentence structure, avoid formulaic transitions, and ensure each email reads uniquely.
4. COMPLIANCE-SAFE - Use neutral language. Say "we discussed", "you mentioned", "I will look into" rather than making guarantees or definitive promises about outcomes.
5. GRACEFUL OMISSION - If a topic was only briefly mentioned without substantive detail, do NOT create a section for it. Only include topics where the transcript provides enough detail to write something meaningful and accurate.

DATA HIERARCHY (when conflicts exist between sources):
- Transcript wording takes priority over structured metadata
- If the transcript uses a different name spelling than metadata, follow the transcript
- Most recent information takes priority over historical data

STRICTLY FORBIDDEN:
- Never invent monetary figures, percentages, dates, names, or plan numbers
- Never include placeholder text like [X], {variable}, [TO CONFIRM], or [insert here]
- Never include sections about topics not substantively discussed in this meeting
- Never use markdown formatting (no **, ##, *, bullet symbols, backticks, or headings)
- Never include a subject line
- Never include a greeting line (this is handled separately)
- Never include a sign-off or signature block (this is handled separately)
- Never speculate about what "might have been discussed" or "was likely covered"
- Never pad thin content with generic advisory statements

OUTPUT FORMAT:
- Plain text only
- Numbered lists (1. 2. 3.) for action items and recommendations only
- Natural paragraph breaks between topics
- Professional but warm tone
- UK English spelling throughout
- Start directly with the email body content (no greeting, no sign-off)`;

// ============================================================================
// SECTION CANDIDATES - Conditional sections the AI may include
// ============================================================================

const SECTION_DEFINITIONS = {
  'circumstances_update': {
    heading: 'YOUR CIRCUMSTANCES',
    guidance: 'Summarise any changes or confirmations discussed regarding health, employment, family situation, income, assets, liabilities, tax status, risk profile, or capacity for loss. Only include sub-topics that were explicitly discussed with specific detail.',
    min_evidence: 'At least one specific circumstance must be discussed with detail in the transcript',
    keywords: ['health', 'employ', 'income', 'salary', 'mortgage', 'property', 'tax', 'risk', 'capacity for loss', 'marital', 'family', 'children', 'redundan']
  },
  'goals_and_objectives': {
    heading: 'YOUR GOALS AND OBJECTIVES',
    guidance: 'Extract all goals and objectives discussed, including retirement planning, capital growth targets, income requirements, and any other specific objectives. Include exact figures and timeframes mentioned.',
    min_evidence: 'Specific goals with figures or timeframes must be mentioned',
    keywords: ['retire', 'goal', 'objective', 'target', 'aim', 'plan to', 'want to', 'hoping to', 'income in retirement', 'school fees', 'inheritance']
  },
  'investment_review': {
    heading: 'YOUR INVESTMENTS',
    guidance: 'For each investment discussed, include the plan type, provider, value, contributions, and performance figures as stated in the transcript. Only include investments that were specifically reviewed with figures.',
    min_evidence: 'Specific investment values, performance figures, or fund names must be mentioned',
    keywords: ['pension', 'ISA', 'investment', 'fund', 'portfolio', 'performance', 'return', 'growth', 'contribution', 'annuit', 'drawdown', 'SIPP', 'stakeholder']
  },
  'recommendations': {
    heading: 'MY RECOMMENDATIONS',
    guidance: 'List specific recommendations made by the adviser during the meeting. Include exact figures, product types, and actions recommended. Use a numbered list.',
    min_evidence: 'The adviser must have made explicit recommendations with specific actions or amounts',
    keywords: ['recommend', 'suggest', 'advise', 'propose', 'should consider', 'option would be', 'I think we should', 'my recommendation']
  },
  'protection': {
    heading: 'PROTECTION',
    guidance: 'Summarise any discussion about life insurance, critical illness cover, income protection, or other protection policies. Include specific cover amounts and policy details if mentioned.',
    min_evidence: 'Protection policies or needs must be specifically discussed',
    keywords: ['life insurance', 'life cover', 'critical illness', 'income protection', 'death in service', 'protection', 'policy', 'cover amount']
  },
  'estate_planning': {
    heading: 'ESTATE PLANNING',
    guidance: 'Cover any discussion of wills, powers of attorney, inheritance tax planning, trusts, or gifting strategies. Include specific figures and arrangements discussed.',
    min_evidence: 'Estate planning topics must be specifically discussed with detail',
    keywords: ['will', 'power of attorney', 'inheritance tax', 'IHT', 'trust', 'gifting', 'estate', 'beneficiar', 'executor', 'probate', 'nil rate band']
  },
  'next_steps': {
    heading: 'NEXT STEPS',
    guidance: 'List the specific actions agreed during the meeting. Each item must specify WHO is responsible and WHAT they will do. Include any deadlines or timeframes mentioned. Use a numbered list.',
    min_evidence: 'Specific actions or follow-ups must have been agreed',
    keywords: ['will do', 'will send', 'follow up', 'next step', 'action', 'arrange', 'schedule', 'book', 'submit', 'complete', 'review in', 'come back to']
  }
};

// ============================================================================
// GENERATION MODES - Define behaviour per email type
// ============================================================================

const GENERATION_MODES = {
  'auto-summary': {
    id: 'auto-summary',
    label: 'Advicly Summary',
    description: 'Professional follow-up email that extracts key details and action items',
    target_length: '200-350 words',
    sections: ['next_steps'],
    instructions: `Write a professional follow-up email body from a UK financial adviser to their client after a meeting.

STRUCTURE (follow this flow exactly):

1. OPENING (1-2 sentences):
   - Thank the client for their time
   - Reference the meeting date (from the verified data above) and briefly state what the meeting covered
   - Example tone: "Thank you for taking the time to meet on Wednesday, 15th January. It was great to catch up and review your financial position."

2. DISCUSSION SUMMARY (2-4 paragraphs of natural flowing prose):
   - Summarise the key topics discussed in conversational but professional language
   - Include ALL specific figures mentioned in the transcript: monetary amounts (e.g. "your pension is currently valued at £285,000"), percentages (e.g. "growth of 4.2% over the past year"), dates, ages, and timeframes
   - Group related topics together into coherent paragraphs
   - Mention any decisions made or preferences expressed by the client
   - Reference any changes to circumstances that were discussed
   - Be specific and detailed - this should read as a personalised recap, not a generic summary
   - Vary sentence length and structure to sound natural

3. NEXT STEPS (numbered list):
   - List 3-6 concrete action items that were agreed during the meeting
   - Each item MUST specify WHO is responsible: "I will..." (adviser), "You will..." (client), or "We will..." (both)
   - Include any deadlines or timeframes mentioned (e.g. "I will send the updated illustration by Friday")
   - Use clear, specific action verbs (send, review, complete, arrange, submit)
   - Only include actions that were explicitly discussed or agreed - never invent tasks

4. CLOSING (1-2 sentences):
   - Offer availability for questions
   - Express looking forward to the next conversation or review
   - Example tone: "Please don't hesitate to get in touch if you have any questions in the meantime. I look forward to catching up again soon."

QUALITY STANDARDS:
- Every figure, date, and name you include MUST come directly from the transcript
- The email should feel like it was written by a real person who was in the meeting, not generated by AI
- Use UK English spelling throughout (summarise, organise, favour, colour)
- Be warm but professional - this is a trusted adviser writing to their client
- Do NOT pad with generic financial advice or compliance statements not discussed in the meeting
- Do NOT include topic areas that were not meaningfully discussed
- The level of detail should match the depth of the conversation - a brief chat produces a shorter email, a detailed review produces a more comprehensive one`
  },
  'review-summary': {
    id: 'review-summary',
    label: 'Annual Review',
    description: 'Comprehensive review email with structured sections',
    target_length: '400-900 words',
    sections: ['circumstances_update', 'goals_and_objectives', 'investment_review', 'recommendations', 'protection', 'estate_planning', 'next_steps'],
    instructions: `Write a comprehensive annual review email body for this meeting.

STRUCTURE:
- Opening: 1-2 sentences referencing the review meeting
- Then include ONLY the relevant section candidates below, using their headings
- Each section heading should be on its own line in CAPITALS (plain text, not markdown)
- End with the NEXT STEPS section (numbered list of agreed actions)
- Closing: 1-2 sentences offering to answer questions

CRITICAL RULES FOR SECTION INCLUSION:
- ONLY include a section if the transcript contains SUBSTANTIVE discussion on that topic
- "Substantive" means specific details, figures, or decisions - not just a passing mention
- If a topic was briefly acknowledged but not explored in detail, OMIT that section entirely
- It is far better to have fewer, well-populated sections than many thin ones
- For each section you include, extract ALL specific figures, dates, and details from the transcript
- If only 2-3 sections have substantive content, that is perfectly fine - only include those
- Never include generic filler text like "No changes discussed" or "We recommend reviewing..." for sections that weren't covered`
  }
};

// ============================================================================
// DATA CONTEXT BUILDER - Assembles verified meeting data with confidence scores
// ============================================================================

/**
 * Build structured meeting context with confidence scoring
 * @param {object} supabase - Supabase client
 * @param {string} userId - Authenticated user ID
 * @param {string} meetingId - Meeting ID (optional)
 * @param {string} transcript - Meeting transcript
 * @returns {object} Structured context with confidence scores
 */
async function buildMeetingContext(supabase, userId, meetingId, transcript) {
  const context = {
    meeting: {
      date: null,
      date_confidence: 'none',
      title: null
    },
    adviser: {
      name: null,
      name_confidence: 'none',
      business: null,
      business_confidence: 'none'
    },
    client: {
      name: null,
      name_confidence: 'none'
    }
  };

  // Fetch adviser profile
  try {
    const { data: user } = await supabase
      .from('users')
      .select('name, business_name')
      .eq('id', userId)
      .single();

    if (user?.name) {
      context.adviser.name = user.name;
      context.adviser.name_confidence = 'high';
    }
    if (user?.business_name) {
      context.adviser.business = user.business_name;
      context.adviser.business_confidence = 'high';
    }
  } catch (err) {
    console.warn('Could not fetch adviser profile:', err.message);
  }

  // Fetch meeting and client data
  if (meetingId) {
    try {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('client_id, clients(name), start_time, starttime, title')
        .eq('id', meetingId)
        .single();

      if (meeting) {
        // Client name from DB relationship
        if (meeting.clients?.name && meeting.clients.name !== 'Unknown') {
          context.client.name = meeting.clients.name;
          context.client.name_confidence = 'high';
        }

        // Meeting title
        if (meeting.title) {
          context.meeting.title = meeting.title;
        }

        // Meeting date
        const meetingStartTime = meeting.start_time || meeting.starttime;
        if (meetingStartTime) {
          context.meeting.date = formatMeetingDate(meetingStartTime);
          context.meeting.date_confidence = 'high';
        }
      }
    } catch (err) {
      console.warn('Could not fetch meeting data:', err.message);
    }
  }

  // Attempt client name extraction from transcript if not found in DB
  if (!context.client.name || context.client.name_confidence === 'none') {
    const extractedName = extractClientNameFromTranscript(transcript);
    if (extractedName) {
      context.client.name = extractedName;
      context.client.name_confidence = 'medium';
    }
  }

  return context;
}

/**
 * Format a date string into UK-friendly format: "Wednesday, 21st January 2026"
 */
function formatMeetingDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                 (day === 2 || day === 22) ? 'nd' :
                 (day === 3 || day === 23) ? 'rd' : 'th';

  return `${dayNames[date.getDay()]}, ${day}${suffix} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Extract client name from transcript using common patterns
 */
function extractClientNameFromTranscript(transcript) {
  if (!transcript) return null;

  const patterns = [
    /(?:Hi|Hello|Dear|Speaking with|Meeting with|talking to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:client|customer|Mr|Mrs|Ms|Miss|Dr)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1] && match[1].length > 1) {
      // Filter out common false positives
      const falsePositives = ['The', 'This', 'That', 'Here', 'There', 'What', 'When', 'Where', 'How', 'Yes', 'No'];
      if (!falsePositives.includes(match[1])) {
        return match[1];
      }
    }
  }

  return null;
}

// ============================================================================
// SECTION CANDIDATE SELECTOR - Determines which sections are relevant
// ============================================================================

/**
 * Determine which section candidates are likely relevant based on transcript keywords
 * The AI still makes the final decision, but this pre-filters obviously irrelevant sections
 */
function determineSectionCandidates(mode, transcript) {
  const modeConfig = GENERATION_MODES[mode] || GENERATION_MODES['auto-summary'];
  const transcriptLower = transcript.toLowerCase();

  // For auto-summary mode, sections are minimal (just next_steps)
  if (mode === 'auto-summary') {
    return {
      mode: modeConfig.id,
      label: modeConfig.label,
      target_length: modeConfig.target_length,
      instructions: modeConfig.instructions,
      section_candidates: ['next_steps']
    };
  }

  // For review mode, pre-filter sections based on keyword presence
  const candidates = modeConfig.sections.filter(sectionId => {
    const def = SECTION_DEFINITIONS[sectionId];
    if (!def) return false;

    // next_steps is always included for reviews
    if (sectionId === 'next_steps') return true;

    // Check if transcript likely contains relevant content
    if (def.keywords && def.keywords.length > 0) {
      return def.keywords.some(kw => transcriptLower.includes(kw.toLowerCase()));
    }

    return true;
  });

  return {
    mode: modeConfig.id,
    label: modeConfig.label,
    target_length: modeConfig.target_length,
    instructions: modeConfig.instructions,
    section_candidates: candidates
  };
}

// ============================================================================
// CONFIDENCE-AWARE INSTRUCTIONS - Adjusts prompt based on data quality
// ============================================================================

/**
 * Generate additional instructions based on data confidence levels
 */
function buildConfidenceNotes(context) {
  const notes = [];

  // Client name handling
  if (context.client.name_confidence === 'none' || !context.client.name) {
    notes.push('Client name is unknown. Do NOT guess a name. The greeting will be handled separately.');
  } else if (context.client.name_confidence === 'medium') {
    notes.push(`Client name "${context.client.name}" was extracted from the transcript (medium confidence). If the transcript uses this name consistently, it is correct.`);
  }

  // Meeting date handling
  if (context.meeting.date_confidence === 'none' || !context.meeting.date) {
    notes.push('Meeting date is unknown. Use "our recent meeting" instead of a specific date. Do NOT guess or invent a date.');
  }

  // Adviser name handling
  if (context.adviser.name_confidence === 'none' || !context.adviser.name) {
    notes.push('Adviser name is unknown. Do not include a name reference in the body. The sign-off will be handled separately.');
  }

  return notes.length > 0 ? '\nDATA CONFIDENCE NOTES:\n' + notes.map(n => `- ${n}`).join('\n') : '';
}

// ============================================================================
// GREETING & SIGN-OFF - Deterministic, injected by backend
// ============================================================================

/**
 * Generate deterministic greeting line based on verified data
 */
function buildGreeting(context) {
  if (context.client.name && context.client.name_confidence !== 'none') {
    return `Dear ${context.client.name},`;
  }
  return 'Dear Client,';
}

/**
 * Generate deterministic sign-off block based on verified data
 */
function buildSignOff(context) {
  const parts = ['Best regards,'];

  if (context.adviser.name && context.adviser.name_confidence !== 'none') {
    parts.push(context.adviser.name);
  }
  if (context.adviser.business && context.adviser.business_confidence !== 'none') {
    parts.push(context.adviser.business);
  }

  return parts.join('\n');
}

// ============================================================================
// PROMPT BUILDER - Constructs the full multi-message prompt
// ============================================================================

/**
 * Build the complete messages array for OpenAI
 * @param {object} context - Meeting context from buildMeetingContext
 * @param {object} sectionConfig - From determineSectionCandidates
 * @param {string} transcript - The meeting transcript
 * @returns {Array} Messages array for OpenAI chat completions
 */
function buildPromptMessages(context, sectionConfig, transcript) {
  const confidenceNotes = buildConfidenceNotes(context);

  // Build section guidance for review mode
  let sectionGuidance = '';
  if (sectionConfig.mode === 'review-summary' && sectionConfig.section_candidates.length > 1) {
    sectionGuidance = '\n\nSECTION CANDIDATES (include ONLY those with substantive transcript content):\n';
    sectionGuidance += sectionConfig.section_candidates.map(sectionId => {
      const def = SECTION_DEFINITIONS[sectionId];
      if (!def) return '';
      return `- ${def.heading}: ${def.guidance}`;
    }).filter(Boolean).join('\n');
  }

  // Build the data context string
  const dataContext = `VERIFIED MEETING DATA:
- Meeting date: ${context.meeting.date || 'Unknown'}${context.meeting.date_confidence !== 'high' ? ' (low confidence)' : ''}
- Adviser: ${context.adviser.name || 'Unknown'}${context.adviser.business ? ` from ${context.adviser.business}` : ''}
- Client: ${context.client.name || 'Unknown'}${context.client.name_confidence !== 'high' ? ` (${context.client.name_confidence} confidence)` : ''}
${context.meeting.title ? `- Meeting title: ${context.meeting.title}` : ''}

GENERATION MODE: ${sectionConfig.label}
TARGET LENGTH: ${sectionConfig.target_length}
${confidenceNotes}`;

  // Build the user message
  const userMessage = `${dataContext}

${sectionConfig.instructions}
${sectionGuidance}

---

TRANSCRIPT:
${transcript}

---

IMPORTANT REMINDERS BEFORE YOU WRITE:
1. Do NOT include a greeting line (e.g., "Dear X,") - this is added separately
2. Do NOT include a sign-off (e.g., "Best regards, Name") - this is added separately
3. Start directly with the email body content
4. Only include topics with SUBSTANTIVE detail in the transcript
5. If a section candidate has insufficient detail in the transcript, OMIT it entirely
6. Every figure, date, and name you use MUST exist in the transcript above
7. Verify: no placeholders, no markdown, no invented data

Now write the email body content.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate a complete email with deterministic greeting/sign-off
 * This is the main entry point for the streaming endpoint
 *
 * @param {object} params
 * @param {object} params.supabase - Supabase client
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.meetingId - Meeting ID
 * @param {string} params.transcript - Meeting transcript
 * @param {string} params.templateType - 'auto-summary' or 'review-summary'
 * @returns {object} { messages, greeting, signOff, context, sectionConfig }
 */
async function prepareEmailGeneration({ supabase, userId, meetingId, transcript, templateType }) {
  // 1. Build structured data context with confidence scores
  const context = await buildMeetingContext(supabase, userId, meetingId, transcript);

  // 2. Determine section candidates based on mode and transcript
  const mode = templateType || 'auto-summary';
  const sectionConfig = determineSectionCandidates(mode, transcript);

  // 3. Build deterministic greeting and sign-off
  const greeting = buildGreeting(context);
  const signOff = buildSignOff(context);

  // 4. Build the prompt messages
  const messages = buildPromptMessages(context, sectionConfig, transcript);

  console.log(`📧 Email generation prepared: mode=${sectionConfig.mode}, sections=${sectionConfig.section_candidates.length}, client="${context.client.name || 'Unknown'}", date="${context.meeting.date || 'Unknown'}"`);

  return {
    messages,
    greeting,
    signOff,
    context,
    sectionConfig
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  prepareEmailGeneration,
  buildMeetingContext,
  buildGreeting,
  buildSignOff,
  determineSectionCandidates,
  formatMeetingDate,
  SYSTEM_PROMPT,
  GENERATION_MODES,
  SECTION_DEFINITIONS
};
