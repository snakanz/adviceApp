import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../lib/utils';

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
  const [highlightedText, setHighlightedText] = useState('');

  // Update highlighted text when value changes
  useEffect(() => {
    if (!value) {
      setHighlightedText('');
      return;
    }

    // Replace @ mentions with styled spans
    const highlighted = value.replace(
      /@(\w+(?:\s+\w+)*)/g,
      '<span class="mention-highlight">@$1</span>'
    );
    
    setHighlightedText(highlighted);
  }, [value]);

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
        <div
          dangerouslySetInnerHTML={{ __html: highlightedText }}
          className="mention-overlay"
        />
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
