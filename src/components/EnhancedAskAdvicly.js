import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '../lib/utils';
import { 
  User, 
  Bot, 
  Send, 
  MessageSquare, 
  Plus, 
  Edit3, 
  Lightbulb,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';

const PROMPT_SUGGESTIONS = [
  "How many meetings did I have last month?",
  "What's outstanding for this client before they sign?",
  "Summarize the key decisions from our last meeting",
  "What are the next steps for this client?",
  "Show me this client's meeting history"
];

export default function EnhancedAskAdvicly({ clientId, clientName, className = "" }) {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const feedRef = useRef(null);

  // Load threads on component mount
  useEffect(() => {
    loadThreads();
  }, []);

  // Load messages when active thread changes
  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const loadThreads = async () => {
    try {
      setLoadingThreads(true);
      const response = await api.request('/ask-advicly/threads');
      setThreads(response);
      
      // If we have a clientId, filter to client-specific threads or create one
      if (clientId) {
        const clientThreads = response.filter(t => t.client_id === clientId);
        if (clientThreads.length > 0) {
          setActiveThreadId(clientThreads[0].id);
        } else {
          // Create a new thread for this client
          await createNewThread(clientId, `Chat with ${clientName || 'Client'}`);
        }
      } else if (response.length > 0) {
        setActiveThreadId(response[0].id);
      }
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadMessages = async (threadId) => {
    try {
      const response = await api.request(`/ask-advicly/threads/${threadId}/messages`);
      setMessages(response);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const createNewThread = async (clientId = null, title = 'New Conversation') => {
    try {
      const response = await api.request('/ask-advicly/threads', {
        method: 'POST',
        body: JSON.stringify({ clientId, title })
      });
      
      setThreads(prev => [response, ...prev]);
      setActiveThreadId(response.id);
      return response;
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    let threadId = activeThreadId;
    
    // Create a new thread if none exists
    if (!threadId) {
      const newThread = await createNewThread(clientId, input.substring(0, 50) + '...');
      threadId = newThread?.id;
      if (!threadId) return;
    }

    const userMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.request(`/ask-advicly/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: input.trim() })
      });

      setMessages(prev => [...prev, response.aiMessage]);
      
      // Update thread timestamp in local state
      setThreads(prev => prev.map(t => 
        t.id === threadId 
          ? { ...t, updated_at: new Date().toISOString() }
          : t
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const updateThreadTitle = async (threadId, newTitle) => {
    try {
      await api.request(`/ask-advicly/threads/${threadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle })
      });
      
      setThreads(prev => prev.map(t => 
        t.id === threadId ? { ...t, title: newTitle } : t
      ));
      setEditingThreadId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Error updating thread title:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <div className={cn("h-full flex bg-background", className)}>
      {/* Sidebar with threads */}
      <div className="w-80 border-r border-border/50 flex flex-col">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {clientName ? `Chat with ${clientName}` : 'Ask Advicly'}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => createNewThread(clientId)}
              className="h-8 w-8 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Prompt suggestions */}
          {messages.length === 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Lightbulb className="w-4 h-4" />
                Try asking:
              </div>
              {PROMPT_SUGGESTIONS.slice(0, 3).map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full justify-start text-left h-auto p-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  "{suggestion}"
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading conversations...
            </div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {threads.map(thread => (
                <div
                  key={thread.id}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors",
                    activeThreadId === thread.id 
                      ? "bg-primary/10 border border-primary/20" 
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    {editingThreadId === thread.id ? (
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => updateThreadTitle(thread.id, editingTitle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateThreadTitle(thread.id, editingTitle);
                          } else if (e.key === 'Escape') {
                            setEditingThreadId(null);
                            setEditingTitle('');
                          }
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-sm"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {thread.title}
                        </div>
                        {thread.clients && (
                          <div className="text-xs text-muted-foreground truncate">
                            {thread.clients.name}
                          </div>
                        )}
                      </div>
                    )}
                    {activeThreadId === thread.id && editingThreadId !== thread.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingThreadId(thread.id);
                          setEditingTitle(thread.title);
                        }}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(thread.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {activeThread ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold text-foreground">{activeThread.title}</h3>
              {activeThread.clients && (
                <p className="text-sm text-muted-foreground">
                  Conversation about {activeThread.clients.name}
                </p>
              )}
            </div>

            {/* Messages */}
            <div 
              ref={feedRef} 
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Start a conversation
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Ask me anything about {clientName || 'your clients'}, meetings, or financial advice.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                    {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-left justify-start h-auto p-3"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-end gap-3",
                      msg.role === 'user' && "flex-row-reverse"
                    )}
                  >
                    <Avatar className={cn(
                      "w-8 h-8",
                      msg.role === 'user' 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-accent text-accent-foreground"
                    )}>
                      <AvatarFallback>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "max-w-[70%] rounded-lg p-3",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}>
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex items-end gap-3">
                  <Avatar className="w-8 h-8 bg-accent text-accent-foreground">
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted text-foreground rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-border/50 p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask about ${clientName || 'your clients'}...`}
                    className="w-full min-h-[40px] max-h-32 p-3 bg-background text-foreground border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    rows={1}
                  />
                </div>
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="flex items-center gap-2 px-4 py-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Select a conversation
              </h3>
              <p className="text-muted-foreground">
                Choose a conversation from the sidebar or create a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
