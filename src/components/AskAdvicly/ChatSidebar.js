import React, { useState } from 'react';
import { Plus, Calendar, User, MessageSquare, Trash2, PanelLeftClose, Pencil, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

function groupThreadsByTime(threads) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const last7Days = new Date(today - 7 * 86400000);

  const groups = { 'Today': [], 'Yesterday': [], 'Last 7 Days': [], 'Older': [] };

  threads.forEach(thread => {
    const date = new Date(thread.updated_at || thread.created_at);
    if (date >= today) groups['Today'].push(thread);
    else if (date >= yesterday) groups['Yesterday'].push(thread);
    else if (date >= last7Days) groups['Last 7 Days'].push(thread);
    else groups['Older'].push(thread);
  });

  return Object.entries(groups)
    .filter(([, threads]) => threads.length > 0)
    .map(([label, threads]) => ({ label, threads }));
}

export default function ChatSidebar({
  threads,
  activeThreadId,
  loadingThreads,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onUpdateTitle,
  onToggleSidebar
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const grouped = groupThreadsByTime(threads);

  const handleStartEdit = (e, thread) => {
    e.stopPropagation();
    setEditingId(thread.id);
    setEditingTitle(thread.title);
  };

  const handleSaveEdit = (e) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      onUpdateTitle(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDelete = (e, threadId) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      onDeleteThread(threadId);
    }
  };

  const getThreadIcon = (thread) => {
    if (thread.context_type === 'meeting') return <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    if (thread.context_type === 'client') return <User className="w-4 h-4 text-green-500 flex-shrink-0" />;
    return <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
  };

  return (
    <div className="w-[280px] border-r border-border/30 flex flex-col bg-card/50 backdrop-blur-sm flex-shrink-0">
      {/* Header */}
      <div className="p-3 flex items-center gap-2">
        <button
          onClick={onNewChat}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border border-border/30 hover:bg-muted/30 text-sm text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
        <button
          onClick={onToggleSidebar}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-muted/30 text-muted-foreground transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loadingThreads ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                {group.label}
              </div>
              {group.threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => onSelectThread(thread.id)}
                  className={cn(
                    "group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm",
                    activeThreadId === thread.id
                      ? "bg-primary/10 border-l-2 border-primary text-foreground"
                      : "hover:bg-muted/30 text-muted-foreground hover:text-foreground border-l-2 border-transparent"
                  )}
                >
                  {getThreadIcon(thread)}

                  {editingId === thread.id ? (
                    <div className="flex-1 flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(e);
                          if (e.key === 'Escape') handleCancelEdit(e);
                        }}
                        className="flex-1 bg-transparent border-b border-primary text-sm text-foreground focus:outline-none min-w-0"
                        autoFocus
                      />
                      <button onClick={handleSaveEdit} className="p-0.5 text-green-500 hover:text-green-400">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={handleCancelEdit} className="p-0.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{thread.title}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartEdit(e, thread)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, thread.id)}
                          className="p-1 rounded text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
