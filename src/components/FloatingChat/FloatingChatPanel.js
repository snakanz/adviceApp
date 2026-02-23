import React from 'react';
import { Sparkles, ArrowLeft, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFloatingChat } from './FloatingChatContext';
import FloatingChatThreadList from './FloatingChatThreadList';
import FloatingChatMessages from './FloatingChatMessages';
import FloatingChatInput from './FloatingChatInput';
import { cn } from '../../lib/utils';

export default function FloatingChatPanel() {
  const { isOpen, view, activeThread, goToThreadList, closeWidget, pageContext } = useFloatingChat();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleOpenFullView = () => {
    const params = new URLSearchParams();
    if (activeThread?.id) params.set('threadId', activeThread.id);
    closeWidget();
    navigate(`/ask-advicly${params.toString() ? '?' + params.toString() : ''}`);
  };

  const contextLabel = pageContext.type === 'client' && pageContext.clientName
    ? `Viewing: ${pageContext.clientName}`
    : pageContext.type === 'meeting' && pageContext.meetingTitle
    ? `Meeting: ${pageContext.meetingTitle}`
    : null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 sm:hidden"
        onClick={closeWidget}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed z-40 flex flex-col",
          "bg-card/95 backdrop-blur-xl border border-border/30",
          "shadow-2xl",
          // Desktop: positioned above FAB
          "sm:bottom-24 sm:right-6 sm:w-[400px] sm:h-[600px] sm:max-h-[calc(100vh-140px)] sm:rounded-2xl",
          // Mobile: fullscreen
          "inset-0 sm:inset-auto",
          // Animation
          "animate-in slide-in-from-bottom-4 duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 flex-shrink-0">
          {view === 'chat' && (
            <button
              onClick={goToThreadList}
              className="p-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {view === 'chat' && activeThread ? activeThread.title : 'Ask Advicly'}
              </h3>
              {contextLabel && view === 'threads' && (
                <p className="text-xs text-primary truncate">{contextLabel}</p>
              )}
            </div>
          </div>

          {/* Close button (mobile) */}
          <button
            onClick={closeWidget}
            className="p-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground sm:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'threads' ? (
            <FloatingChatThreadList />
          ) : (
            <>
              <FloatingChatMessages />
              <FloatingChatInput />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border/30 px-4 py-2">
          <button
            onClick={handleOpenFullView}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors w-full justify-center"
          >
            <Maximize2 className="w-3 h-3" />
            Open full view
          </button>
        </div>
      </div>
    </>
  );
}
