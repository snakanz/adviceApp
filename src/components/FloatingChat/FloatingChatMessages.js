import React, { useEffect, useRef } from 'react';
import { Sparkles, User, CheckCircle2, Circle, Mail, Target, AlertTriangle, ClipboardList } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { useFloatingChat } from './FloatingChatContext';
import { cn } from '../../lib/utils';

// Context-aware prompt suggestions
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

export default function FloatingChatMessages() {
  const {
    messages,
    sendingMessage,
    streamingResponse,
    gatheringStages,
    pageContext,
    sendMessage
  } = useFloatingChat();

  const feedRef = useRef(null);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, streamingResponse, gatheringStages]);

  const prompts = pageContext.type === 'meeting' ? MEETING_PROMPTS
    : pageContext.type === 'client' ? CLIENT_PROMPTS
    : GENERAL_PROMPTS;

  const isGathering = gatheringStages.length > 0;
  const hasActiveStage = gatheringStages.some(s => s.status === 'loading' || s.status === 'done');

  return (
    <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Empty state with prompt suggestions */}
      {messages.length === 0 && !sendingMessage && (
        <div className="space-y-4 pt-4">
          <div className="flex gap-3">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Sparkles className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="px-3 py-2">
              <p className="text-sm text-foreground">
                {pageContext.type === 'meeting' && pageContext.clientName
                  ? `How can I help with this meeting with ${pageContext.clientName}?`
                  : pageContext.type === 'client' && pageContext.clientName
                  ? `How can I help with ${pageContext.clientName}?`
                  : 'How can I help you today?'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pl-11">
            {prompts.map((prompt, idx) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={idx}
                  onClick={() => sendMessage(prompt.text)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-muted/30 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn("w-4 h-4 flex-shrink-0", prompt.color)} />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {prompt.text}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-2.5",
            message.role === 'user' ? 'justify-end' : 'justify-start'
          )}
        >
          {message.role === 'assistant' && (
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Sparkles className="w-3.5 h-3.5" />
              </AvatarFallback>
            </Avatar>
          )}

          <div
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2",
              message.role === 'user'
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          </div>

          {message.role === 'user' && (
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarFallback className="bg-muted">
                <User className="w-3.5 h-3.5" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}

      {/* Gathering stages + streaming response */}
      {sendingMessage && (
        <div className="flex gap-2.5 justify-start">
          <Avatar className="w-7 h-7 flex-shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Sparkles className="w-3.5 h-3.5" />
            </AvatarFallback>
          </Avatar>

          <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-foreground">
            {/* Gathering visualisation */}
            {isGathering && !streamingResponse && (
              <div className="space-y-1.5 py-1">
                {gatheringStages.map((stage) => (
                  <div key={stage.id} className="flex items-center gap-2 text-xs">
                    {stage.status === 'done' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : stage.status === 'loading' ? (
                      <div className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span className={cn(
                      "transition-colors",
                      stage.status === 'done' ? 'text-muted-foreground' :
                      stage.status === 'loading' ? 'text-foreground' :
                      'text-muted-foreground/40'
                    )}>
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Streaming response text */}
            {streamingResponse && (
              <div className="text-sm whitespace-pre-wrap">{streamingResponse}</div>
            )}

            {/* Fallback: bouncing dots if no stages active yet */}
            {!hasActiveStage && !streamingResponse && (
              <div className="flex items-center gap-1 py-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
