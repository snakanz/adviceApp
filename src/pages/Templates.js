import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';
import { 
  Sparkles, 
  Info, 
  Save,
  Mail,
  MessageSquare
} from 'lucide-react';

const defaultTemplates = [
  {
    id: 'auto-template',
    title: 'Advicly Summary',
    description: 'AI prompt for generating professional auto email summaries from meeting transcripts',
    content: `Role: You are a professional, helpful, and concise financial advisor's assistant (Nelson Greenwood) tasked with creating a follow-up email summary for a client based on a meeting transcript.

Goal: Generate a clear, well-structured email that summarizes the key financial advice, confirms the numerical details, and outlines the immediate and future next steps.

Constraints & Format:
1. Opening: Start with a warm, conversational opening that confirms the pleasure of the meeting and sets the context.
2. Sections: Use bolded headings for clarity (e.g., Pension Recommendation, Next Steps).
3. Data Accuracy: Extract and use the exact numerical figures from the transcript.
4. Tone: Professional, clear, and reassuring.
5. Output: Provide only the final email text (do not include introductory/explanatory comments).

Example Output Format:

Subject: Follow-up: Summary of our [Topic] Advice & Next Steps

Hi {clientName},

It was great speaking with you this morning and catching up on your weekend. Below are the key points we discussed regarding [main topic].

## Key Discussion Points

**1. [Main Topic]**
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]

**2. [Secondary Topic]**
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]

**3. [Additional Topic if applicable]**
* [Key point with specific numbers/details]

## Next Steps
1. **[Action Item 1]:** [Description with timeline]
2. **[Action Item 2]:** [Description with timeline]
3. **[Action Item 3]:** [Description with timeline]
4. **[Action Item 4]:** [Description with timeline]
5. **[Action Item 5]:** [Description with timeline]

Please review the documents once they arrive. If you have any immediate questions in the meantime, please don't hesitate to let me know.

Best regards,
Nelson Greenwood
Financial Advisor

Transcript:
{transcript}

Respond with the **email body only** — no headers or subject lines.`,
    type: 'auto-summary'
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

If important information is missing from BOTH the transcript and reviewData (for example, an exact retirement age or plan number), then:
- Do NOT invent numbers or facts.
- Instead, use neutral wording such as "This will be confirmed separately" or "We will discuss this in more detail at our next review", so the email still reads complete and professional.

---

EMAIL STRUCTURE (PLAIN TEXT ONLY)

Follow this structure in free-flowing paragraphs and simple lists where helpful. Do NOT include headings or markdown symbols in the final output.

1) Greeting and Introduction
- Address the client by name if available in reviewData.client_name; otherwise use a neutral greeting like "Dear Client".
- Thank them for their time and explain that this is a summary of their recent review meeting.

2) Your Circumstances
Based primarily on reviewData and supported by the transcript, briefly describe:
- Health status
- Personal circumstances (employment, family, home situation)
- Income and expenditure (including any expected changes or short-term income needs)
- Assets and liabilities (only at a high level, no unnecessary detail)
- Emergency fund position
- Tax status (high-level, e.g. basic rate taxpayer, higher rate, etc., if known)
- Capacity for loss
- Attitude to risk

Keep the tone factual and reassuring. If some of these points are not clearly covered in either the transcript or reviewData, omit them or describe them in neutral terms without inventing specifics.

3) Your Goals and Objectives
Summarise the client’s main goals, using reviewData where available:
- Retirement timing and lifestyle goals (e.g. desired retirement age, income targets in retirement)
- Capital growth or income objectives
- Any other specific goals mentioned (e.g. paying off mortgage, helping children, estate planning, etc.)

If cashflow modelling has been discussed and captured in reviewData (for example, required rate of return or additional contributions), explain this in clear, client-friendly language without including raw placeholder-style figures. Where exact figures are available in reviewData, you may include them. Where they are not, explain the conclusion in words (for example, that the current plan appears on track, or that additional saving may be required).

4) Your Current Investments
Provide a concise narrative summary of the client’s existing plans based on reviewData.current_investments and/or the transcript, such as:
- Types of plans held (e.g. pensions, ISAs, general investment accounts)
- Overall value range (if known) and any regular contributions
- How the current investments align with the agreed risk profile and objectives
- Any notable changes since the last review (e.g. fund switches, top-ups, transfers)

Do NOT use a markdown table. Instead, describe holdings in sentences or a simple bullet-style list if that reads more clearly.

5) Investment Knowledge & Experience, Capacity for Loss, and Risk Profile
Using reviewData.investment_knowledge_level, reviewData.capacity_for_loss and reviewData.attitude_to_risk (plus the transcript where helpful), clearly state:
- The client’s level of investment knowledge and experience, with a short justification.
- Their capacity for loss (low / moderate / high) with reasons.
- Their agreed attitude to risk (e.g. cautious, balanced, adventurous) and how the current portfolio aligns with this.

If any of these fields are missing in reviewData and not clearly stated in the transcript, describe them in neutral language (for example, "your current portfolio is invested in a way that aims to balance growth with an appropriate level of risk for your circumstances").

6) Protection, Wills and Power of Attorney, and Estate Planning
If reviewData.protection_notes, reviewData.estate_planning_notes or related information is available, summarise:
- The client’s current protection position (e.g. life cover, critical illness, income protection) and whether it appears adequate.
- Any discussion around wills, powers of attorney, and inheritance tax planning.

If these topics were not discussed or are unclear, either omit them or write one short paragraph noting that this will be reviewed in future meetings, without inventing specific recommendations.

7) Agreed Actions and Next Steps
Based on reviewData.follow_up_actions (if provided) and the transcript, list the concrete next steps that were agreed. Present them as a short, numbered or bulleted list in plain text. For each action, mention:
- What will be done
- Who is responsible (you, the client, or a third party)
- Any relevant timescales if they are clearly known

If there are no clear follow-up actions, include a single line noting that no immediate changes are required but that the plan will continue to be reviewed regularly.

8) Cashflow Modelling and Ongoing Reviews
If cashflow modelling was discussed (and this is reflected in reviewData or the transcript), briefly explain:
- The purpose of the modelling (e.g. to assess whether retirement goals remain achievable)
- The high-level conclusion (on track / may need further contributions / further review required)

Then confirm that you will continue to review their position regularly, and, if reviewData.next_review_timing is available, refer to the expected timing of the next review.

9) Closing
End with a professional closing paragraph that:
- Invites the client to ask questions or request clarification at any time.
- Reassures them that you will keep their plan under regular review.
- Signs off with your name and role if this is evident in the transcript; otherwise use a generic professional sign-off such as "Best regards" followed by your name.

---

OUTPUT FORMAT

Your entire response must be a SINGLE, continuous plain text email body, with normal paragraph breaks and simple numbered or bulleted lists where appropriate.

Do NOT include:
- Any headings or markdown syntax (no #, no **, no tables).
- Any meta-commentary about what you are doing.
- Any placeholders or instructions to the adviser.

The email you output must be ready to send to the client exactly as written.
`,
    type: 'review-summary'
  }
];

const LOCAL_STORAGE_KEY = 'advicly_templates';

function loadTemplates() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      const parsedTemplates = JSON.parse(saved);
      
      // Check if we have both templates
      const hasAutoTemplate = parsedTemplates.some(t => 
        t.id === 'auto-template' || 
        t.title === 'Advicly Summary'
      );
      const hasReviewTemplate = parsedTemplates.some(t => 
        t.id === 'review-template' || 
        t.id === 'review-email-summary' || 
        t.title.toLowerCase().includes('review')
      );
      
      const templates = [];
      
      // Add Auto template
      if (hasAutoTemplate) {
        const autoTemplate = parsedTemplates.find(t => 
          t.id === 'auto-template' || 
          t.title === 'Advicly Summary'
        );
        templates.push({
          ...autoTemplate,
          id: 'auto-template',
          title: 'Advicly Summary',
          type: 'auto-summary',
          content: defaultTemplates[0].content // Force the new comprehensive content
        });
      } else {
        templates.push(defaultTemplates[0]);
      }
      
      // Add Review template
      if (hasReviewTemplate) {
        const reviewTemplate = parsedTemplates.find(t => 
          t.id === 'review-template' || 
          t.id === 'review-email-summary' || 
          t.title.toLowerCase().includes('review')
        );
        templates.push({
          ...reviewTemplate,
          id: 'review-template',
          title: 'Review',
          type: 'review-summary',
          content: defaultTemplates[1].content // Force the new comprehensive content
        });
      } else {
        templates.push(defaultTemplates[1]);
      }
      
      return templates;
    } catch {
      return defaultTemplates;
    }
  }
  return defaultTemplates;
}

function saveTemplates(templates) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
}

export default function Templates() {
  const [templates, setTemplates] = useState(loadTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [editedContent, setEditedContent] = useState(selectedTemplate.content);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // Force update to new template content on component mount
  useEffect(() => {
    const currentTemplates = loadTemplates();
    let needsUpdate = false;
    
    // Check if any templates need updating
    const updatedTemplates = currentTemplates.map((template, index) => {
      const defaultTemplate = defaultTemplates[index];
      if (template.content !== defaultTemplate.content) {
        needsUpdate = true;
        return {
          ...template,
          content: defaultTemplate.content
        };
      }
      return template;
    });
    
    if (needsUpdate) {
      setTemplates(updatedTemplates);
      setSelectedTemplate(updatedTemplates[0]);
      setEditedContent(updatedTemplates[0].content);
      saveTemplates(updatedTemplates);
    }
  }, []);

  // Save templates to localStorage whenever they change
  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  // Update edited content when selected template changes
  useEffect(() => {
    setEditedContent(selectedTemplate.content);
  }, [selectedTemplate]);

  const handleContentChange = (newContent) => {
    setEditedContent(newContent);
  };

  const handleSave = () => {
    const updatedTemplates = templates.map(t => 
      t.id === selectedTemplate.id 
        ? { ...t, content: editedContent }
        : t
    );
    setTemplates(updatedTemplates);
    setSelectedTemplate(prev => ({ ...prev, content: editedContent }));
    setShowSnackbar(true);
    setSnackbarMessage('Template saved successfully!');
    setSnackbarSeverity('success');
    
    // Auto-hide snackbar after 3 seconds
    setTimeout(() => setShowSnackbar(false), 3000);
  };

  const getTemplateIcon = (type) => {
    switch (type) {
      case 'ai-summary':
        return <Sparkles className="w-4 h-4 text-primary" />;
      case 'review-summary':
        return <MessageSquare className="w-4 h-4 text-primary" />;
      default:
        return <Mail className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="h-full flex bg-background">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-border/50 overflow-y-auto bg-card/30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Email Templates</h2>
          </div>
          
          <div className="space-y-3">
            {templates.map((template) => {
              const isSelected = template.id === selectedTemplate.id;
              return (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer card-hover border-border/50",
                    isSelected && "ring-2 ring-primary/20 bg-primary/5 border-primary/30"
                  )}
                  onClick={() => {
                    setSelectedTemplate(template);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {getTemplateIcon(template.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">
                          {template.title}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {template.description}
                        </p>
                      </div>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border/50 p-6 bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {selectedTemplate.title}
              </h1>
              <div className="group relative">
                <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-card border border-border rounded-lg shadow-large text-sm text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {selectedTemplate.description}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-card"></div>
                </div>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={editedContent === selectedTemplate.content}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <Card className="border-border/50 h-full">
            <CardContent className="p-6 h-full">
              <div className="flex flex-col h-full">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2">AI Prompt Template</h3>
                  <p className="text-sm text-muted-foreground">
                    This prompt controls how AI generates email summaries. Use {'{transcript}'} as a placeholder for the meeting transcript.
                  </p>
                </div>
                <div className="flex-1">
                  <textarea
                    value={editedContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="w-full h-full min-h-[400px] p-4 bg-background text-foreground border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm leading-relaxed"
                    placeholder="Edit your AI prompt template here..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Snackbar */}
      {showSnackbar && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div className={cn(
            "px-4 py-3 rounded-lg shadow-large text-white",
            snackbarSeverity === 'success' && "bg-primary",
            snackbarSeverity === 'error' && "bg-destructive",
            snackbarSeverity === 'warning' && "bg-yellow-600"
          )}>
            {snackbarMessage}
          </div>
        </div>
      )}
    </div>
  );
} 