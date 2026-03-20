import React, { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { useFloatingChat } from './FloatingChatContext';
import ClientMentionDropdown from '../ClientMentionDropdown';
import { extractMentionedClients } from '../MentionText';

export default function FloatingChatInput() {
  const { sendMessage, sendingMessage, clients, pageContext } = useFloatingChat();
  const [input, setInput] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState({});
  const textareaRef = useRef(null);

  const detectMention = useCallback((text, cursorPos) => {
    // Look backwards from cursor for @
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionSearchTerm(mentionMatch[1]);
      setShowMentionDropdown(true);

      // Position dropdown above the input
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setMentionPosition({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left
        });
      }
    } else {
      setShowMentionDropdown(false);
      setMentionSearchTerm('');
    }
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);
    detectMention(value, e.target.selectionStart);
  };

  const handleMentionSelect = (client) => {
    if (!client) {
      setShowMentionDropdown(false);
      return;
    }

    // Replace the @partial with @FullName
    const cursorPos = textareaRef.current?.selectionStart || input.length;
    const textBefore = input.substring(0, cursorPos);
    const textAfter = input.substring(cursorPos);
    const replaced = textBefore.replace(/@\w*$/, `@${client.name} `);

    setInput(replaced + textAfter);
    setShowMentionDropdown(false);
    setMentionSearchTerm('');

    // Refocus textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    // Let the mention dropdown handle its own keys when visible
    if (showMentionDropdown) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        return; // Dropdown's global listener handles these
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim() || sendingMessage) return;

    const mentioned = extractMentionedClients(input, clients);
    sendMessage(input, mentioned);
    setInput('');
    setShowMentionDropdown(false);
  };

  const placeholder = pageContext.type === 'client' && pageContext.clientName
    ? `Ask about ${pageContext.clientName}...`
    : pageContext.type === 'meeting'
    ? 'Ask about this meeting...'
    : 'Ask anything... Use @ to mention a client';

  return (
    <div className="flex-shrink-0 border-t border-border/30 p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full min-h-[40px] max-h-24 p-3 bg-transparent text-foreground border border-border/30 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm placeholder:text-muted-foreground"
            disabled={sendingMessage}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendingMessage}
          className="h-10 w-10 flex-shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* @mention dropdown */}
      <ClientMentionDropdown
        clients={clients}
        isVisible={showMentionDropdown}
        searchTerm={mentionSearchTerm}
        onSelect={handleMentionSelect}
        position={mentionPosition}
      />
    </div>
  );
}
