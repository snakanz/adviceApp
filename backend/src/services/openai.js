const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateMeetingSummary(content, template = 'standard', metadata = null) {
  try {
        let prompt = content;
        
        if (metadata && metadata.prompt) {
            prompt = metadata.prompt;
        }

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
        console.error('Error generating meeting summary:', error);
    throw error;
  }
}

module.exports = {
    generateMeetingSummary
}; 