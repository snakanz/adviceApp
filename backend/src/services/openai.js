const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

        let prompt = `You are a professional meeting summariser. Your summaries are clear, concise, and well-structured. Focus on actionable items and key decisions.\n\n${templatePrompt}\n\nMeeting Content:\n${content}`;

        if (metadata) {
            prompt += `\n\nAdditional Context:\n- Duration: ${metadata.duration} minutes\n- Participants: ${metadata.participants.join(', ')}`;
        }

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating meeting summary:', error);
        throw error;
    }
}

async function adjustMeetingSummary(originalSummary, adjustmentPrompt) {
    try {
        const prompt = `You are a professional meeting summariser. Adjust the following meeting summary based on the user's request.

Original Summary:
${originalSummary}

Adjustment Request:
${adjustmentPrompt}

Provide the updated summary only, maintaining the same structure and professional tone.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error adjusting meeting summary:', error);
        throw error;
    }
}

async function improveTemplate(template, improvement) {
    try {
        const prompt = `You are a professional meeting summariser. Improve the following summary template based on the user's request.

Current Template:
${template}

Improvement Request:
${improvement}

Provide the improved template only.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error improving template:', error);
        throw error;
    }
}

async function generateFollowUpEmail(transcript) {
    try {
        const prompt = `You are an assistant to a financial advisor.

Based strictly on the following client meeting transcript, generate a professional follow-up email. Do NOT make up any facts. Only include points that were clearly stated by either the advisor or the client during the meeting.

Instructions:
- Begin with a polite greeting (e.g., "Hi [Client], it was great speaking with you today.")
- Recap the exact points discussed in the meeting (e.g., pension value, contribution levels, mortgage, expenses)
- Clearly outline the agreed next steps (e.g., sending a Letter of Authority, requesting pension statements)
- Maintain a confident and helpful tone suitable for a financial advisor
- End with a friendly and professional sign-off

If a topic is not mentioned in the transcript, do NOT include it. Do not guess or assume anything that wasn't said.

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
    adjustMeetingSummary,
    improveTemplate,
    generateFollowUpEmail,
};
