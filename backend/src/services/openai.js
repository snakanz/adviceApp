const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const TEMPLATES = {
    standard: `Please provide a concise summary of this meeting that includes:
1. Key Points
2. Action Items
3. Decisions Made
4. Next Steps`,
    
    financial: `Please provide a financial-focused summary of this meeting that includes:
1. Financial Metrics Discussed
2. Budget Decisions
3. Financial Risks and Opportunities
4. Action Items
5. Next Steps`,
    
    technical: `Please provide a technical summary of this meeting that includes:
1. Technical Decisions Made
2. Architecture Changes
3. Technical Debt Items
4. Action Items
5. Next Steps`,
    
    client: `Please provide a client-focused summary of this meeting that includes:
1. Client Requirements
2. Project Timeline Updates
3. Key Decisions
4. Action Items
5. Next Steps`
};

async function generateMeetingSummary(content, template = 'standard', metadata = null) {
  try {
        const templatePrompt = TEMPLATES[template] || TEMPLATES.standard;
        
        let prompt = `${templatePrompt}\n\nMeeting Content:\n${content}`;
        
        if (metadata) {
            prompt += `\n\nAdditional Context:\n- Duration: ${metadata.duration} minutes\n- Participants: ${metadata.participants.join(', ')}`;
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4",
        messages: [
          {
                    role: "system",
                    content: "You are a professional meeting summarizer. Your summaries are clear, concise, and well-structured. Focus on actionable items and key decisions."
          },
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