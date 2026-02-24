import React from 'react';
import { Sparkles, CheckCircle2, Circle } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { cn } from '../../lib/utils';

export default function GatheringStages({ stages, streamingResponse }) {
  const hasActiveStage = stages.some(s => s.status === 'loading' || s.status === 'done');

  return (
    <div className="flex gap-3 max-w-3xl mx-auto w-full">
      <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Sparkles className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>

      <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 bg-card border border-border/30">
        {/* Gathering visualization */}
        {stages.length > 0 && !streamingResponse && (
          <div className="space-y-2.5 py-1">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-2.5 text-sm">
                {stage.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : stage.status === 'loading' ? (
                  <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  </div>
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={cn(
                  "transition-colors duration-300",
                  stage.status === 'done' ? 'text-muted-foreground' :
                  stage.status === 'loading' ? 'text-foreground' :
                  'text-muted-foreground/40'
                )}>
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Streaming text */}
        {streamingResponse && (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{streamingResponse}</div>
        )}

        {/* Fallback bouncing dots */}
        {!hasActiveStage && !streamingResponse && (
          <div className="flex items-center gap-1.5 py-2">
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        )}
      </div>
    </div>
  );
}
