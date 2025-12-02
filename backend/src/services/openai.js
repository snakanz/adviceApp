const OpenAI = require('openai');

// Initialize OpenAI client with error handling
let openai = null;

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI client initialized successfully');
  } else {
    console.warn('⚠️  OpenAI API key not found. AI features will be disabled.');
    console.warn('   Required: OPENAI_API_KEY');
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenAI client:', error.message);
  openai = null;
}

// Helper function to check if OpenAI is available
const isOpenAIAvailable = () => {
  return openai !== null;
};

// Helper function to strip markdown formatting from text
function stripMarkdown(text) {
  if (!text) return text;

  return text
    // Remove markdown headers (## Header, ### Header, etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold **text** or __text__
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Remove italic *text* or _text_ (but not asterisks at start of lines for bullets)
    .replace(/(?<!\n)\*([^*\n]+)\*/g, '$1')
    .replace(/(?<!\n)_([^_\n]+)_/g, '$1')
    // Convert markdown bullet points (* item) to plain text (- item or just the text)
    .replace(/^\*\s+/gm, '- ')
    // Remove inline code `code`
    .replace(/`([^`]+)`/g, '$1')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Clean up any double spaces
    .replace(/  +/g, ' ')
    // Clean up multiple newlines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function generateMeetingSummary(content, template = 'standard', metadata = null) {
  try {
    if (!isOpenAIAvailable()) {
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    let prompt = content;
    let maxTokens = 1000;
    let stream = false;
    let responseFormat = null;

    if (metadata) {
      if (metadata.prompt) {
        prompt = metadata.prompt;
      }
      if (metadata.maxTokens) {
        maxTokens = metadata.maxTokens;
      }
      if (metadata.stream) {
        stream = metadata.stream;
      }
      if (metadata.response_format) {
        responseFormat = metadata.response_format;
      }
    }

    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional email writer. IMPORTANT: Never use markdown formatting. No ## headers, no **bold**, no * bullets, no ` backticks. Write in plain text only with natural paragraphs and numbered lists (1. 2. 3.) where needed."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: stream
    };

    if (responseFormat) {
      requestBody.response_format = responseFormat;
    }

    const response = await openai.chat.completions.create(requestBody);

    if (stream) {
      return response; // Return the stream directly for streaming responses
    }

    // Strip any remaining markdown from the response
    const rawContent = response.choices[0].message.content;
    return stripMarkdown(rawContent);
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    throw error;
  }
}

/**
 * Unified generator: returns quick summary, email summary, and action points array
 * in a single JSON object from ONE gpt-4o-mini call using response_format=json_object.
 */
async function generateUnifiedMeetingSummary(transcriptText, options = {}) {
  try {
    if (!isOpenAIAvailable()) {
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    const {
      clientName = 'Client',
      includeDetailedSummary = false,
      maxActionItems = 7
    } = options;

    const unifiedPrompt = `You are Advicly's meeting assistant.

You will be given a full financial advice meeting transcript.
Your job is to produce ALL of the following in ONE response, as strict JSON:

1) quickSummary: a single-sentence overview of the meeting for the advisor's internal view.
2) emailSummary: a short, plain-text follow-up email body (NO markdown symbols) suitable to send to the client.
3) actionPoints: an array of concrete action items (strings) for the advisor and/or client.
4) detailedSummary (optional): a more structured, advisor-facing summary, only if includeDetailedSummary is true.

Rules for quickSummary:
- Exactly ONE sentence.
- Maximum 150 characters.
- Professional, concise, and focused on the main outcome or purpose.

Rules for emailSummary:
- Address the client as "${clientName}" in the greeting.
- No markdown (no **, ##, *, bullet symbols, or headings).
- Maximum ~200 words.
- Professional but warm tone.
- Clearly summarise key points and next steps.
- End with a suitable sign-off (e.g. "Best regards," plus adviser name if available in transcript, otherwise keep it generic).

Rules for actionPoints:
- Return an array of strings.
- Each string must be a specific, concrete task (e.g. "Send updated suitability report", "Schedule follow-up in 6 months").
- Only include 3 to ${maxActionItems} of the MOST IMPORTANT client-facing actions.
- Do NOT include vague discussion topics or internal prep work.

Rules for detailedSummary (if requested):
- Advisor-facing summary that can include brief bullet-style structure in plain text.
- It is fine if this is slightly longer and more detailed.

Output JSON format (keys are required, values as described above):
{
  "quickSummary": string,
  "emailSummary": string,
  "actionPoints": string[],
  "detailedSummary": string
}

Transcript:
${transcriptText}

Return ONLY valid JSON, no markdown, no explanations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: unifiedPrompt
        }
      ],
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    const raw = response.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse unified summary JSON:', err, raw);
      throw new Error('Unified summary JSON parse failed');
    }

    // Ensure required fields exist with sane fallbacks
    const quickSummary = typeof parsed.quickSummary === 'string' ? parsed.quickSummary : '';
    const emailSummary = typeof parsed.emailSummary === 'string' ? parsed.emailSummary : '';
    const detailedSummary = typeof parsed.detailedSummary === 'string' ? parsed.detailedSummary : emailSummary;

    let actionPointsArray = Array.isArray(parsed.actionPoints) ? parsed.actionPoints : [];
    actionPointsArray = actionPointsArray
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
      .slice(0, maxActionItems);

    return {
      quickSummary,
      emailSummary,
      detailedSummary,
      actionPointsArray
    };
  } catch (error) {
    console.error('Error generating unified meeting summary:', error);
    throw error;
  }
}

async function adjustMeetingSummary(originalSummary, adjustmentPrompt) {
  try {
    if (!isOpenAIAvailable()) {
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    const prompt = `Please adjust the following meeting summary based on this request: "${adjustmentPrompt}"\n\nOriginal summary:\n${originalSummary}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error adjusting meeting summary:', error);
    throw error;
  }
}

async function improveTemplate(template, improvementRequest) {
  try {
    if (!isOpenAIAvailable()) {
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    const prompt = `Please improve the following template based on this request: "${improvementRequest}"\n\nTemplate:\n${template}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error improving template:', error);
    throw error;
  }
}

// Generate AI chat response for Ask Advicly using cheap model + GPT-4 polish
async function generateChatResponse(userMessage, systemPrompt, maxTokens = 1200) {
  try {
    if (!isOpenAIAvailable()) {
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    console.log('🤖 Generating AI response with context length:', systemPrompt.length);
    console.log('💬 User message:', userMessage.substring(0, 100) + '...');

    // Step 1: use gpt-4o-mini for main reasoning over the rich context
    const baseResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3, // focused, accurate responses
    });

    let aiResponse = (baseResponse.choices[0]?.message?.content || '').trim();
    console.log('✅ Base AI response generated, length:', aiResponse.length);

    // Step 2: lightly polish wording with GPT-4 for better readability
    try {
      const polishPrompt = `You are Advicly's writing assistant. Improve the clarity, structure, and professionalism of the following advisor-facing answer without changing any of the factual content or recommendations. Keep the response in plain text (no markdown) and similar length.\n\nOriginal answer:\n${aiResponse}`;

      const polishResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: polishPrompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
      });

      const polished = (polishResponse.choices[0]?.message?.content || '').trim();
      if (polished) {
        console.log('✨ Applied GPT-4 polish, length:', polished.length);
        aiResponse = polished;
      } else {
        console.warn('⚠️ GPT-4 polish returned empty content, keeping base response');
      }
    } catch (polishError) {
      console.warn('⚠️ GPT-4 polish failed for Ask Advicly response, using base response:', polishError.message);
    }

    return aiResponse;
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error(`Failed to generate AI response: ${error.message}`);
  }
}

module.exports = {
  generateMeetingSummary,
  generateUnifiedMeetingSummary,
  adjustMeetingSummary,
  improveTemplate,
  generateChatResponse,
  isOpenAIAvailable
};