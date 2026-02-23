import React from 'react';
import { Plus, Calendar, User, MessageSquare, Trash2 } from 'lucide-react';
import { useFloatingChat } from './FloatingChatContext';
import { cn } from '../../lib/utils';

export default function FloatingChatThreadList() {
  const {
    threads,
    loadingThreads,
    selectThread,
    createThread,
    deleteThread,
    pageContext
  } = useFloatingChat();

  const handleNewChat = () => {
    createThread({
      clientId: pageContext.clientId,
      clientName: pageContext.clientName,
      contextType: pageContext.type,
      contextData: pageContext,
      meetingId: pageContext.meetingId,
      meetingTitle: pageContext.meetingTitle
    });
  };

  const handleDelete = (e, threadId) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      deleteThread(threadId);
    }
  };

  // Context-aware CTA
  const contextCTA = pageContext.type === 'client' && pageContext.clientName
    ? `Chat about ${pageContext.clientName}`
    : pageContext.type === 'meeting' && pageContext.meetingTitle
    ? `Ask about this meeting`
    : null;

  const recentThreads = threads.slice(0, 20);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* New Chat / Context CTA */}
      <div className="p-3 space-y-2">
        {contextCTA && (
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-colors text-left"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium truncate">{contextCTA}</span>
          </button>
        )}

        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors text-left"
        >
          <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">New conversation</span>
        </button>
      </div>

      {/* Thread list */}
      <div className="px-3 pb-3 space-y-1">
        {loadingThreads ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading conversations...
          </div>
        ) : recentThreads.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          recentThreads.map((thread) => {
            const isGeneral = thread.context_type === 'general' || thread.context_data?.scope === 'all_clients';

            return (
              <div
                key={thread.id}
                onClick={() => selectThread(thread)}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  isGeneral
                    ? "hover:bg-amber-500/10"
                    : "hover:bg-muted/30"
                )}
              >
                {/* Icon */}
                {thread.context_type === 'meeting' ? (
                  <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : thread.context_type === 'client' ? (
                  <User className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <MessageSquare className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isGeneral ? "text-amber-500" : "text-muted-foreground"
                  )} />
                )}

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {thread.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {thread.context_type === 'meeting' && 'Meeting'}
                    {thread.context_type === 'client' && 'Client'}
                    {thread.context_type === 'general' && 'General'}
                    {thread.updated_at && (
                      <span className="ml-1">
                        · {formatRelativeDate(thread.updated_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(e, thread.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
