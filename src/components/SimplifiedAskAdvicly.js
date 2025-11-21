import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '../lib/utils';
import {
  User,
  Bot,
  Send,
  MessageSquare,
  Plus,
  Edit3,
  Calendar,
  X,
  Trash2
} from 'lucide-react';
import { api } from '../services/api'; // Fixed import path for deployment
import ContextHeader from './ContextHeader';
import NewChatModal from './NewChatModal';


const PROMPT_SUGGESTIONS = [
  "How many meetings did I have last month?",
  "What's outstanding for this client before they sign?",
  "Summarize the key decisions from our last meeting",
  "What are the next steps for this client?",
  "Show me this client's meeting history"
];

// Simple Context Banner Component
const ContextBanner = ({ contextType, contextData, onRemove }) => {
  if (contextType === 'general') return null;

  const getBannerContent = () => {
    if (contextType === 'meeting') {
      return {
        icon: <Calendar className="w-4 h-4" />,
        title: `Meeting Context: ${contextData.meetingTitle || 'Untitled Meeting'}`,
        subtitle: `${contextData.clientName} • ${new Date(contextData.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800'
      };
    } else if (contextType === 'client') {
      return {
        icon: <User className="w-4 h-4" />,
        title: `Client Context: ${contextData.clientName}`,
        subtitle: `${contextData.meetingCount || 0} meetings • ${contextData.pipelineStatus || 'Unknown status'}`,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800'
      };
    }
  };

  const banner = getBannerContent();
  if (!banner) return null;

  return (
    <div className={cn(
      "mx-4 mb-4 p-3 rounded-lg border",
      banner.bgColor,
      banner.borderColor,
      banner.textColor
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {banner.icon}
          <div>
            <div className="font-medium text-sm">{banner.title}</div>
            <div className="text-xs opacity-75">{banner.subtitle}</div>
          </div>
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 w-6 p-0 hover:bg-white/50"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default function SimplifiedAskAdvicly({
  contextType = 'general',
  contextData = {},
  clientId,
  clientName,
  meetingId,
  meetingTitle,
  meetingDate,
  className = ""
}) {
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

  // Context-aware thread management
  useEffect(() => {
    if (threads.length > 0 && !activeThreadId) {
      // Auto-select appropriate thread based on context
      if (contextType === 'meeting' && meetingId) {
        const meetingThread = threads.find(t =>
          t.context_type === 'meeting' && t.meeting_id === meetingId
        );
        if (meetingThread) {
          setActiveThreadId(meetingThread.id);
        }
      } else if (contextType === 'client' && clientId) {
        const clientThread = threads.find(t =>
          t.context_type === 'client' && t.client_id === clientId
        );
        if (clientThread) {
          setActiveThreadId(clientThread.id);
        }
      } else {
        // Default to most recent general thread
        const generalThread = threads.find(t => t.context_type === 'general');
        if (generalThread) {
          setActiveThreadId(generalThread.id);
        }
      }
    }
  }, [threads, contextType, meetingId, clientId, activeThreadId]);

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

      // Handle both old format (array) and new format (object with threads array)
      const threadsData = response.threads || response;
      setThreads(threadsData || []);
    } catch (error) {
      console.error('Error loading threads:', error);
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadMessages = async (threadId) => {
    try {
      const response = await api.request(`/ask-advicly/threads/${threadId}/messages`);
      setMessages(response || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const createNewThread = async () => {
    try {
      // Generate clean thread title based on context
      let title = 'New Conversation';
      if (contextType === 'meeting' && contextData.meetingTitle) {
        title = `${contextData.clientName} - ${contextData.meetingTitle}`;
      } else if (contextType === 'client' && contextData.clientName) {
        title = `${contextData.clientName} - Client Discussion`;
      } else {
        title = 'General Advisory Chat';
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
      const newThread = await createNewThread();
      threadId = newThread?.id;
      if (!threadId) return;
    }

    const userMessage = {
      id: Date.now(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.request(`/ask-advicly/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: input.trim(),
          contextType,
          contextData
        })
      });

      // Cross-client hard block: backend may return a special flag when the
      // question appears to be about a different client than this thread.
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

  const deleteThread = async (threadId) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await api.request(`/ask-advicly/threads/${threadId}`, {
        method: 'DELETE'
      });

      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
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

  const clearContext = () => {
    // Navigate back to general context
    window.location.href = '/ask-advicly';
  };

  const activeThread = threads.find(t => t.id === activeThreadId);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  return (
    <div className={cn("h-full flex bg-background", className)}>
      {/* Sidebar with threads */}
      <div className="w-80 border-r border-border/50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Conversations</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Client / meeting-specific chats stay scoped. Orange = all-clients.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewChatModal(true)}
            className="h-8 px-3 text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            New chat
          </Button>
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
            <div className="p-2 space-y-1">
              {threads.map((thread) => {
                const isGeneral = thread.context_type === 'general' || thread.context_data?.scope === 'all_clients';
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "group p-3 rounded-lg cursor-pointer transition-colors border",
                      isGeneral
                        ? "bg-amber-50/60 border-amber-300/70 hover:bg-amber-50"
                        : "hover:bg-muted/50 border-transparent",
                      activeThreadId === thread.id &&
                        (isGeneral
                          ? "ring-1 ring-amber-400"
                          : "bg-primary/10 border-primary/20")
                    )}
                    onClick={() => setActiveThreadId(thread.id)}
                  >
                  <div className="flex items-center gap-2">
                    {/* Context-aware icon */}
                    {thread.context_type === 'meeting' ? (
                      <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    ) : thread.context_type === 'client' ? (
                      <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
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
                          className="w-full bg-transparent border-none outline-none text-sm font-medium"
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm font-medium text-foreground truncate">
                          {thread.title}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {thread.context_type === 'meeting' && 'Meeting Discussion'}
                        {thread.context_type === 'client' && 'Client Discussion'}
                        {thread.context_type === 'general' && 'General Advisory'}
                        {thread.updated_at && (
                          <span className="ml-2">
                            {new Date(thread.updated_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thread actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingThreadId(thread.id);
                          setEditingTitle(thread.title);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteThread(thread.id);
                        }}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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
            <ContextHeader
              contextType={contextType}
              contextData={contextData}
              onContextChange={contextType !== 'general' ? clearContext : null}
            />

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
                messages.map((message) => (
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
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        message.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                    </div>

                    {message.role === 'user' && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="bg-muted">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}

              {loading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-border/50 p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={clientName ? `Ask about ${clientName}...` : 'Ask about your clients, meetings, or financial advice...'}
                    className="w-full min-h-[40px] max-h-32 p-3 bg-background text-foreground border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    disabled={loading}
                  />
                </div>
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="h-10 w-10 p-0 flex-shrink-0"
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
                No conversation selected
              </h3>
              <p className="text-muted-foreground mb-4">
                Choose a conversation from the sidebar or create a new one
              </p>
              <Button onClick={() => setShowNewChatModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* New chat modal lives at the root so it can be opened from sidebar or empty state */}
      <NewChatModal
        open={showNewChatModal}
        onOpenChange={setShowNewChatModal}
        onThreadCreated={(thread) => {
          setThreads(prev => [thread, ...prev]);
          setActiveThreadId(thread.id);
        }}
      />
    </div>
  );
}
