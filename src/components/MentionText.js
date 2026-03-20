import React from 'react';

// Component to render text with highlighted @ mentions
export default function MentionText({ text, className = "" }) {
  if (!text) return null;

  // Parse text to find @ mentions
  const parts = text.split(/(@\w+(?:\s+\w+)*)/g);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          // This is a mention
          return (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 mx-1 rounded-full text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm border border-blue-300"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}

// Hook to parse mentions from text
export function useMentions(text) {
  const mentions = React.useMemo(() => {
    if (!text) return [];
    
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const matches = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      matches.push({
        full: match[0], // @John Doe
        name: match[1], // John Doe
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    return matches;
  }, [text]);

  return mentions;
}

// Utility function to replace mentions with client names
export function replaceMentionsWithNames(text, clientMap) {
  if (!text || !clientMap) return text;
  
  return text.replace(/@(\w+(?:\s+\w+)*)/g, (match, name) => {
    const client = clientMap[name.toLowerCase()];
    return client ? `@${client.name}` : match;
  });
}

// Utility function to extract client context from mentions
export function extractMentionedClients(text, clients) {
  if (!text || !clients) return [];
  
  const mentions = [];
  const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionName = match[1].toLowerCase();
    const client = clients.find(c => 
      c.name.toLowerCase().includes(mentionName) ||
      mentionName.includes(c.name.toLowerCase())
    );
    
    if (client && !mentions.find(m => m.id === client.id)) {
      mentions.push(client);
    }
  }
  
  return mentions;
}
