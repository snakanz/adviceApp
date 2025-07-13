import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';
import { 
  Sparkles, 
  Info, 
  Plus, 
  Save
} from 'lucide-react';

const defaultTemplates = [
  {
    id: 'intro',
    title: 'Intro Meeting',
    content: `Dear [Client Name],\n\nThank you for meeting with me today. Here's a summary of our discussion and next steps.\n\nKey Points:\n- Your current financial situation\n- Your goals and priorities\n- Next steps for our engagement\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'cashflow',
    title: 'Cashflow Meeting',
    content: `Dear [Client Name],\n\nThank you for our recent meeting to review your cashflow.\n\nKey Points:\n- Income and expenses overview\n- Budgeting and savings opportunities\n- Action items for next steps\n\nLet me know if you need clarification on any points.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'performance',
    title: 'Performance Meeting',
    content: `Dear [Client Name],\n\nThank you for meeting to review your portfolio performance.\n\nKey Points:\n- Portfolio returns and allocation\n- Market commentary\n- Recommendations and next steps\n\nPlease reach out if you have any questions.\n\nBest regards,\n[Your Name]`,
  },
  {
    id: 'signup',
    title: 'Signup Meeting',
    content: `Dear [Client Name],\n\nCongratulations on taking the next step! Here's a summary of your signup meeting.\n\nKey Points:\n- Services agreed upon\n- Documentation required\n- Next steps for onboarding\n\nWe look forward to working with you.\n\nBest regards,\n[Your Name]`,
  },
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

const allowedTemplateTitles = ['Advicly AI Auto', 'Review Meeting'];

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

  // Filter templates to only allowed titles
  const filteredTemplates = templates.filter(t => allowedTemplateTitles.includes(t.title));

  const handleContentChange = (newContent) => {
    setEditedContent(newContent);
    const updatedTemplates = templates.map(t => 
      t.id === selectedTemplate.id 
        ? { ...t, content: newContent }
        : t
    );
    setTemplates(updatedTemplates);
    setSelectedTemplate(prev => ({ ...prev, content: newContent }));
  };

  const handleSave = () => {
    const updatedTemplates = templates.map(t => 
      t.id === selectedTemplate.id 
        ? { ...t, content: editedContent }
        : t
    );
    setTemplates(updatedTemplates);
    setShowSnackbar(true);
    setSnackbarMessage('Template saved!');
    setSnackbarSeverity('success');
  };

  const handleAddTemplate = () => {
    const newTemplate = {
      id: `custom_${Date.now()}`,
      title: 'New Template',
      content: 'Edit your prompt here...'
    };
    setTemplates([newTemplate, ...templates]);
    setSelectedTemplate(newTemplate);
    setEditedContent(newTemplate.content);
  };

  return (
    <div className="h-full flex bg-background">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-border/50 overflow-y-auto bg-card/30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Templates</h2>
            <Button
              onClick={handleAddTemplate}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New
            </Button>
          </div>
          
          <div className="space-y-3">
            {filteredTemplates.map((template) => {
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
                    setEditedContent(template.content);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">
                          {template.title}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          AI prompt template
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {selectedTemplate.title}
            </h1>
            <div className="group relative">
              <Info className="w-5 h-5 text-muted-foreground cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-card border border-border rounded-lg shadow-large text-sm text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                This is the AI prompt that controls how your email summaries are generated for this meeting type.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-card"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <Card className="border-border/50 h-full">
            <CardContent className="p-6 h-full">
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <textarea
                    value={editedContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="w-full h-full min-h-[400px] p-4 bg-background text-foreground border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-sans text-base leading-relaxed"
                    placeholder="Edit your prompt here..."
                  />
                </div>
                <div className="flex justify-end mt-4">
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