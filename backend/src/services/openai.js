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

async function generateMeetingSummary(content, template = 'standard', metadata = null) {
  try {
    if (!isOpenAIAvailable()) {
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    let prompt = content;
    let maxTokens = 1000;
    let stream = false;

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
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: stream
    });

    if (stream) {
      return response; // Return the stream directly for streaming responses
    }

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating meeting summary:', error);
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

// Generate AI chat response for Ask Advicly
async function generateChatResponse(userMessage, systemPrompt, maxTokens = 1200) {
  try {
    if (!isOpenAIAvailable()) {
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    console.log('🤖 Generating AI response with context length:', systemPrompt.length);
    console.log('💬 User message:', userMessage.substring(0, 100) + '...');

    const response = await openai.chat.completions.create({
      model: "gpt-4", // Upgraded to GPT-4 for better context understanding
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
      temperature: 0.3, // Lower temperature for more focused, accurate responses
    });

    const aiResponse = response.choices[0].message.content.trim();
    console.log('✅ AI response generated, length:', aiResponse.length);

    return aiResponse;
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error(`Failed to generate AI response: ${error.message}`);
  }
}

module.exports = {
    generateMeetingSummary,
    adjustMeetingSummary,
    improveTemplate,
    generateChatResponse,
    isOpenAIAvailable
};