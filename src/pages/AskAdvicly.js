import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { cn } from '../lib/utils';
import {
  Sparkles,
  Send,
  User,
  Bot,
  MessageSquare,
  Plus,
  Edit3,
  Lightbulb
} from 'lucide-react';
import { api } from '../services/api';

const SYSTEM_PROMPT = 'You are a helpful assistant for financial advisors using Advicly.';

export default function AskAdvicly() {
  const [messages, setMessages] = useState([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'assistant', content: 'I am Advicly AI. Ask me anything about your clients, previous meetings, or financial advice.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await api.request('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newMessages.filter(m => m.role !== 'system')
          ]
        })
      });
      setMessages([...newMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl h-[600px] border-border/50 shadow-large">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-border/50 p-6 bg-card/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Ask Advicly</h1>
            </div>
          </div>

          {/* Chat Feed */}
          <div 
            ref={feedRef} 
            className="flex-1 overflow-y-auto p-6 space-y-4 bg-background"
          >
            {messages.filter(m => m.role !== 'system').map((msg, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex items-end gap-3",
                  msg.role === 'user' && "flex-row-reverse"
                )}
              >
                <Avatar className={cn(
                  "w-8 h-8 text-sm font-medium",
                  msg.role === 'user' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-accent text-accent-foreground"
                )}>
                  <AvatarFallback className={cn(
                    "text-sm font-medium",
                    msg.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-accent text-accent-foreground"
                  )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                
                <Card className={cn(
                  "max-w-[280px] border-border/50",
                  msg.role === 'user' 
                    ? "bg-primary/10 border-primary/20" 
                    : "bg-card/50"
                )}>
                  <CardContent className="p-3">
                    <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                      {msg.content}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
            
            {loading && (
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8 bg-accent text-accent-foreground">
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                      <span className="text-sm text-muted-foreground">Advicly is thinking...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/50 p-4 bg-card/50">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  className="w-full min-h-[40px] max-h-32 p-3 bg-background text-foreground border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm leading-relaxed"
                  rows={1}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-4 py-3"
              >
                <Send className="w-4 h-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
} 