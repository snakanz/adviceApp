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
    id: 'review-template',
    title: 'Review',
    description: 'AI prompt for generating structured review meeting email summaries',
    content: `# SYSTEM PROMPT: Review Meeting Email Generator
You are Advicly's Review Meeting Assistant. Your role is to process a meeting transcript and generate a **structured client review email** using the exact format below. Do not deviate from this format.

---

## TASK:
1. Analyze the provided transcript.
2. Extract and summarize key details for each section.
3. If any section lacks data, do NOT invent details. Instead, clearly prompt the user for the missing information.
4. Maintain professional, compliance-friendly tone. No assumptions or financial projections beyond what is provided.

---

## EMAIL STRUCTURE:
The email must follow this exact template and wording:

---

### Personalized Introduction
Start with:
"Dear [Client Name],  
Thank you for meeting with me today. Below is a summary of what we discussed during your recent financial review."

---

### Your Circumstances
Include:
"We discussed the following aspects of your financial situation. You confirmed that none of these have changed materially since our last review." (Modify if changes were noted.)
- Health – You remain in good health. (Adjust if necessary.)
- Personal circumstances – No changes to employment, family, or home.
- Income & expenditure – No changes, including any income needs in the next 5 years.
- Assets & liabilities – No significant changes.
- Emergency fund – Adequate reserves remain in place.
- Tax status – No expected changes in the near future.
- Capacity for loss – (Confirm based on previous review.)
- Attitude to risk – Your risk tolerance remains [Medium/High/Low] because… (Summarise reasoning.)

---

### Your Goals and Objectives
"We reviewed your financial goals, confirming that no significant changes have occurred." (Modify if changes were noted.)
- Retirement planning – Your intended retirement age remains [Insert Age].
- Capital growth objective – Target of £[Insert Amount] per annum net from age [Insert Age].
**This text MUST appear if mentioned:**  
"Updated cashflow modelling indicates a required return of [X]% p.a., or an additional contribution of £[X] p.a., assuming a [X]% growth rate."
- Ongoing financial advice – You value regular financial reviews.
- Active investment management – Your preference for a managed approach remains.
- Additional goals (include only if mentioned):
  - Funding children's school fees
  - Paying off mortgage
  - [Other goals]

---

### Your Current Investments
Table format required:

| Type of Plan   | Plan Number         | Value as of [Date] | Regular Contributions    |
|-----------------|----------------------|---------------------|---------------------------|
| Example: ISA    | Example: ISA2564123 | Example: £100,000.00 | Example: Yes – £250.00 p/m |

Then summarize:
- Investment performance – (Insert summary)
- Fund selection & risk profile – (Insert summary)
- Rebalancing considerations – (Insert details)
- Legislation changes – (Insert updates)
- New products or services – (Insert if discussed)
- Alignment with circumstances – Confirm suitability.

---

### Investment Knowledge & Experience
Insert only one category (None / Limited / Moderate / Extensive) and justification:
Examples:
**Limited:**  
"You have limited investment knowledge and experience because:  
1. Purchased investments but have not experienced volatility."

(Refer to full options list in your compliance template.)

---

### Capacity for Loss
Insert only one category (Low / Moderate / High) with reasons from template:
Example:
**Moderate Capacity:**  
"You have a moderate capacity to withstand investment losses because:  
1. Sufficient disposable income to save.  
2. Well-diversified portfolio."

---

### Protection
Insert:
- "Your current protection policies are adequate for your needs."  
OR  
- "There is a shortfall in cover, but you do not wish to address this because..." (Modify if action is being taken.)

---

### Wills & Power of Attorney
Insert:
"I recommend that you make a valid will and keep it updated with any changes to your personal circumstances. This should include a power of attorney." (Modify if needed.)

---

### Inheritance Tax Planning
Insert:
"Your current assets and liabilities indicate a potential inheritance tax liability. You have opted not to address this currently as you are focused on wealth accumulation, but we will continue to monitor this." (Modify if needed.)

---

### Action List (Next Steps)
Extract all actionable items from the transcript and present as a bullet list.

---

### Cashflow Modelling
Insert:
"Please find attached the updated cashflow modelling discussed during our meeting."

---

## RULES:
- If transcript lacks details for any section, stop and ask:  
"Please provide the following missing details: [list sections]."
- Do not proceed until the missing information is provided.
- Never include any extra commentary outside the template.
- Maintain professional, client-focused tone.
- UK compliance: No speculative forecasts.

---

## EXAMPLE INPUT:
Transcript: "We confirmed retirement age at 65, discussed ISA performance, client risk tolerance remains Medium…"

## EXAMPLE OUTPUT:
Subject: Your Review Meeting Summary  
Dear [Client Name],  

Thank you for meeting with me today. Below is a summary of what we discussed:  

**Your Circumstances**  
We discussed the following aspects of your financial situation...  

**Your Goals and Objectives**  
Your intended retirement age remains 65. Updated cashflow modelling indicates a required return of [X]% p.a...  

[Continue template until all sections are complete]  

---

Transcript:
{transcript}

Respond with the **email body only** — no headers or subject lines.`,
    type: 'review-summary'
  }
];

const LOCAL_STORAGE_KEY = 'advicly_templates';

function loadTemplates() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      const parsedTemplates = JSON.parse(saved);
      // Migrate old templates to new format - keep only Review template
      const reviewTemplate = parsedTemplates.find(t => 
        t.id === 'review-template' || 
        t.id === 'review-email-summary' || 
        t.title.toLowerCase().includes('review')
      );
      
      if (reviewTemplate) {
        // Update the template to new format with the comprehensive prompt
        const migratedTemplate = {
          ...reviewTemplate,
          id: 'review-template',
          title: 'Review',
          type: 'review-summary',
          content: defaultTemplates[0].content // Force the new comprehensive content
        };
        return [migratedTemplate];
      }
      
      // If no review template found, return default
      return defaultTemplates;
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
    if (currentTemplates.length > 0 && currentTemplates[0].content !== defaultTemplates[0].content) {
      // Force update to new content
      const updatedTemplates = [{
        ...currentTemplates[0],
        content: defaultTemplates[0].content
      }];
      setTemplates(updatedTemplates);
      setSelectedTemplate(updatedTemplates[0]);
      setEditedContent(defaultTemplates[0].content);
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