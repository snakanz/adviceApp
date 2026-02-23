import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { useFloatingChat } from './FloatingChatContext';
import { cn } from '../../lib/utils';

export default function FloatingChatButton() {
  const { isOpen, toggleWidget } = useFloatingChat();

  return (
    <button
      onClick={toggleWidget}
      className={cn(
        "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center",
        "shadow-lg transition-all duration-300 ease-in-out",
        "hover:scale-105 active:scale-95",
        isOpen
          ? "bg-muted text-muted-foreground hover:bg-muted/80"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      )}
      style={!isOpen ? {
        boxShadow: '0 4px 20px rgba(51, 122, 255, 0.4), 0 2px 8px rgba(51, 122, 255, 0.2)'
      } : undefined}
      aria-label={isOpen ? 'Close Ask Advicly' : 'Open Ask Advicly'}
    >
      <div className={cn(
        "transition-transform duration-300",
        isOpen ? "rotate-90" : "rotate-0"
      )}>
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Sparkles className="w-6 h-6" />
        )}
      </div>
    </button>
  );
}
