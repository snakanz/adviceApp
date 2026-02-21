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

const SYSTEM_PROMPT = `You are ghostwriting a follow-up email for a UK financial adviser to their client after a meeting. Your job is to make the email sound like the adviser actually wrote it — natural, personal, and specific to what happened in this conversation.

READ THE ROOM:
Before writing, pay close attention to the transcript's tone and emotional texture. Was the client excited about retirement? Worried about market losses? Relieved after resolving something? Frustrated by delays? Let the emotional undercurrent of the conversation shape how you write. An upbeat meeting should produce a warm, positive email. A serious discussion about health or loss should be empathetic and measured. A practical planning session should be clear and action-oriented.

Every email you write should feel different because every conversation IS different.

ACCURACY (non-negotiable):
- Every fact, figure, name, percentage, and date must come directly from the transcript. Never invent or guess.
- Only cover topics discussed with substance. Skip anything barely mentioned.
- Use neutral language for outcomes — "we discussed", "you mentioned", "I will look into" — never guarantee results.
- If the transcript conflicts with the metadata provided, follow the transcript.

FORMAT:
- Plain text only — no markdown, no bold, no headings, no bullet symbols, no subject line.
- Numbered lists (1. 2. 3.) for action items only.
- UK English spelling throughout.
- Write like a real person — vary your openings, transitions, and closings. Never be formulaic.`;

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
    target_length: 'Match the depth of the conversation',
    sections: ['next_steps'],
    includeGreetingSignOff: true,
    instructions: `Write a follow-up email from the adviser to the client after this meeting.

TONE — READ THE TRANSCRIPT:
Before you write a single word, read the full transcript and identify the emotional texture of the conversation. Was the client enthusiastic? Concerned? Relieved? Practical? Let that guide your tone, word choice, and energy. The email should feel like a natural continuation of the conversation that just happened.

CONTENT:
Cover the key points discussed in a natural, conversational way. Group related topics together. Include specific figures, dates, and names exactly as stated in the transcript. If the client expressed excitement or concern about something specific, acknowledge it — that's what makes the email feel personal rather than generated.

If CLIENT CONTEXT is provided below, use it naturally. Reference previous conversations or ongoing work where it fits — don't force it, but don't ignore it either. A long-standing client should feel like you know them. A new client should feel welcomed.

NEXT STEPS:
End with clear next steps — who needs to do what, and by when if mentioned. Use a numbered list for these.

LENGTH:
Write as much or as little as the conversation warrants. A quick 15-minute catch-up gets a concise email. A detailed hour-long planning session gets a thorough one. Don't pad thin conversations and don't truncate rich ones.

VOICE:
Open and close however feels natural for THIS particular conversation. Don't default to the same opening every time — vary it. Write as the adviser would actually write, not as a template would produce.`
  },
  'review-summary': {
    id: 'review-summary',
    label: 'Annual Review',
    description: 'Comprehensive annual review email with all standard sections',
    target_length: '600-1500 words',
    sections: ['circumstances_update', 'goals_and_objectives', 'investment_review', 'protection', 'estate_planning', 'next_steps'],
    includeGreetingSignOff: true,
    instructions: `Write a comprehensive annual review follow-up email to send to the client after a financial planning review meeting.

WRITING STYLE:
- Plain text only (no markdown, no symbols, no asterisks, no headings with # or ##).
- Section headings should be on their own line, capitalised (e.g. YOUR CIRCUMSTANCES).
- Professional, thorough, and personalised to what was discussed.
- Write as a real UK financial adviser would write to their client.
- UK English spelling throughout.

STRUCTURE - Include ALL of the following sections. Every section MUST appear in the email:

Start with:
Dear [client name],

Following our review meeting on [meeting date], I have outlined below a summary of our discussion, your current position, and the agreed next steps.

---

YOUR CIRCUMSTANCES

Cover each of the following sub-topics. Extract specific details from the transcript for each. If a sub-topic was not discussed, write a brief neutral statement (e.g. "No changes discussed" or "Your position remains unchanged"):

Health - Any health matters discussed or confirmed.
Personal circumstances - Family, marital status, living arrangements.
Employment - Current role, any changes, employer details.
Income and expenditure - Salary, income levels, spending patterns.
Assets and liabilities - Property, savings, mortgages, debts.
Emergency fund - Cash reserves, short-term financial resilience.
Tax status - Tax band, any changes, allowances.
Capacity for loss - Ability to withstand investment losses and why.
Attitude to risk - Risk profile, comfort with volatility, investment approach.

---

YOUR GOALS AND OBJECTIVES

Extract all goals and objectives discussed. Include:
- Retirement planning (target age, income needs)
- Capital growth objectives
- Cashflow modelling results if discussed
- Any other specific goals (school fees, property, inheritance)
- Ongoing advice preferences

If a goal area was not discussed, state briefly that no changes were noted.

---

YOUR CURRENT INVESTMENTS

For each investment discussed, include:
- Investment performance and growth figures
- Asset allocation breakdown (percentages if mentioned)
- Risk profile alignment
- Any rebalancing decisions
- Legislative changes discussed (budget announcements, pension changes)
- Suitability confirmation

---

INVESTMENT KNOWLEDGE AND EXPERIENCE

Summarise the client's investment knowledge and experience level based on what was discussed:
- Experience with market volatility
- Types of investments held
- Any direct share dealing or personal investment experience

---

CAPACITY FOR LOSS

Explain why the agreed capacity for loss level is appropriate:
- Income stability
- Reliance on investment income
- Diversification
- Flexibility in timeframes

---

PROTECTION

Cover insurance and protection:
- Current protection arrangements discussed
- Any gaps identified
- Recommendations made
- If not discussed in detail, include a standard note offering to arrange a protection review with a specialist.

---

WILLS AND POWER OF ATTORNEY

Cover estate documentation:
- Whether wills and powers of attorney are in place
- When last reviewed
- If not discussed, recommend they are reviewed regularly.

---

INHERITANCE TAX PLANNING

Cover IHT if discussed:
- Current estate position
- Potential liability
- Planning strategies discussed
- If not a current priority, note this and confirm it will be monitored.

---

ACTION LIST (NEXT STEPS)

List all agreed actions as a bullet list:
- Each action should specify who is responsible
- Include any timeframes or deadlines mentioned
- Typically 4-8 actions

---

Close with:
Please let me know if you would like to discuss any of the above in more detail.

Kind regards,
[Adviser name]
[Business name]

QUALITY STANDARDS:
- Every figure, date, percentage, and name MUST come directly from the transcript
- Where a topic WAS discussed, extract ALL specific details mentioned
- Where a topic was NOT discussed, use brief neutral language - do not fabricate details
- The email should be comprehensive but factual - never invent information
- Include ALL sections listed above even if brief
- The level of detail in each section should match the depth of discussion in the transcript`
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
      name_confidence: 'none',
      ai_summary: null,
      created_at: null,
      meeting_count: 0,
      recent_meetings: []
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
        .select('client_id, clients(name, ai_summary, created_at), start_time, starttime, title')
        .eq('id', meetingId)
        .single();

      if (meeting) {
        // Client name from DB relationship
        if (meeting.clients?.name && meeting.clients.name !== 'Unknown') {
          context.client.name = meeting.clients.name;
          context.client.name_confidence = 'high';
        }

        // Client relationship context
        if (meeting.clients?.ai_summary) {
          context.client.ai_summary = meeting.clients.ai_summary;
        }
        if (meeting.clients?.created_at) {
          context.client.created_at = meeting.clients.created_at;
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

        // Fetch client's meeting history for relationship context
        if (meeting.client_id) {
          try {
            // Get total meeting count
            const { count } = await supabase
              .from('meetings')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', meeting.client_id)
              .eq('user_id', userId);

            context.client.meeting_count = count || 0;

            // Get quick summaries from last 2 meetings (excluding current)
            const { data: recentMeetings } = await supabase
              .from('meetings')
              .select('quick_summary, starttime, start_time')
              .eq('client_id', meeting.client_id)
              .eq('user_id', userId)
              .neq('id', meetingId)
              .order('starttime', { ascending: false })
              .limit(2);

            if (recentMeetings) {
              context.client.recent_meetings = recentMeetings
                .filter(m => m.quick_summary)
                .map(m => ({
                  summary: m.quick_summary,
                  date: formatMeetingDate(m.start_time || m.starttime)
                }));
            }
          } catch (histErr) {
            console.warn('Could not fetch client meeting history:', histErr.message);
          }
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

  // For auto-summary mode, sections are minimal (just next_steps)
  if (mode === 'auto-summary') {
    return {
      mode: modeConfig.id,
      label: modeConfig.label,
      target_length: modeConfig.target_length,
      instructions: modeConfig.instructions,
      includeGreetingSignOff: modeConfig.includeGreetingSignOff || false,
      section_candidates: ['next_steps']
    };
  }

  // For review mode, include ALL sections (user requires every section to appear)
  const candidates = modeConfig.sections;

  return {
    mode: modeConfig.id,
    label: modeConfig.label,
    target_length: modeConfig.target_length,
    instructions: modeConfig.instructions,
    includeGreetingSignOff: modeConfig.includeGreetingSignOff || false,
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
  const includeGreetingSignOff = sectionConfig.includeGreetingSignOff || false;

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
  const dataContext = `MEETING DETAILS:
- Date: ${context.meeting.date || 'Unknown'}${context.meeting.date_confidence !== 'high' ? ' (low confidence)' : ''}
- Client: ${context.client.name || 'Unknown'}${context.client.name_confidence !== 'high' ? ` (${context.client.name_confidence} confidence)` : ''}
- Adviser: ${context.adviser.name || 'Unknown'}${context.adviser.business ? ` from ${context.adviser.business}` : ''}
${context.meeting.title ? `- Meeting title: ${context.meeting.title}` : ''}
${confidenceNotes}`;

  // Build client relationship context (only for auto-summary mode)
  let clientContext = '';
  if (sectionConfig.mode === 'auto-summary') {
    const parts = [];

    // Client tenure
    if (context.client.created_at) {
      const created = new Date(context.client.created_at);
      const now = new Date();
      const months = Math.floor((now - created) / (1000 * 60 * 60 * 24 * 30));
      if (months < 1) {
        parts.push('- New client (first meeting or very recent)');
      } else if (months < 12) {
        parts.push(`- Client for ${months} month${months === 1 ? '' : 's'}`);
      } else {
        const years = Math.floor(months / 12);
        parts.push(`- Client for ${years} year${years === 1 ? '' : 's'}`);
      }
    }

    // Meeting count
    if (context.client.meeting_count > 1) {
      parts.push(`- ${context.client.meeting_count} meetings total`);
    }

    // Recent meeting summaries
    if (context.client.recent_meetings.length > 0) {
      parts.push('- Recent meetings:');
      for (const m of context.client.recent_meetings) {
        parts.push(`  ${m.date || 'Recent'}: "${m.summary}"`);
      }
    }

    // AI summary (rolling client overview)
    if (context.client.ai_summary) {
      parts.push(`- Overview: ${context.client.ai_summary}`);
    }

    if (parts.length > 0) {
      clientContext = `\nCLIENT CONTEXT (use naturally — reference previous conversations or ongoing work where it fits):\n${parts.join('\n')}`;
    }
  }

  // Build reminders — kept concise
  let reminders;
  if (includeGreetingSignOff) {
    reminders = `BEFORE YOU WRITE:
1. Read the transcript for tone and emotion — match it in your writing.
2. Every fact must come from the transcript — never invent.
3. Use the client name, adviser name, and meeting date from MEETING DETAILS.
4. Include greeting and sign-off with adviser name and business name.
5. No placeholders, no markdown.

Write the email now.`;
  } else {
    reminders = `BEFORE YOU WRITE:
1. Read the transcript for tone and emotion — match it in your writing.
2. Every fact must come from the transcript — never invent.
3. Use the client name, adviser name, and meeting date from MEETING DETAILS.
4. Do NOT include greeting or sign-off — those are added separately.
5. No placeholders, no markdown.

Write the email body now.`;
  }

  // Build the user message
  const userMessage = `${dataContext}
${clientContext}

${sectionConfig.instructions}
${sectionGuidance}

---

TRANSCRIPT:
${transcript}

---

${reminders}`;

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
