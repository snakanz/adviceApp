import React from 'react';
import { useSearchParams } from 'react-router-dom';
import EnhancedAskAdvicly from '../components/EnhancedAskAdvicly';

export default function AskAdvicly() {
  const [searchParams] = useSearchParams();

  // Extract parameters from URL
  const clientId = searchParams.get('client');
  const clientName = searchParams.get('clientName');
  const meetingParam = searchParams.get('meeting');
  const meetingDate = searchParams.get('meetingDate');

  return (
    <div className="h-full bg-background">
      <EnhancedAskAdvicly
        clientId={clientId}
        clientName={clientName}
        meetingTitle={meetingParam}
        meetingDate={meetingDate}
        className="h-full"
      />
    </div>
  );
}