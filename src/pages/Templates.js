import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';
import {
  Sparkles,
  Info,
  Save,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  Bot,
  Loader2,
  Send,
  X
} from 'lucide-react';
import api from '../services/api';

// Fallback templates (only used if API fails)
const fallbackTemplates = [
  {
    id: 'auto-template',
    title: 'Advicly Summary',
    description: 'AI prompt for generating professional plain-text email summaries from meeting transcripts',
    prompt_content: `Role: You are a professional financial advisor's assistant helping {advisorName} write a follow-up email to a client after a meeting.

Goal: Generate a clear, professional, plain-text email that summarises the key discussion points and outlines next steps. This email should be ready to copy-paste and send with minimal editing.

CRITICAL FORMAT RULES:
1. NO markdown symbols whatsoever - no **, ##, *, bullets, or formatting characters
2. Use plain text only with natural paragraph breaks
3. Use numbered lists (1. 2. 3.) for action items - no bullets
4. Keep it concise - aim for 150-250 words maximum
5. Do NOT include subject lines or headers

Structure:
1. Warm opening - thank them for their time, reference the meeting naturally
2. Key points - summarise 2-4 main discussion topics in flowing paragraphs, include specific numbers/figures from the transcript
3. Next steps - list 3-5 clear action items with owners and timelines where mentioned
4. Closing - offer to help with questions, professional sign-off

Tone: Professional but warm. Write as if you're the advisor speaking directly to the client. Avoid jargon. Be specific with numbers and dates mentioned in the transcript.

Example format:

Hi {clientName},

It was great speaking with you today about your financial planning. Thank you for taking the time to discuss your goals.

We covered several important areas during our conversation. Regarding your pension, we discussed contributing 35,000 pounds from your limited company this tax year, which would provide significant tax benefits. We also reviewed your current protection arrangements and identified a gap in your life cover.

Here are the next steps we agreed:

1. I will prepare the written advice document for your pension contribution - expect this within two to three weeks
2. We will schedule a follow-up call to review the advice together
3. You will gather your latest pension statements for our records

Please let me know if you have any questions in the meantime. I look forward to our next conversation.

Best regards,
{advisorName}
{businessName}

Transcript:
{transcript}

Generate the email body only. No subject line. No markdown. Plain text only.`,
    type: 'auto-summary'
  },
  {
    id: 'review-template',
    title: 'Review',
    description: 'Professional client review email generator - extracts data from transcripts and populates structured template',
    content: `You are "Client Review Assistant", a specialised AI designed to convert meeting transcripts into fully-structured client review emails for financial planning purposes. Your role is to extract information from the transcript and produce a polished, professional email following a strict template.

INPUT:
- Client Name: {clientName}
- Transcript: {transcript}
- Advisor: {advisorName} from {businessName}

---

EMAIL TEMPLATE STRUCTURE (MUST FOLLOW EXACT ORDER WITH SECTION HEADINGS)

Generate the email with these exact sections in this order:

---

1) PERSONALISED INTRODUCTION

Start with: "Dear [Client Name],"
Then: "Following our review meeting on [date from transcript], I have outlined the main points and my recommendations below."

---

2) YOUR CIRCUMSTANCES

Start with: "We discussed the following aspects of your financial situation, and you confirmed that none have changed materially since our last review:"
(If changes were mentioned in the transcript, rewrite accordingly to reflect those changes.)

For EACH of the following bullets, you MUST expand to at least 10 words:
- Health - e.g., "You remain in good health with no new concerns that may affect future financial planning, and you reported feeling stable and well overall."
- Personal circumstances - e.g., "Your employment, home life and family structure remain unchanged, with no expected adjustments in the foreseeable future."
- Income & expenditure - e.g., "Your income continues to be strong and reliable, and you do not anticipate any additional income needs or major expenditure changes over the next five years."
- Assets & liabilities - e.g., "Your property values and mortgage balances remain broadly aligned with previous assessments, with no new debts or liabilities added to your position."
- Emergency fund - e.g., "You continue to maintain a robust level of cash reserves across several accounts, which provides strong short-term financial security and flexibility."
- Tax status - e.g., "You remain an additional-rate taxpayer, and there are no expected near-term changes to your tax position."
- Capacity for loss - State whether this is unchanged and reference previous assessment.
- Attitude to risk - e.g., "Your attitude to risk remains Medium, reflecting your preference for balanced long-term growth while remaining comfortable with market volatility."

---

3) YOUR GOALS AND OBJECTIVES

Start with: "We reviewed your financial goals, confirming that no significant changes have occurred:"
(If changes exist, update wording accordingly.)

Include:
- Retirement planning - "Your intended retirement age remains [Age]."
- Capital growth objective - Target income/capital goal if mentioned.
- If cashflow modelling was discussed, include: "Updated cashflow modelling indicates a required return of [X]% p.a., or an additional contribution of [X] p.a., assuming a [X]% growth rate." (Only include if actual figures are in transcript.)
- Ongoing financial advice preference.
- Active investment management preference.
- Any additional goals (school fees, mortgage, etc.) as bullet points.

---

4) YOUR CURRENT INVESTMENTS

For each investment plan discussed in the transcript, summarise:
- Plan type (e.g., SJP Pension, ISA, etc.)
- Plan number (if mentioned, otherwise state "Not provided")
- Value (approximate if stated)
- Regular contributions (yes/no, amounts if known)

Then provide narrative covering:
- Investment performance since last review
- Fund selection and risk profile alignment
- Rebalancing discussion and outcome
- Legislation changes discussed
- New products/services discussed
- Suitability confirmation

---

5) INVESTMENT KNOWLEDGE & EXPERIENCE

Select ONE category based on transcript content and use the EXACT wording:

If NONE: "Having discussed this with you, we agreed you have no previous investment knowledge and experience because:"
Applicable bullets:
- You have not previously held investments outside of a bank, building society cash deposits, or National Savings & Investment products.

If LIMITED: "Having discussed this with you, we agreed you have limited investment knowledge and experience because:"
Applicable bullets:
- You have purchased investments where no significant investment volatility has been experienced since acquiring them.
- You hold investments; however, you have not made any active decisions.
- Your experience is limited to small Stocks & Shares ISAs.
- You hold investments in With-Profit Funds only and therefore have not experienced volatility due to the smoothing effect of bonuses.

If MODERATE: "Having discussed this with you, we agreed you have a moderate level of investment knowledge and experience because:"
Applicable bullets:
- You have purchased investments and experienced significant investment volatility.
- You have selected your own funds within a work-based pension instead of using the default fund.
- You have received advice to take Tax-Free Cash and have designated funds into Flexi-Access Drawdown.

If EXTENSIVE: "Having discussed this with you, we agreed you have an extensive level of investment knowledge and experience because:"
Applicable bullets:
- You regularly buy and sell shares or funds.
- You have purchased alternative investments such as hedge funds or commodities.
- You have investment experience through your employment.
- You are classed as a Professional Client.
- You have purchased shares in early-stage enterprise companies not yet listed on an exchange.

---

6) CAPACITY FOR LOSS

Select ONE category based on transcript content and use the EXACT wording:

If LOW: "We agreed you have a low capacity to withstand investment losses because:"
Applicable bullets:
- You have little net disposable income.
- You have limited ability to increase net disposable income because of high essential expenditure.
- You have minimal or no secured income.
- You have limited capital available to invest.
- You are already significantly exposed to investment risk through other investments.
- You are primarily reliant on income produced by your investments.
- Your emergency cash reserves would be rapidly exhausted if required.
- A significant fall in your investment value would negatively affect your short-term financial goals.

If MODERATE: "We agreed you have a moderate capacity to withstand investment losses because:"
Applicable bullets:
- You have sufficient disposable income and the ability to save regularly.
- Your investment portfolio is well diversified and not overly exposed to market risk.
- You are not primarily reliant on investment income.
- Your financial reserves would not be quickly exhausted if needed.
- A fall in investment value would impact goals, but you have flexibility to adjust plans accordingly.

If HIGH: "We agreed you have a high capacity to withstand investment losses because:"
Applicable bullets:
- You have a substantial, secure income and strong ability to save.
- You demonstrate robust financial planning and enjoy high disposable income.
- Your financial reserves would last several years if required for essential expenditure.
- You hold a well-diversified portfolio and maintain significant additional cash resources.

---

7) MY RECOMMENDATIONS

Summarise the key recommendations discussed in the meeting:
- Current investment suitability confirmation
- Recommended actions with clear steps
- Tax efficiency improvements
- Any product recommendations (ISAs, pension contributions, etc.)

---

8) PROTECTION

Use this default wording unless the transcript contradicts it:

"Having comprehensive insurance in place is fundamental to a strong financial plan and should include not just Life insurance but Income replacement and/or Critical Illness cover. We discussed your current protection policies and you confirmed you have employer cover in place. Note that if you change employer, there is no guarantee you will receive the same or better benefits which is why it is valuable to have personal protection as this is fully portable regardless of employer. This is an area we can assist in. Please let me know whether you would like to speak to my colleague who specialises in this area who can provide you guidance on best practice, structure and cost."

If no protection was confirmed:
"You did not confirm any existing protection policies. Please confirm your current Life, Income Protection, and Critical Illness cover so we can advise properly."

If personal protection is already in place, adjust the wording accordingly.

---

9) WILLS & POWER OF ATTORNEY

Default wording:
"I recommend that you make a valid will and keep it up to date with any future changes to your personal circumstances. This will should also include a Power of Attorney to ensure that decisions can be made on your behalf if you become unable to do so."

If the client already has these in place:
"You confirmed that you have an up-to-date will and Power of Attorney in place. We recommend reviewing these periodically to ensure they continue to reflect your wishes and circumstances."

---

10) INHERITANCE TAX PLANNING

Default wording:
"Your current assets and liabilities indicate a potential inheritance tax liability. You have opted not to address this currently as you are focused on wealth accumulation, but we will continue to monitor this and discuss planning options with you at future reviews."

If they are addressing IHT:
"We reviewed your estate planning position and you are actively addressing potential inheritance tax exposure through your existing planning strategy. We will continue to review this regularly."

If they do not have IHT exposure:
"Based on your current asset levels, no inheritance tax exposure is anticipated at present. We will continue to review this as part of future planning."

---

11) CASHFLOW MODELLING REFERENCE

If cashflow modelling was discussed, briefly reference it and the conclusions reached.

---

OUTPUT RULES

1. Write in UK English, professional but warm tone
2. Use section headings exactly as shown (e.g., "Your Circumstances", "Your Goals and Objectives")
3. NO markdown formatting (no **, no #, no tables)
4. NO placeholders like [X]% or [TO CONFIRM] - if data is missing, use neutral language
5. The email must be ready to send exactly as written
6. Sign off with: "Best regards," followed by {advisorName}

Generate the complete email now.`,
    type: 'review-summary'
  }
];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState({ advisorName: '', businessName: '' });

  // New template modal state
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');

  // AI Builder state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');

  // Fetch templates and user profile on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch user profile for personalization
        try {
          const profile = await api.get('/templates/user-profile');
          setUserProfile(profile);
        } catch (err) {
          console.warn('Could not fetch user profile:', err);
        }

        // Fetch templates from API
        const fetchedTemplates = await api.get('/templates');

        if (fetchedTemplates && fetchedTemplates.length > 0) {
          setTemplates(fetchedTemplates);
          setSelectedTemplate(fetchedTemplates[0]);
          setEditedContent(fetchedTemplates[0].prompt_content || fetchedTemplates[0].content || '');
        } else {
          // Use fallback templates
          setTemplates(fallbackTemplates);
          setSelectedTemplate(fallbackTemplates[0]);
          setEditedContent(fallbackTemplates[0].prompt_content || '');
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
        // Use fallback templates
        setTemplates(fallbackTemplates);
        setSelectedTemplate(fallbackTemplates[0]);
        setEditedContent(fallbackTemplates[0].prompt_content || '');
        showNotification('Failed to load templates from server', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update edited content when selected template changes
  useEffect(() => {
    if (selectedTemplate) {
      setEditedContent(selectedTemplate.prompt_content || selectedTemplate.content || '');
    }
  }, [selectedTemplate]);

  const showNotification = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 3000);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);

      // If it's a fallback template (no real ID), we need to create it first
      if (selectedTemplate.id === 'auto-template' || selectedTemplate.id === 'review-template') {
        const newTemplate = await api.post('/templates', {
          title: selectedTemplate.title,
          description: selectedTemplate.description,
          prompt_content: editedContent,
          type: selectedTemplate.type
        });

        setTemplates(prev => prev.map(t =>
          t.id === selectedTemplate.id ? newTemplate : t
        ));
        setSelectedTemplate(newTemplate);
      } else {
        // Update existing template
        const updatedTemplate = await api.put(`/templates/${selectedTemplate.id}`, {
          title: selectedTemplate.title,
          description: selectedTemplate.description,
          prompt_content: editedContent,
          type: selectedTemplate.type
        });

        setTemplates(prev => prev.map(t =>
          t.id === selectedTemplate.id ? updatedTemplate : t
        ));
        setSelectedTemplate(updatedTemplate);
      }

      showNotification('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      showNotification('Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateTitle.trim()) {
      showNotification('Please enter a template title', 'error');
      return;
    }

    try {
      setSaving(true);

      const initialContent = generatedContent || `# ${newTemplateTitle}

Write your template prompt here. Use placeholders like:
- {clientName} - Client's name
- {advisorName} - Your name (${userProfile.advisorName})
- {businessName} - Your business (${userProfile.businessName})
- {transcript} - Meeting transcript

Best regards,
${userProfile.advisorName}
${userProfile.businessName}`;

      const newTemplate = await api.post('/templates', {
        title: newTemplateTitle,
        description: `Custom template: ${newTemplateTitle}`,
        prompt_content: initialContent,
        type: 'custom'
      });

      setTemplates(prev => [...prev, newTemplate]);
      setSelectedTemplate(newTemplate);
      setEditedContent(newTemplate.prompt_content);

      // Reset modal state
      setShowNewTemplateModal(false);
      setNewTemplateTitle('');
      setGeneratedContent('');
      setAiPrompt('');

      showNotification('Template created successfully!');
    } catch (error) {
      console.error('Error creating template:', error);
      showNotification('Failed to create template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/templates/${templateId}`);

      setTemplates(prev => prev.filter(t => t.id !== templateId));

      // Select first remaining template
      if (selectedTemplate?.id === templateId) {
        const remaining = templates.filter(t => t.id !== templateId);
        if (remaining.length > 0) {
          setSelectedTemplate(remaining[0]);
        } else {
          setSelectedTemplate(null);
        }
      }

      showNotification('Template deleted');
    } catch (error) {
      console.error('Error deleting template:', error);
      showNotification('Failed to delete template', 'error');
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      showNotification('Please describe what kind of template you want', 'error');
      return;
    }

    try {
      setAiGenerating(true);

      const result = await api.post('/templates/generate', {
        description: aiPrompt,
        templateType: 'custom'
      });

      setGeneratedContent(result.generatedContent);
      if (result.suggestedTitle && !newTemplateTitle) {
        setNewTemplateTitle(result.suggestedTitle);
      }

      showNotification('Template generated! Review and save when ready.');
    } catch (error) {
      console.error('Error generating template:', error);
      showNotification('Failed to generate template', 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const getTemplateIcon = (type) => {
    switch (type) {
      case 'auto-summary':
        return <Sparkles className="w-4 h-4 text-primary" />;
      case 'review-summary':
        return <MessageSquare className="w-4 h-4 text-primary" />;
      default:
        return <Mail className="w-4 h-4 text-primary" />;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-border/50 overflow-y-auto bg-card/30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Email Templates</h2>
            <Button
              size="sm"
              onClick={() => setShowNewTemplateModal(true)}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              New
            </Button>
          </div>

          <div className="space-y-3">
            {templates.map((template) => {
              const isSelected = template.id === selectedTemplate?.id;
              return (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer card-hover border-border/50",
                    isSelected && "ring-2 ring-primary/20 bg-primary/5 border-primary/30"
                  )}
                  onClick={() => setSelectedTemplate(template)}
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
                      {!template.is_default && template.type === 'custom' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                          className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
        {selectedTemplate ? (
          <>
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
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || editedContent === (selectedTemplate.prompt_content || selectedTemplate.content)}
                  className="flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </Button>
              </div>
              {userProfile.advisorName && (
                <p className="text-sm text-muted-foreground mt-2">
                  Templates will use: <span className="font-medium">{userProfile.advisorName}</span> from <span className="font-medium">{userProfile.businessName}</span>
                </p>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              <Card className="border-border/50 h-full">
                <CardContent className="p-6 h-full">
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-foreground mb-2">AI Prompt Template</h3>
                      <p className="text-sm text-muted-foreground">
                        Use {'{transcript}'}, {'{clientName}'}, {'{advisorName}'}, {'{businessName}'} as placeholders.
                      </p>
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full h-full min-h-[400px] p-4 bg-background text-foreground border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm leading-relaxed"
                        placeholder="Edit your AI prompt template here..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a template to edit
          </div>
        )}
      </div>

      {/* New Template Modal */}
      {showNewTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create New Template</h2>
              <button
                onClick={() => {
                  setShowNewTemplateModal(false);
                  setGeneratedContent('');
                  setAiPrompt('');
                }}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Template Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Template Title</label>
                <input
                  type="text"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Annual Review Follow-up"
                />
              </div>

              {/* AI Builder - Always Visible */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  AI Template Builder
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Describe what kind of email template you want, and AI will generate it for you.
                </p>

                <div className="mb-4">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={4}
                    placeholder="e.g., Create a template for following up after a pension review meeting. It should summarize the key recommendations, list action items, and remind the client about next steps..."
                  />
                </div>

                <Button
                  onClick={handleGenerateWithAI}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="flex items-center gap-2"
                >
                  {aiGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Generate
                </Button>

                {generatedContent && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">Generated Template (you can edit this)</label>
                    <textarea
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                      rows={10}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTemplateModal(false);
                  setGeneratedContent('');
                  setAiPrompt('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTemplate}
                disabled={saving || !newTemplateTitle.trim() || !generatedContent.trim()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

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