import React, { useRef, useMemo } from 'react';
import { cn } from '../lib/utils';

// Parse text into segments of plain text and @mentions
function parseMentions(text) {
  if (!text) return [];
  const parts = [];
  const regex = /@(\w+(?:\s+\w+)*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'mention', value: match[0] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

// Enhanced textarea that shows @ mentions with styling
export default function MentionInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  disabled,
  ...props
}) {
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);

  const segments = useMemo(() => parseMentions(value), [value]);

  // Sync scroll between textarea and overlay
  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className="relative">
      {/* Overlay for styled text */}
      <div
        ref={overlayRef}
        className={cn(
          "absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words",
          "text-transparent p-3 border border-transparent rounded-lg",
          className
        )}
        style={{
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
          wordSpacing: 'inherit'
        }}
      >
        <div className="mention-overlay">
          {segments.map((seg, i) =>
            seg.type === 'mention' ? (
              <span key={i} className="mention-highlight">{seg.value}</span>
            ) : (
              <span key={i}>{seg.value}</span>
            )
          )}
        </div>
      </div>

      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "relative bg-transparent resize-none",
          className
        )}
        {...props}
      />

      {/* CSS for mention highlighting */}
      <style jsx>{`
        .mention-overlay .mention-highlight {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
          margin: 0 2px;
        }
      `}</style>
    </div>
  );
}
