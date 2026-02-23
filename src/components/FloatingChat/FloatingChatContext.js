import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../../services/api';

const FloatingChatContext = createContext(null);

export function useFloatingChat() {
  const context = useContext(FloatingChatContext);
  if (!context) {
    throw new Error('useFloatingChat must be used within a FloatingChatProvider');
  }
  return context;
}

// Safely try to use the context (returns null if not inside provider)
export function useFloatingChatSafe() {
  return useContext(FloatingChatContext);
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export function FloatingChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('threads'); // 'threads' | 'chat'
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [gatheringStages, setGatheringStages] = useState([]);
  const [pageContext, setPageContext] = useState({ type: 'general' });

  const feedRef = useRef(null);
  const threadsLoadedRef = useRef(false);
  const clientsLoadedRef = useRef(false);

  // Load threads on first open
  const loadThreads = useCallback(async () => {
    if (loadingThreads) return;
    try {
      setLoadingThreads(true);
      const response = await api.request('/ask-advicly/threads');
      const threadsData = response.threads || response;
      setThreads(threadsData || []);
      threadsLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading threads:', error);
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, [loadingThreads]);

  // Load clients for @mention autocomplete
  const loadClients = useCallback(async () => {
    if (clientsLoadedRef.current) return;
    try {
      const response = await api.request('/clients');
      setClients(response || []);
      clientsLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, []);

  // Load threads and clients when widget first opens
  useEffect(() => {
    if (isOpen) {
      if (!threadsLoadedRef.current) loadThreads();
      if (!clientsLoadedRef.current) loadClients();
    }
  }, [isOpen, loadThreads, loadClients]);

  const openWidget = useCallback(() => setIsOpen(true), []);
  const closeWidget = useCallback(() => setIsOpen(false), []);
  const toggleWidget = useCallback(() => setIsOpen(prev => !prev), []);

  const loadMessages = useCallback(async (threadId) => {
    try {
      setLoadingMessages(true);
      const response = await api.request(`/ask-advicly/threads/${threadId}/messages`);
      setMessages(response || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectThread = useCallback(async (thread) => {
    setActiveThread(thread);
    setView('chat');
    setMessages([]);
    setStreamingResponse('');
    setGatheringStages([]);
    await loadMessages(thread.id);
  }, [loadMessages]);

  const goToThreadList = useCallback(() => {
    setView('threads');
    setActiveThread(null);
    setMessages([]);
    setStreamingResponse('');
    setGatheringStages([]);
  }, []);

  const createThread = useCallback(async (options = {}) => {
    const {
      clientId,
      clientName,
      contextType = pageContext.type,
      contextData = {},
      meetingId,
      meetingTitle
    } = options;

    let title = 'New Conversation';
    if (contextType === 'meeting' && meetingTitle) {
      title = `${clientName || 'Client'} - ${meetingTitle}`;
    } else if (contextType === 'client' && clientName) {
      title = `${clientName} - Client Discussion`;
    } else {
      title = 'General Advisory Chat';
    }

    try {
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
      setActiveThread(response);
      setView('chat');
      setMessages([]);
      return response;
    } catch (error) {
      console.error('Error creating thread:', error);
      return null;
    }
  }, [pageContext]);

  const deleteThread = useCallback(async (threadId) => {
    try {
      await api.request(`/ask-advicly/threads/${threadId}`, { method: 'DELETE' });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThread?.id === threadId) {
        goToThreadList();
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  }, [activeThread, goToThreadList]);

  // Send message with SSE streaming for gathering stages + AI response
  const sendMessage = useCallback(async (content, mentionedClients = []) => {
    if (!content.trim() || sendingMessage) return;

    let threadId = activeThread?.id;

    // Auto-create thread if none active
    if (!threadId) {
      const newThread = await createThread({
        clientId: pageContext.clientId,
        clientName: pageContext.clientName,
        contextType: pageContext.type,
        contextData: pageContext,
        meetingId: pageContext.meetingId,
        meetingTitle: pageContext.meetingTitle
      });
      if (!newThread) return;
      threadId = newThread.id;
    }

    // Add user message optimistically
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
      // Get auth token for SSE request
      const token = await api.getToken();

      const response = await fetch(`${API_BASE_URL}/api/ask-advicly/threads/${threadId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: content.trim(),
          contextType: activeThread?.context_type || pageContext.type,
          contextData: pageContext,
          mentionedClients: mentionedClients.map(c => ({ id: c.id, name: c.name, email: c.email }))
        })
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

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

            if (event.stage && event.stage !== 'response' && event.stage !== 'done') {
              // Update gathering stages
              setGatheringStages(prev => prev.map(s => {
                if (s.id === event.stage) {
                  return { ...s, status: event.status, label: event.label || s.label };
                }
                return s;
              }));
            } else if (event.stage === 'response' && event.chunk) {
              // Streaming AI response
              fullResponse += event.chunk;
              setStreamingResponse(fullResponse);
            } else if (event.stage === 'done') {
              // Done — add the AI message
              const aiMessage = {
                id: event.messageId || `ai-${Date.now()}`,
                content: fullResponse,
                role: 'assistant',
                created_at: new Date().toISOString()
              };
              setMessages(prev => [...prev, aiMessage]);
              setStreamingResponse('');
              setGatheringStages([]);
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }

      // If stream ended without 'done' event, add what we have
      if (fullResponse && gatheringStages.length > 0) {
        const aiMessage = {
          id: `ai-${Date.now()}`,
          content: fullResponse,
          role: 'assistant',
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
        setStreamingResponse('');
        setGatheringStages([]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Fallback to non-streaming endpoint
      try {
        const response = await api.request(`/ask-advicly/threads/${threadId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: content.trim(),
            contextType: activeThread?.context_type || pageContext.type,
            contextData: pageContext
          })
        });

        const aiMessage = response.aiMessage || response;
        setMessages(prev => [...prev, aiMessage]);
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
  }, [activeThread, pageContext, sendingMessage, createThread, gatheringStages]);

  const value = {
    isOpen,
    view,
    threads,
    activeThread,
    messages,
    clients,
    loadingThreads,
    loadingMessages,
    sendingMessage,
    streamingResponse,
    gatheringStages,
    pageContext,
    feedRef,
    openWidget,
    closeWidget,
    toggleWidget,
    setPageContext,
    selectThread,
    goToThreadList,
    createThread,
    deleteThread,
    sendMessage,
    loadThreads
  };

  return (
    <FloatingChatContext.Provider value={value}>
      {children}
    </FloatingChatContext.Provider>
  );
}
