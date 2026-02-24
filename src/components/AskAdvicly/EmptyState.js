import React from 'react';
import { Sparkles, Mail, Target, AlertTriangle, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/utils';

const MEETING_PROMPTS = [
  { icon: Mail, text: "Draft a follow-up email", color: "text-blue-500" },
  { icon: Target, text: "What are their key financial goals?", color: "text-green-500" },
  { icon: AlertTriangle, text: "What were their main concerns?", color: "text-orange-500" },
  { icon: ClipboardList, text: "List the action items", color: "text-purple-500" }
];

const CLIENT_PROMPTS = [
  { icon: Target, text: "What's the latest with this client?", color: "text-green-500" },
  { icon: ClipboardList, text: "What's outstanding before they sign?", color: "text-purple-500" },
  { icon: Mail, text: "Draft a check-in email", color: "text-blue-500" },
  { icon: AlertTriangle, text: "What risks should I be aware of?", color: "text-orange-500" }
];

const GENERAL_PROMPTS = [
  { icon: Target, text: "Which clients need follow-up?", color: "text-green-500" },
  { icon: ClipboardList, text: "Show outstanding action items", color: "text-purple-500" },
  { icon: Mail, text: "How many meetings this month?", color: "text-blue-500" },
  { icon: AlertTriangle, text: "Any clients at risk?", color: "text-orange-500" }
];

export default function EmptyState({ contextType, clientName, onSuggestionClick }) {
  const prompts = contextType === 'meeting' ? MEETING_PROMPTS
    : contextType === 'client' ? CLIENT_PROMPTS
    : GENERAL_PROMPTS;

  const greeting = contextType === 'meeting' && clientName
    ? `How can I help with this meeting with ${clientName}?`
    : contextType === 'client' && clientName
    ? `How can I help with ${clientName}?`
    : 'How can I help you today?';

  const subtitle = contextType === 'meeting'
    ? 'Ask about decisions, action items, or draft follow-ups'
    : contextType === 'client'
    ? 'Ask about meetings, goals, or next steps'
    : 'Ask about your clients, meetings, or get financial advice';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-2 text-center">
        {greeting}
      </h2>
      <p className="text-muted-foreground mb-8 text-center max-w-md">
        {subtitle}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
        {prompts.map((prompt, idx) => {
          const Icon = prompt.icon;
          return (
            <button
              key={idx}
              onClick={() => onSuggestionClick(prompt.text)}
              className="group p-4 rounded-xl border border-border/30 hover:border-primary/30 hover:bg-primary/5 text-left transition-all"
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", prompt.color)} />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {prompt.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
