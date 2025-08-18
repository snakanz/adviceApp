import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EnhancedAskAdvicly from '../components/EnhancedAskAdvicly';

export default function AskAdvicly() {
  const [searchParams] = useSearchParams();
  const [initialMessage, setInitialMessage] = useState('');

  // Extract parameters from URL
  const clientId = searchParams.get('client');
  const clientName = searchParams.get('clientName');
  const meetingParam = searchParams.get('meeting');

  useEffect(() => {
    // Set initial message based on URL parameters
    if (meetingParam) {
      setInitialMessage(`Tell me about the "${meetingParam}" meeting${clientName ? ` with ${clientName}` : ''}.`);
    }
  }, [meetingParam, clientName]);

  return (
    <div className="h-full bg-background">
      <EnhancedAskAdvicly
        clientId={clientId}
        clientName={clientName}
        initialMessage={initialMessage}
        className="h-full"
      />
    </div>
  );
}