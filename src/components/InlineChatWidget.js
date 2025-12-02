import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '../lib/utils';
import {
  User,
  Send,
  Sparkles,
  Mail,
  Target,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import { api } from '../services/api';

// Meeting-specific prompt suggestions
const MEETING_PROMPTS = [
  { icon: Mail, text: "Draft a concise follow up email", color: "text-blue-500" },
  { icon: Target, text: "What are their key financial goals?", color: "text-green-500" },
  { icon: AlertTriangle, text: "What were their main risks or concerns?", color: "text-orange-500" },
  { icon: ClipboardList, text: "List the action items I need to take", color: "text-purple-500" }
];

// Client-specific prompt suggestions
const CLIENT_PROMPTS = [
  { icon: Target, text: "What are this client's main goals?", color: "text-green-500" },
  { icon: ClipboardList, text: "What's outstanding before they sign?", color: "text-purple-500" },
  { icon: Mail, text: "Draft a check-in email for this client", color: "text-blue-500" },
  { icon: AlertTriangle, text: "What risks should I be aware of?", color: "text-orange-500" }
];

export default function InlineChatWidget({
  contextType = 'meeting',
  contextData = {},
  clientId,
  clientName,
  meetingId,
  meetingTitle,
  className = ""
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const feedRef = useRef(null);
  const inputRef = useRef(null);

  const prompts = contextType === 'client' ? CLIENT_PROMPTS : MEETING_PROMPTS;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset state when context changes
  useEffect(() => {
    setMessages([]);
    setThreadId(null);
    setInput('');
  }, [meetingId, clientId]);

  const createThread = useCallback(async () => {
    try {
      let title = 'Quick Chat';
      if (contextType === 'meeting' && meetingTitle) {
        title = `${clientName || 'Client'} - ${meetingTitle}`;
      } else if (contextType === 'client' && clientName) {
        title = `${clientName} - Quick Chat`;
      }

      const response = await api.request('/ask-advicly/threads', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          title,
          contextType,
          contextData,
          meetingId
        })
      });
      setThreadId(response.id);
      return response.id;
    } catch (error) {
      console.error('Error creating thread:', error);
      return null;
    }
  }, [clientId, contextType, contextData, meetingId, meetingTitle, clientName]);

  const sendMessage = async (messageText = null) => {
    const text = messageText || input.trim();
    if (!text) return;

    let currentThreadId = threadId;
    if (!currentThreadId) {
      currentThreadId = await createThread();
      if (!currentThreadId) return;
    }

    const userMessage = {
      id: Date.now(),
      content: text,
      role: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.request(`/ask-advicly/threads/${currentThreadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: text,
          contextType,
          contextData
        })
      });

      if (response.crossClientBlock) {
        setMessages(prev => [...prev, response.aiMessage]);
      } else {
        setMessages(prev => [...prev, response.aiMessage || response]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePromptClick = (promptText) => {
    sendMessage(promptText);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Messages area */}
      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-4">
            {/* Welcome message */}
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Sparkles className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-3 max-w-[85%]">
                <p className="text-sm text-foreground">
                  {contextType === 'meeting' 
                    ? `How can I help you with this meeting${clientName ? ` with ${clientName}` : ''}?`
                    : `How can I help you with ${clientName || 'this client'}?`
                  }
                </p>
              </div>
            </div>

            {/* Suggested prompts */}
            <div className="space-y-2 pl-11">
              {prompts.map((prompt, idx) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handlePromptClick(prompt.text)}
                    disabled={loading}
                    className="w-full text-left p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("w-4 h-4 flex-shrink-0", prompt.color)} />
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                        {prompt.text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-2",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                </div>
                {message.role === 'user' && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-muted">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Sparkles className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="w-full min-h-[40px] max-h-24 p-3 bg-muted/50 text-foreground border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              disabled={loading}
            />
          </div>
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

