import React from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import {
  Calendar,
  User,
  MessageSquare,
  FileText,
  Clock,
  Users,
  TrendingUp,
  ChevronDown
} from 'lucide-react';

const ContextHeader = ({ 
  contextType, 
  contextData, 
  onContextChange,
  className 
}) => {
  const getContextIcon = (type) => {
    switch (type) {
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'client': return <User className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getContextColor = (type) => {
    switch (type) {
      case 'meeting': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'client': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  // Removed unused getBadgeVariant and formatDate functions
  // formatShortDate is used instead

  const formatShortDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const renderContextDetails = () => {
    switch (contextType) {
      case 'meeting':
        return (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{contextData.clientName || 'Unknown Client'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatShortDate(contextData.meetingDate)}</span>
            </div>
            {contextData.hasTranscript && (
              <Badge variant="outline" className="h-5 px-2 text-xs">
                <FileText className="w-3 h-3 mr-1" />
                Transcript
              </Badge>
            )}
            {contextData.hasSummary && (
              <Badge variant="outline" className="h-5 px-2 text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                Summary
              </Badge>
            )}
          </div>
        );

      case 'client':
        return (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{contextData.meetingCount || 0} meetings</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{contextData.pipelineStatus || 'Unknown'}</span>
            </div>
            {contextData.lastMeetingDate && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Last: {formatShortDate(contextData.lastMeetingDate)}</span>
              </div>
            )}
            {contextData.likelyValue > 0 && (
              <Badge variant="secondary" className="h-5 px-2 text-xs">
                ${contextData.likelyValue.toLocaleString()}
              </Badge>
            )}
          </div>
        );

      default:
        return (
          <div className="text-xs opacity-75">
            Cross-client insights and portfolio analysis
          </div>
        );
    }
  };

  const getContextTitle = () => {
    switch (contextType) {
      case 'meeting':
        return `Meeting: ${contextData.meetingTitle || 'Unknown Meeting'}`;
      case 'client':
        return `Client: ${contextData.clientName || 'Unknown Client'}`;
      default:
        return 'General Advisory Chat';
    }
  };

  return (
    <div className={cn(
      "p-3 border-b border-border/50",
      getContextColor(contextType),
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getContextIcon(contextType)}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {getContextTitle()}
            </div>
            <div className="mt-1">
              {renderContextDetails()}
            </div>
          </div>
        </div>
        
        {onContextChange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onContextChange}
            className="h-7 px-2 text-xs ml-2 flex-shrink-0"
          >
            <ChevronDown className="w-3 h-3 mr-1" />
            Change
          </Button>
        )}
      </div>
    </div>
  );
};

export default ContextHeader;
