const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
const jsonModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-lite',
  generationConfig: { responseMimeType: 'application/json' }
});

const isGeminiAvailable = () => !!process.env.GEMINI_API_KEY;

// Keep legacy name for backwards compatibility with callers
const isOpenAIAvailable = isGeminiAvailable;

// Helper function to strip markdown formatting from text
function stripMarkdown(text) {
  if (!text) return text;

  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\n)\*([^*\n]+)\*/g, '$1')
    .replace(/(?<!\n)_([^_\n]+)_/g, '$1')
    .replace(/^\*\s+/gm, '- ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/  +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function generateMeetingSummary(content, template = 'standard', metadata = null) {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini service is not available. Please check GEMINI_API_KEY.');
    }

    let prompt = content;

    if (metadata && metadata.prompt) {
      prompt = metadata.prompt;
    }

    const systemInstruction = 'You are a professional email writer. IMPORTANT: Never use markdown formatting. No ## headers, no **bold**, no * bullets, no ` backticks. Write in plain text only with natural paragraphs and numbered lists (1. 2. 3.) where needed.';

    const result = await model.generateContent(`${systemInstruction}\n\n${prompt}`);
    const rawContent = result.response.text();
    return stripMarkdown(rawContent);
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    throw error;
  }
}

/**
 * Unified generator: returns quickSummary and actionPoints as a single JSON object.
 */
async function generateUnifiedMeetingSummary(transcriptText, options = {}) {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini service is not available. Please check GEMINI_API_KEY.');
    }

    const {
      clientName = 'Client',
      maxActionItems = 7
    } = options;

    const unifiedPrompt = `You are Advicly's meeting assistant for UK financial advisers.

You will be given a full financial advice meeting transcript.
Your job is to produce the following in ONE response, as strict JSON:

1) quickSummary: a single-sentence overview of the meeting for the advisor's internal dashboard.
2) actionPoints: an array of concrete action items extracted from the discussion.

Rules for quickSummary:
- Exactly ONE sentence.
- Maximum 150 characters.
- Professional, concise, and focused on the main topics discussed.
- Include the client's name if clearly identifiable.

Rules for actionPoints:
- Return an array of strings.
- Each string must be a specific, concrete task (e.g. "Send updated suitability report to client", "Schedule follow-up review in 6 months").
- Include 3 to ${maxActionItems} of the MOST IMPORTANT actions discussed.
- Make it clear who is responsible (adviser or client) within each action.
- Include any deadlines or timeframes mentioned.
- Do NOT include vague discussion topics or internal prep work.

Output JSON format:
{
  "quickSummary": string,
  "actionPoints": string[]
}

Transcript:
${transcriptText}

Return ONLY valid JSON, no markdown, no explanations.`;

    const result = await jsonModel.generateContent(unifiedPrompt);
    const raw = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse unified summary JSON:', err, raw);
      throw new Error('Unified summary JSON parse failed');
    }

    const quickSummary = typeof parsed.quickSummary === 'string' ? parsed.quickSummary : '';

    let actionPointsArray = Array.isArray(parsed.actionPoints) ? parsed.actionPoints : [];
    actionPointsArray = actionPointsArray
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
      .slice(0, maxActionItems);

    return { quickSummary, actionPointsArray };
  } catch (error) {
    console.error('Error generating unified meeting summary:', error);
    throw error;
  }
}

/**
 * Generate a comprehensive detailed meeting summary — the "Master Record" Source of Truth.
 * Uses Markdown formatting for professional UI rendering.
 */
async function generateDetailedMeetingSummary(transcriptText) {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini service is not available. Please check GEMINI_API_KEY.');
    }

    const detailedPrompt = `### ROLE
You are a Lead Financial Analyst. Your task is to produce a "Master Record" of the provided transcript. This is the absolute Source of Truth for the meeting.

### MISSION
Document every nuance, figure, and technical detail. This must be so comprehensive that reading the transcript becomes unnecessary. Use UK English spelling throughout.

### OUTPUT FORMAT
Generate a dense, structured, and indexed breakdown using Markdown formatting for professional display. Include ALL specific figures, dates, percentages, fund names, and details mentioned.

### REQUIRED STRUCTURE (Markdown)

# 1. STRATEGIC OVERVIEW
- **Meeting Objective:** (Clear statement of the call's purpose)
- **Attendees:** (Who was present)
- **Sentiment & Tone:** (How did the client feel? What was the energy of the call?)
- **Primary Outcome:** (The #1 takeaway from this meeting)

# 2. THEMATIC DEEP-DIVE
(Organise by topic, NOT chronologically. Provide 2-3 paragraphs of substantive depth for each topic discussed.)

### [Topic Name - e.g., Retirement Planning]
Context, details of the exchange, specific figures mentioned, and any logic or reasoning provided by the advisor or client. Include direct quotes where impactful.

(Continue for ALL topics meaningfully discussed - typical meetings cover 3-8 major topics)

# 3. QUANTITATIVE DATA VAULT
| Financial Category | Detail / Figure | Contextual Note |
| :--- | :--- | :--- |
| (e.g., Total Portfolio Value) | £XXX,XXX | (As of date, platform) |

(Include ALL numerical data mentioned: values, percentages, dates, ages, contribution amounts, fees, etc.)

# 4. OBJECTIONS & UNRESOLVED ITEMS
- Document specific hesitations, concerns, or "no" responses from the client
- Areas requiring further research or follow-up

# 5. DECISIONS MADE
- List every formal agreement, approval, or "yes" captured in the call

# 6. ACTION ITEMS
| Action | Owner | Deadline/Timeframe |
| :--- | :--- | :--- |
| (Specific task) | (Adviser/Client) | (When mentioned) |

---

### TRANSCRIPT TO ANALYSE:
${transcriptText}

---

Generate the complete Master Record now. Be exhaustive - this document should make reading the original transcript unnecessary.`;

    const result = await model.generateContent(detailedPrompt);
    const detailedSummary = result.response.text();

    console.log(`✅ Generated detailed summary (Master Record): ${detailedSummary.length} characters`);

    return detailedSummary;
  } catch (error) {
    console.error('Error generating detailed meeting summary:', error);
    throw error;
  }
}

async function adjustMeetingSummary(originalSummary, adjustmentPrompt) {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini service is not available. Please check GEMINI_API_KEY.');
    }

    const prompt = `Please adjust the following meeting summary based on this request: "${adjustmentPrompt}"\n\nOriginal summary:\n${originalSummary}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error adjusting meeting summary:', error);
    throw error;
  }
}

async function improveTemplate(template, improvementRequest) {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini service is not available. Please check GEMINI_API_KEY.');
    }

    const prompt = `Please improve the following template based on this request: "${improvementRequest}"\n\nTemplate:\n${template}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error improving template:', error);
    throw error;
  }
}

/**
 * Generate AI chat response for Ask Advicly.
 * Single Gemini call replaces the previous 2-step gpt-4o-mini + gpt-4 polish pattern.
 */
async function generateChatResponse(userMessage, systemPrompt, maxTokens = 1200, conversationHistory = []) {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini service is not available. Please check GEMINI_API_KEY.');
    }

    console.log('🤖 Generating AI response with context length:', systemPrompt.length);
    console.log('💬 User message:', userMessage.substring(0, 100) + '...');
    console.log('📜 Conversation history messages:', conversationHistory.length);

    let fullPrompt = systemPrompt + '\n\n';

    if (conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        const role = msg.role === 'assistant' ? 'Assistant' : 'User';
        fullPrompt += `${role}: ${msg.content}\n`;
      }
    } else {
      fullPrompt += `User: ${userMessage}`;
    }

    const chatModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: { maxOutputTokens: maxTokens }
    });

    const result = await chatModel.generateContent(fullPrompt);
    const aiResponse = result.response.text().trim();

    console.log('✅ Gemini response generated, length:', aiResponse.length);
    return aiResponse;
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error(`Failed to generate AI response: ${error.message}`);
  }
}

async function generateFollowUpEmail(transcript) {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini service is not available. Please check GEMINI_API_KEY.');
    }

    const prompt = `You are an assistant to a financial advisor.

Based strictly on the following client meeting transcript, generate a professional follow-up email. Do NOT make up any facts. Only include points that were clearly stated by either the advisor or the client during the meeting.

Instructions:
- Begin with a polite greeting (e.g., "Hi [Client], it was great speaking with you today.")
- Recap the exact points discussed in the meeting
- Clearly outline the agreed next steps
- Maintain a confident and helpful tone suitable for a financial advisor
- End with a friendly and professional sign-off

If a topic is not mentioned in the transcript, do NOT include it.

Transcript:
${transcript}

Respond with the email body only — no headers or subject lines.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating follow-up email:', error);
    throw error;
  }
}

module.exports = {
  generateMeetingSummary,
  generateUnifiedMeetingSummary,
  generateDetailedMeetingSummary,
  adjustMeetingSummary,
  improveTemplate,
  generateChatResponse,
  generateFollowUpEmail,
  isOpenAIAvailable,
};
