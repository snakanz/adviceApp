import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import ChatSidebar from './AskAdvicly/ChatSidebar';
import ChatArea from './AskAdvicly/ChatArea';
import ChatInput from './AskAdvicly/ChatInput';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export default function SimplifiedAskAdvicly({
  contextType = 'general',
  contextData = {},
  clientId,
  clientName,
  meetingId,
  meetingTitle,
  autoStart = false,
  className = ""
}) {
  // Thread state
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [loadingThreads, setLoadingThreads] = useState(true);

  // Message state
  const [messages, setMessages] = useState([]);

  // SSE streaming state
  const [sendingMessage, setSendingMessage] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [gatheringStages, setGatheringStages] = useState([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [clients, setClients] = useState([]);

  const didAutoStartRef = useRef(false);
  const clientsLoadedRef = useRef(false);

  // ─── Load threads on mount ───
  useEffect(() => {
    loadThreads();
    loadClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-select thread based on context ───
  useEffect(() => {
    if (threads.length > 0 && !activeThreadId) {
      if (contextType === 'meeting' && meetingId) {
        const match = threads.find(t => t.context_type === 'meeting' && t.meeting_id === meetingId);
        if (match) { setActiveThreadId(match.id); return; }
      } else if (contextType === 'client' && clientId) {
        const match = threads.find(t => t.context_type === 'client' && t.client_id === clientId);
        if (match) { setActiveThreadId(match.id); return; }
      }
      const general = threads.find(t => t.context_type === 'general');
      if (general) setActiveThreadId(general.id);
    }
  }, [threads, contextType, meetingId, clientId, activeThreadId]);

  // ─── Auto-create thread when arriving with autoStart ───
  useEffect(() => {
    if (!autoStart || didAutoStartRef.current) return;
    if (threads.length === 0 && !activeThreadId && (contextType === 'client' || contextType === 'meeting')) {
      didAutoStartRef.current = true;
      createNewThread();
    }
  }, [autoStart, threads, activeThreadId, contextType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load messages when active thread changes ───
  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Data loaders ───
  const loadThreads = async () => {
    try {
      setLoadingThreads(true);
      const response = await api.request('/ask-advicly/threads');
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

  const loadClients = async () => {
    if (clientsLoadedRef.current) return;
    try {
      const response = await api.request('/clients');
      setClients(response || []);
      clientsLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  // ─── Thread CRUD ───
  const createNewThread = useCallback(async () => {
    try {
      let title = 'General Advisory Chat';
      if (contextType === 'meeting' && contextData.meetingTitle) {
        title = `${contextData.clientName || 'Client'} - ${contextData.meetingTitle}`;
      } else if (contextType === 'client' && contextData.clientName) {
        title = `${contextData.clientName} - Client Discussion`;
      }

      const response = await api.request('/ask-advicly/threads', {
        method: 'POST',
        body: JSON.stringify({ clientId, title, contextType, contextData, meetingId })
      });

      setThreads(prev => [response, ...prev]);
      setActiveThreadId(response.id);
      setMessages([]);
      return response;
    } catch (error) {
      console.error('Error creating thread:', error);
      return null;
    }
  }, [clientId, contextType, contextData, meetingId]);

  const handleNewChat = () => {
    setActiveThreadId(null);
    setMessages([]);
    setStreamingResponse('');
    setGatheringStages([]);
  };

  const deleteThread = async (threadId) => {
    try {
      await api.request(`/ask-advicly/threads/${threadId}`, { method: 'DELETE' });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThreadId === threadId) handleNewChat();
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  const updateThreadTitle = async (threadId, title) => {
    try {
      await api.request(`/ask-advicly/threads/${threadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title })
      });
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title } : t));
    } catch (error) {
      console.error('Error updating thread title:', error);
    }
  };

  // ─── SSE Streaming Send ───
  const sendMessage = useCallback(async (content, mentionedClients = []) => {
    if (!content.trim() || sendingMessage) return;

    let threadId = activeThreadId;

    // Auto-create thread if none active
    if (!threadId) {
      const newThread = await createNewThread();
      if (!newThread) return;
      threadId = newThread.id;
    }

    // Optimistic user message
    const userMessage = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      role: 'user',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setSendingMessage(true);
    setStreamingResponse('');
    setGatheringStages([
      { id: 'client', label: 'Finding client profile...', status: 'pending' },
      { id: 'meetings', label: 'Loading meeting transcripts...', status: 'pending' },
      { id: 'documents', label: 'Scanning client documents...', status: 'pending' },
      { id: 'thinking', label: 'Analysing data...', status: 'pending' }
    ]);

    try {
      const token = await api.getToken();

      const response = await fetch(`${API_BASE_URL}/api/ask-advicly/threads/${threadId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: content.trim(),
          contextType,
          contextData,
          mentionedClients: mentionedClients.map(c => ({ id: c.id, name: c.name, email: c.email }))
        })
      });

      if (!response.ok) throw new Error(`Stream request failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';
      let streamDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            if (event.stage && event.stage !== 'response' && event.stage !== 'done' && event.stage !== 'error') {
              setGatheringStages(prev => prev.map(s =>
                s.id === event.stage ? { ...s, status: event.status, label: event.label || s.label } : s
              ));
            } else if (event.stage === 'response' && event.chunk) {
              fullResponse += event.chunk;
              setStreamingResponse(fullResponse);
            } else if (event.stage === 'done') {
              streamDone = true;
              setMessages(prev => [...prev, {
                id: event.messageId || `ai-${Date.now()}`,
                content: fullResponse,
                role: 'assistant',
                created_at: new Date().toISOString()
              }]);
              setStreamingResponse('');
              setGatheringStages([]);
            } else if (event.stage === 'error') {
              setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                content: event.message || 'Something went wrong. Please try again.',
                role: 'assistant',
                created_at: new Date().toISOString()
              }]);
              setStreamingResponse('');
              setGatheringStages([]);
              streamDone = true;
            }
          } catch (e) { /* skip malformed JSON */ }
        }
      }

      // Safety net: if stream ended without done event
      if (!streamDone && fullResponse) {
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          content: fullResponse,
          role: 'assistant',
          created_at: new Date().toISOString()
        }]);
        setStreamingResponse('');
        setGatheringStages([]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Fallback to non-streaming endpoint
      try {
        const response = await api.request(`/ask-advicly/threads/${threadId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: content.trim(), contextType, contextData })
        });
        const aiMsg = response.aiMessage || response;
        setMessages(prev => [...prev, aiMsg]);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          content: 'Sorry, I encountered an error. Please try again.',
          role: 'assistant',
          created_at: new Date().toISOString()
        }]);
      }
      setStreamingResponse('');
      setGatheringStages([]);
    } finally {
      setSendingMessage(false);
    }
  }, [activeThreadId, contextType, contextData, sendingMessage, createNewThread]);

  const handleSuggestionClick = (text) => {
    sendMessage(text, []);
  };

  // ─── Render ───
  return (
    <div className={cn("h-full flex bg-background", className)}>
      {/* Sidebar */}
      {sidebarOpen && (
        <ChatSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          loadingThreads={loadingThreads}
          onSelectThread={setActiveThreadId}
          onNewChat={handleNewChat}
          onDeleteThread={deleteThread}
          onUpdateTitle={updateThreadTitle}
          onToggleSidebar={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sidebar toggle when collapsed */}
        {!sidebarOpen && (
          <div className="p-3 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/30 text-muted-foreground transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <ChatArea
          messages={messages}
          sendingMessage={sendingMessage}
          streamingResponse={streamingResponse}
          gatheringStages={gatheringStages}
          contextType={contextType}
          clientName={clientName}
          onSuggestionClick={handleSuggestionClick}
        />

        <ChatInput
          onSend={sendMessage}
          sendingMessage={sendingMessage}
          clients={clients}
          clientName={clientName}
          contextType={contextType}
        />
      </div>
    </div>
  );
}
