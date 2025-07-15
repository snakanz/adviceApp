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
    id: 'auto-email-ai-summary',
    title: 'Auto Email Generate AI Summary',
    description: 'AI prompt for automatically generating email summaries from meeting transcripts',
    content: `You are an assistant to a financial advisor.

Based strictly on the following client meeting transcript, generate a professional follow-up email. Do **not** make up any facts. Only include points that were clearly stated by either the advisor or the client during the meeting.

Instructions:
- Begin with a polite greeting (e.g., "Hi [Client], it was great speaking with you today.")
- Recap the **exact** points discussed in the meeting (e.g., pension value, contribution levels, mortgage, expenses)
- Clearly outline the agreed next steps (e.g., sending a Letter of Authority, requesting pension statements)
- Maintain a confident and helpful tone suitable for a financial advisor
- End with a friendly and professional sign-off

⚠️ If a topic (e.g., expenses, ISA, debt) is not mentioned in the transcript, do **not** include it in the email. Do not guess or assume anything that wasn't said.

Transcript:
{transcript}

Respond with the **email body only** — no headers or subject lines.`,
    type: 'ai-summary'
  },
  {
    id: 'review-email-summary',
    title: 'Review Email Summary',
    description: 'AI prompt for generating review meeting email summaries',
    content: `You are an assistant to a financial advisor.

Based strictly on the following client meeting transcript, generate a professional review meeting follow-up email. This is for a review meeting where we discuss the client's current financial situation and progress.

Instructions:
- Begin with a warm greeting acknowledging this is a review meeting
- Summarize the key points discussed during the review (e.g., current portfolio performance, changes in circumstances, goals review)
- Highlight any progress made since the last meeting
- Outline specific action items and next steps agreed upon
- Include any recommendations or changes to the financial plan
- Maintain a professional yet personal tone
- End with a positive note about the ongoing relationship

⚠️ Only include information that was actually discussed in the transcript. Do not add assumptions or information not mentioned.

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
      return JSON.parse(saved);
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