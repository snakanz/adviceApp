import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import GatheringStages from './GatheringStages';
import EmptyState from './EmptyState';

export default function ChatArea({
  messages,
  sendingMessage,
  streamingResponse,
  gatheringStages,
  contextType,
  clientName,
  onSuggestionClick
}) {
  const feedRef = useRef(null);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, streamingResponse, gatheringStages]);

  // Empty state
  if (messages.length === 0 && !sendingMessage) {
    return (
      <div ref={feedRef} className="flex-1 overflow-y-auto">
        <EmptyState
          contextType={contextType}
          clientName={clientName}
          onSuggestionClick={onSuggestionClick}
        />
      </div>
    );
  }

  return (
    <div ref={feedRef} className="flex-1 overflow-y-auto py-6 space-y-5">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {sendingMessage && (
        <div className="px-4">
          <GatheringStages
            stages={gatheringStages}
            streamingResponse={streamingResponse}
          />
        </div>
      )}
    </div>
  );
}
