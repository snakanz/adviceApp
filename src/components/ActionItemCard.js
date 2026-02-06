import React, { useState } from 'react';
import { Check, Edit2, Save, X } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * ActionItemCard - Unified action item component (Option B - Dark Refined)
 *
 * Always renders with dark theme styling regardless of app theme.
 * Used across: ActionItems Dashboard, Meeting Summary, Client Profile, Pipeline Sidebar
 */
const ActionItemCard = ({
  id,
  text,
  completed = false,
  priority = 3,
  meetingTitle,
  dueDate,
  onToggle,
  onEdit,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [isHovered, setIsHovered] = useState(false);

  // Priority styling (low-alpha backgrounds)
  const priorityStyles = {
    1: { label: 'Urgent', classes: 'bg-red-500/10 text-red-400' },
    2: { label: 'High', classes: 'bg-orange-500/10 text-orange-400' },
    3: { label: 'Medium', classes: 'bg-yellow-500/10 text-yellow-400' },
    4: { label: 'Low', classes: 'bg-green-500/10 text-green-400' }
  };

  const currentPriority = priorityStyles[priority] || priorityStyles[3];

  const handleToggle = () => {
    if (onToggle) {
      onToggle(id, !completed);
    }
  };

  const handleSaveEdit = () => {
    if (onEdit && editText.trim() !== text) {
      onEdit(id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(text);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      className={cn(
        // Container: Dark refined styling - always dark
        'bg-[#1A1C23] border border-[#2D313E] rounded-lg p-3 transition-all duration-200',
        // Hover state
        isHovered && !completed && 'border-[#3D414E]',
        // Completed state
        completed && 'opacity-50',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox - Square with 6px radius, indigo fill */}
        <button
          onClick={handleToggle}
          className={cn(
            'flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 mt-0.5',
            completed
              ? 'bg-indigo-600 border-indigo-600'
              : 'border-[#4D515E] hover:border-indigo-500'
          )}
          aria-label={completed ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-[#252830] border border-[#3D414E] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 hover:bg-[#2D313E] rounded transition-colors"
                aria-label="Save"
              >
                <Save className="w-4 h-4 text-green-400" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-[#2D313E] rounded transition-colors"
                aria-label="Cancel"
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ) : (
            <>
              {/* Action text */}
              <p
                className={cn(
                  'text-sm text-white',
                  completed && 'line-through text-[#6B7280]'
                )}
              >
                {text}
              </p>

              {/* Metadata row */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Priority pill */}
                {priority && priority !== 3 && (
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    currentPriority.classes
                  )}>
                    {currentPriority.label}
                  </span>
                )}

                {/* Meeting source */}
                {meetingTitle && (
                  <span className="text-xs text-[#94A3B8]">
                    From: {meetingTitle}
                  </span>
                )}

                {/* Due date */}
                {dueDate && (
                  <span className="text-xs text-[#94A3B8]">
                    Due: {dueDate}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Edit button - only show on hover and if onEdit is provided */}
        {onEdit && !isEditing && isHovered && !completed && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex-shrink-0 p-1 hover:bg-[#2D313E] rounded transition-colors"
            aria-label="Edit"
          >
            <Edit2 className="w-4 h-4 text-[#94A3B8]" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionItemCard;
