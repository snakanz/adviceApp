import React from 'react';
import { Sparkles, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import MentionText from '../MentionText';
import { cn } from '../../lib/utils';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-3 max-w-3xl mx-auto w-full px-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Sparkles className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-card border border-border/30 text-foreground rounded-bl-md"
      )}>
        <MentionText text={message.content} className="text-sm whitespace-pre-wrap leading-relaxed" />
      </div>

      {isUser && (
        <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
          <AvatarFallback className="bg-muted">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
