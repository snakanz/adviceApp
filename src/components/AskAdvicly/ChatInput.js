import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import ClientMentionDropdown from '../ClientMentionDropdown';
import { extractMentionedClients } from '../MentionText';

export default function ChatInput({
  onSend,
  sendingMessage,
  clients,
  clientName,
  contextType
}) {
  const [input, setInput] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState({});
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`;
    }
  }, [input]);

  const detectMention = useCallback((text, cursorPos) => {
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionSearchTerm(mentionMatch[1]);
      setShowMentionDropdown(true);

      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setMentionPosition({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left + 16
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

    const cursorPos = textareaRef.current?.selectionStart || input.length;
    const textBefore = input.substring(0, cursorPos);
    const textAfter = input.substring(cursorPos);
    const replaced = textBefore.replace(/@\w*$/, `@${client.name} `);

    setInput(replaced + textAfter);
    setShowMentionDropdown(false);
    setMentionSearchTerm('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    // Let the mention dropdown handle its own keys when visible
    if (showMentionDropdown) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        return;
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
    onSend(input, mentioned);
    setInput('');
    setShowMentionDropdown(false);
  };

  const placeholder = contextType === 'client' && clientName
    ? `Ask about ${clientName}...`
    : contextType === 'meeting'
    ? 'Ask about this meeting...'
    : 'Ask anything... Use @ to mention a client';

  return (
    <div className="border-t border-border/30 p-4 flex-shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full min-h-[52px] max-h-48 p-4 pr-14 bg-card border border-border/30 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-foreground placeholder:text-muted-foreground"
            disabled={sendingMessage}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendingMessage}
            className="absolute right-3 bottom-3 h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90 transition-colors"
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
    </div>
  );
}
