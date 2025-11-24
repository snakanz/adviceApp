import React from 'react';
import { useSearchParams } from 'react-router-dom';
import SimplifiedAskAdvicly from '../components/SimplifiedAskAdvicly';

export default function AskAdvicly() {
  const [searchParams] = useSearchParams();

  // Extract enhanced context parameters from URL
  const contextType = searchParams.get('contextType') || 'general';
  const clientId = searchParams.get('client');
  const clientName = searchParams.get('clientName');
  const clientEmail = searchParams.get('clientEmail');
  const meetingId = searchParams.get('meetingId');
  const meetingParam = searchParams.get('meeting') || searchParams.get('meetingTitle');
  const meetingDate = searchParams.get('meetingDate');
  const hasTranscript = searchParams.get('hasTranscript') === 'true';
  const hasSummary = searchParams.get('hasSummary') === 'true';
  const meetingCount = searchParams.get('meetingCount');
  const pipelineStatus = searchParams.get('pipelineStatus');
  const likelyValue = searchParams.get('likelyValue');
  const lastMeetingDate = searchParams.get('lastMeetingDate');
  const autoStart = searchParams.get('autoStart') === 'true';

  // Build context data object
  const contextData = {
    type: contextType,
    ...(contextType === 'meeting' && {
      meetingId,
      meetingTitle: meetingParam,
      meetingDate,
      clientName,
      clientEmail,
      hasTranscript,
      hasSummary
    }),
    ...(contextType === 'client' && {
      clientId,
      clientName,
      clientEmail,
      meetingCount: parseInt(meetingCount) || 0,
      pipelineStatus,
      likelyValue: parseFloat(likelyValue) || 0,
      lastMeetingDate
    }),
    ...(contextType === 'general' && {
      scope: 'cross-client'
    })
  };

  return (
    <div className="h-full bg-background">
      <SimplifiedAskAdvicly
        contextType={contextType}
        contextData={contextData}
        clientId={clientId}
        clientName={clientName}
        meetingId={meetingId}
        meetingTitle={meetingParam}
        meetingDate={meetingDate}
        autoStart={autoStart}
        className="h-full"
      />
    </div>
  );
}