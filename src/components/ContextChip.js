import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ContextChip({ 
  clientName, 
  meetingTitle, 
  meetingDate, 
  onRemove, 
  className 
}) {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm font-medium",
      "hover:bg-blue-100 transition-colors duration-200",
      className
    )}>
      <span className="flex items-center gap-1">
        <span className="text-blue-600">@</span>
        <span className="font-semibold">{clientName}</span>
        {meetingTitle && (
          <>
            <span className="text-blue-500 mx-1">•</span>
            <span className="text-blue-700">{meetingTitle}</span>
          </>
        )}
        {meetingDate && (
          <span className="text-blue-500 ml-1">({formatDate(meetingDate)})</span>
        )}
      </span>
      
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-200 hover:bg-blue-300 text-blue-600 hover:text-blue-800 transition-colors duration-150"
          title="Remove context"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// Alternative compact version for inline display
export function CompactContextChip({ 
  clientName, 
  meetingTitle, 
  onRemove, 
  className 
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-1 bg-blue-100 border border-blue-200 rounded-md text-blue-800 text-xs font-medium",
      className
    )}>
      <span className="text-blue-600">@</span>
      <span>{clientName}</span>
      {meetingTitle && (
        <>
          <span className="text-blue-500">•</span>
          <span className="text-blue-700">{meetingTitle}</span>
        </>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-blue-500 hover:text-blue-700"
          title="Remove"
        >
          <X size={8} />
        </button>
      )}
    </span>
  );
}
