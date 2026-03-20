import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Calendar,
  Sparkles,
  Building2,
  CheckCircle2,
  X,
  Edit3,
  Plus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  PoundSterling,
  Target,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { cn } from '../lib/utils';
import ActionItemCard from './ActionItemCard';
import InlineChatWidget from './InlineChatWidget';
import ClientDocumentsSection from './ClientDocumentsSection';

// Stage options for business types
const STAGE_OPTIONS = [
  { value: 'Not Written', label: 'Not Written', color: 'bg-gray-500/20 text-gray-300' },
  { value: 'In Progress', label: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'Waiting to Sign', label: 'Waiting to Sign', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'Completed', label: 'Completed', color: 'bg-green-500/20 text-green-400' }
];

const getBusinessTypeColor = (type) => {
  const colors = {
    'Investment': 'bg-blue-500/20 text-blue-400',
    'Insurance': 'bg-green-500/20 text-green-400',
    'Super': 'bg-purple-500/20 text-purple-400',
    'Debt': 'bg-red-500/20 text-red-400',
    'Estate Planning': 'bg-yellow-500/20 text-yellow-400',
    'Tax': 'bg-orange-500/20 text-orange-400',
  };
  return colors[type] || 'bg-gray-500/20 text-gray-300';
};

export default function ClientDetailSidebar({
  // Core
  open,
  onClose,
  selectedClient,
  navigate,

  // Panel sizing - "wide" for Clients page, "narrow" for Pipeline page
  panelWidth = 'wide',

  // Client Summary
  onGenerateSummary,
  generatingSummary = false,

  // Business Types
  onManageBusinessTypes,
  onEditPipeline,

  // Next Steps to Close (pipeline feature)
  nextStepsSummary,
  generatingNextSteps = false,

  // Pipeline Notes
  pipelineNotes: pipelineNotesProp,
  editingNotes: editingNotesProp,
  onStartEditNotes,
  onSaveNotes,
  onCancelEditNotes,
  onNotesChange,
  savingNotes = false,

  // Business Types with Stage (pipeline feature)
  businessTypesWithStage,
  onStageChange,
  formatCurrency,

  // Action Items (Clients page pattern - meetings with nested items + todos)
  clientActionItems,
  clientTodos,
  onToggleActionItem,
  onToggleTodo,
  newActionItemText,
  onNewActionItemTextChange,
  onAddActionItem,
  addingActionItem = false,
  loadingActionItems = false,

  // Secondary sections (Clients page features)
  showSecondarySection = true,

  // Edit client
  onEditClient,

  // Helper functions passed from parent
  getUserInitials,
  formatDate: formatDateProp,
  isMeetingComplete,
  navigateToMeeting,
}) {
  // Internal collapsible states
  const [showActionItems, setShowActionItems] = useState(true);
  const [meetingHistoryCollapsed, setMeetingHistoryCollapsed] = useState(true);
  const [askAdviclyCollapsed, setAskAdviclyCollapsed] = useState(true);
  const [documentsCollapsed, setDocumentsCollapsed] = useState(true);

  if (!open || !selectedClient) return null;

  const clientId = selectedClient.id || selectedClient.clientId;
  const clientName = selectedClient.name || selectedClient.email || 'Unnamed Client';
  const clientEmail = selectedClient.email || '';

  // Derive initials
  const initials = getUserInitials
    ? getUserInitials(selectedClient.name, selectedClient.email)
    : (clientName || 'C').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Derive KPI data - handle both Clients and Pipeline data shapes
  const businessTypesData = selectedClient.business_types_data || [];
  const activeBusinessTypes = businessTypesData.filter(bt => !bt.not_proceeding);
  const businessTypesCount = activeBusinessTypes.length || 0;

  const expectedFees = businessTypesData.reduce((sum, bt) => {
    if (bt.not_proceeding) return sum;
    return sum + (parseFloat(bt.iaf_expected) || 0);
  }, 0) || parseFloat(selectedClient.expectedValue) || parseFloat(selectedClient.totalIafExpected) || 0;

  const nextCloseDate = (() => {
    const dates = businessTypesData
      ?.filter(bt => bt.expected_close_date && !bt.not_proceeding)
      .map(bt => new Date(bt.expected_close_date))
      .sort((a, b) => a - b);
    if (dates && dates.length > 0) {
      return dates[0].toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    }
    return '—';
  })();

  const meetingsCount = selectedClient.meeting_count || selectedClient.pastMeetingCount || 0;

  // Action items counts (handle both data shapes)
  const getPendingCount = () => {
    if (clientTodos && clientActionItems) {
      // Clients page pattern
      const todoPending = clientTodos?.filter(t => t.status !== 'completed').length || 0;
      const actionPending = clientActionItems?.reduce((sum, m) => {
        if (m.actionItems) return sum + m.actionItems.filter(i => !i.completed).length;
        return sum;
      }, 0) || 0;
      return todoPending + actionPending;
    }
    if (clientActionItems && Array.isArray(clientActionItems)) {
      // Pipeline page pattern (flat array)
      return clientActionItems.filter(item => !item.completed).length;
    }
    return 0;
  };

  const getCompletedCount = () => {
    if (clientTodos && clientActionItems) {
      const todoCompleted = clientTodos?.filter(t => t.status === 'completed').length || 0;
      const actionCompleted = clientActionItems?.reduce((sum, m) => {
        if (m.actionItems) return sum + m.actionItems.filter(i => i.completed).length;
        return sum;
      }, 0) || 0;
      return todoCompleted + actionCompleted;
    }
    if (clientActionItems && Array.isArray(clientActionItems)) {
      return clientActionItems.filter(item => item.completed).length;
    }
    return 0;
  };

  // Check if action items are in "meetings with nested items" format (Clients) vs flat array (Pipeline)
  const isMeetingsFormat = clientActionItems && clientActionItems.length > 0 && clientActionItems[0]?.actionItems;

  const widthClass = panelWidth === 'wide'
    ? 'w-full lg:w-[45%] xl:w-[40%]'
    : 'w-full max-w-md lg:w-[45%] xl:w-[40%]';

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Detail Panel */}
      <div className={`fixed right-0 top-0 h-full ${widthClass} bg-card border-l border-border shadow-xl z-50 overflow-hidden flex flex-col`}>
        {/* Panel Header */}
        <div className="sticky top-0 bg-background border-b border-border/50 p-4 sm:p-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 text-primary flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-base sm:text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                {clientName}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {clientEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEditClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditClient(selectedClient)}
              >
                <Edit3 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
            {onEditPipeline && (
              <Button
                size="sm"
                onClick={() => onEditPipeline(selectedClient)}
              >
                <Edit3 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit Pipeline</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Panel Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Client Summary Card */}
          <Card className="border-0 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/20 rounded-lg">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90">Client Summary</h3>
                </div>
                {onGenerateSummary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onGenerateSummary(clientId)}
                    disabled={generatingSummary}
                    className="h-7 text-xs text-white/70 hover:text-white hover:bg-white/10"
                  >
                    {generatingSummary ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        {selectedClient.ai_summary ? 'Regenerate' : 'Generate'}
                      </>
                    )}
                  </Button>
                )}
              </div>
              {selectedClient.ai_summary ? (
                <p className="text-sm text-white/80 leading-relaxed">
                  {selectedClient.ai_summary}
                </p>
              ) : (
                <p className="text-sm text-white/50 italic">
                  Click "Generate" to create an AI-powered client summary from meeting history and business data.
                </p>
              )}
            </CardContent>
          </Card>

          {/* KPI Blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-muted-foreground">Business Types</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {businessTypesCount}
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <PoundSterling className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-muted-foreground">Expected Fees</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                £{expectedFees.toLocaleString()}
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs text-muted-foreground">Next Close</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {nextCloseDate}
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs text-muted-foreground">Meetings</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {meetingsCount}
              </div>
              {selectedClient.has_upcoming_meetings && (
                <div className="text-xs text-green-600 mt-0.5">
                  {selectedClient.upcoming_meetings_count} upcoming
                </div>
              )}
            </div>
          </div>

          {/* Business Details Card */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Business Details</h3>
                </div>
                <div className="flex items-center gap-1">
                  {onEditPipeline && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditPipeline(selectedClient)}
                      className="h-7 text-xs"
                    >
                      <Edit3 className="w-3 h-3 mr-1.5" />
                      Edit Pipeline
                    </Button>
                  )}
                  {onManageBusinessTypes && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onManageBusinessTypes(selectedClient)}
                      className="h-7 text-xs"
                    >
                      <Edit3 className="w-3 h-3 mr-1.5" />
                      Manage
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-4">
                {businessTypesData.length > 0 ? (
                  <div className="space-y-3">
                    {businessTypesData.map((bt, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${bt.not_proceeding ? 'bg-muted/30 border-border/30 opacity-60' : 'bg-muted/50 border-border/50'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
                              onClick={() => navigate && navigate(`/pipeline?businessType=${encodeURIComponent(bt.business_type)}`)}
                              title={`View ${bt.business_type} in Pipeline`}
                            >
                              {bt.business_type}
                            </span>
                            {bt.not_proceeding && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                                Not Proceeding
                              </span>
                            )}
                          </div>
                          {bt.expected_close_date && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(bt.expected_close_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4">
                          {bt.iaf_expected && (
                            <div>
                              <span className="text-xs text-muted-foreground">Fees</span>
                              <div className="text-sm font-semibold text-foreground">
                                £{parseFloat(bt.iaf_expected).toLocaleString()}
                              </div>
                            </div>
                          )}
                          {bt.business_type === 'Investment' && bt.business_amount && (
                            <div>
                              <span className="text-xs text-muted-foreground">Investment</span>
                              <div className="text-sm font-semibold text-foreground">
                                £{parseFloat(bt.business_amount).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                        {bt.notes && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{bt.notes}</p>
                        )}
                        {bt.not_proceeding && bt.not_proceeding_reason && (
                          <p className="text-xs text-orange-600 mt-2">Reason: {bt.not_proceeding_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Building2 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">No business types configured</p>
                    {onManageBusinessTypes && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onManageBusinessTypes(selectedClient)}
                      >
                        <Plus className="w-3 h-3 mr-1.5" />
                        Add Business Type
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Steps to Close (AI) - shown when data available */}
          {(nextStepsSummary || generatingNextSteps) && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    Next Steps to Close
                    {generatingNextSteps && (
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    )}
                  </h4>
                  {generatingNextSteps ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-blue-200/50 dark:bg-blue-800/30 rounded animate-pulse" />
                      <div className="h-3 bg-blue-200/50 dark:bg-blue-800/30 rounded animate-pulse w-5/6" />
                      <div className="h-3 bg-blue-200/50 dark:bg-blue-800/30 rounded animate-pulse w-4/6" />
                    </div>
                  ) : (
                    <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                      {nextStepsSummary}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Notes - shown when pipeline context available */}
          {(onSaveNotes || pipelineNotesProp !== undefined) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Notes</label>
                {!editingNotesProp && onStartEditNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onStartEditNotes}
                    className="h-6 px-2 text-xs"
                  >
                    <Edit3 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              {editingNotesProp ? (
                <div className="space-y-2">
                  <textarea
                    value={pipelineNotesProp}
                    onChange={(e) => onNotesChange && onNotesChange(e.target.value)}
                    className="w-full p-3 bg-background border border-border rounded-lg min-h-[100px] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Add notes about this pipeline opportunity..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCancelEditNotes}
                      disabled={savingNotes}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSaveNotes}
                      disabled={savingNotes}
                    >
                      {savingNotes ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 border border-border rounded-lg min-h-[80px]">
                  <p className={cn("text-sm whitespace-pre-wrap", pipelineNotesProp ? "text-foreground" : "text-muted-foreground italic")}>
                    {pipelineNotesProp || selectedClient.pipelineNotes || 'No notes added yet. Click Edit to add notes.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Business Types & Stages - shown when pipeline stage data available */}
          {businessTypesWithStage && businessTypesWithStage.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Business Types & Stages</label>
              <div className="mt-1 p-3 bg-background border border-border rounded-md text-sm">
                <div className="space-y-3">
                  {businessTypesWithStage.map((bt, index) => (
                    <div key={bt.id || index} className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg">
                      <Badge className={getBusinessTypeColor(bt.business_type)}>
                        {bt.business_type}
                      </Badge>
                      {onStageChange ? (
                        <Select
                          value={bt.stage || 'Not Written'}
                          onValueChange={(value) => onStageChange(bt.id, value)}
                        >
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-xs",
                                bt.stage === 'Signed' ? 'bg-yellow-500/20 text-yellow-400' :
                                STAGE_OPTIONS.find(opt => opt.value === bt.stage)?.color || 'bg-gray-500/20 text-gray-300'
                              )}>
                                {bt.stage || 'Not Written'}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <span className={cn("px-2 py-0.5 rounded text-xs", option.color)}>
                                  {option.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">{bt.stage || 'No stage set'}</span>
                      )}
                    </div>
                  ))}
                  {selectedClient.totalBusinessAmount > 0 && (
                    <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                      Total Amount: {formatCurrency ? formatCurrency(selectedClient.totalBusinessAmount) : `£${selectedClient.totalBusinessAmount.toLocaleString()}`}
                    </div>
                  )}
                  {selectedClient.totalIafExpected > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Total Expected Fees: {formatCurrency ? formatCurrency(selectedClient.totalIafExpected) : `£${selectedClient.totalIafExpected.toLocaleString()}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Items - Unified Dark Theme */}
          <div className="bg-[#1A1C23] border border-[#2D313E] rounded-lg">
            <button
              onClick={() => setShowActionItems(!showActionItems)}
              className="w-full p-4 flex items-center justify-between hover:bg-[#252830] transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-semibold text-white">Action Items</h4>
                  {loadingActionItems ? (
                    <p className="text-xs text-[#94A3B8]">Loading...</p>
                  ) : (
                    <p className="text-xs text-[#94A3B8]">
                      {getPendingCount()} pending, {getCompletedCount()} complete
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={cn(
                "w-5 h-5 text-[#94A3B8] transition-transform",
                showActionItems && "transform rotate-180"
              )} />
            </button>

            {showActionItems && (
              <div className="p-4 pt-0 space-y-2">
                {loadingActionItems ? (
                  <div className="space-y-2">
                    <div className="h-16 bg-[#252830] rounded-lg animate-pulse" />
                    <div className="h-16 bg-[#252830] rounded-lg animate-pulse" />
                  </div>
                ) : isMeetingsFormat ? (
                  <>
                    {/* Clients page pattern: todos + meetings with nested action items */}
                    {clientTodos?.filter(t => t.status !== 'completed').map((todo) => (
                      <ActionItemCard
                        key={todo.id}
                        id={todo.id}
                        text={todo.title}
                        completed={false}
                        priority={3}
                        onToggle={() => onToggleTodo && onToggleTodo(todo.id, todo.status)}
                      />
                    ))}
                    {clientActionItems?.map(meeting =>
                      meeting.actionItems.filter(item => !item.completed).map((item) => (
                        <ActionItemCard
                          key={item.id}
                          id={item.id}
                          text={item.actionText}
                          completed={false}
                          priority={item.priority || 3}
                          meetingTitle={meeting.meetingTitle}
                          onToggle={() => onToggleActionItem && onToggleActionItem(item.id, item.completed)}
                        />
                      ))
                    )}
                    {clientTodos?.filter(t => t.status === 'completed').map((todo) => (
                      <ActionItemCard
                        key={todo.id}
                        id={todo.id}
                        text={todo.title}
                        completed={true}
                        priority={3}
                        onToggle={() => onToggleTodo && onToggleTodo(todo.id, todo.status)}
                      />
                    ))}
                    {clientActionItems?.map(meeting =>
                      meeting.actionItems.filter(item => item.completed).map((item) => (
                        <ActionItemCard
                          key={item.id}
                          id={item.id}
                          text={item.actionText}
                          completed={true}
                          priority={item.priority || 3}
                          meetingTitle={meeting.meetingTitle}
                          onToggle={() => onToggleActionItem && onToggleActionItem(item.id, item.completed)}
                        />
                      ))
                    )}
                    {clientTodos?.length === 0 && (!clientActionItems || clientActionItems.length === 0 || !clientActionItems.some(m => m.actionItems.length > 0)) && (
                      <p className="text-sm text-[#94A3B8] italic text-center py-4">
                        No action items for this client yet.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {/* Pipeline page pattern: flat array */}
                    {clientActionItems && clientActionItems.length > 0 ? (
                      <>
                        {clientActionItems.filter(item => !item.completed).map(item => (
                          <ActionItemCard
                            key={item.id}
                            id={item.id}
                            text={item.action_item_text || item.title}
                            completed={false}
                            priority={item.priority || 3}
                            meetingTitle={item.meeting_title}
                            onToggle={() => onToggleActionItem && onToggleActionItem(item.id, false)}
                          />
                        ))}
                        {clientActionItems.filter(item => item.completed).map(item => (
                          <ActionItemCard
                            key={item.id}
                            id={item.id}
                            text={item.action_item_text || item.title}
                            completed={true}
                            priority={item.priority || 3}
                            meetingTitle={item.meeting_title}
                            onToggle={() => onToggleActionItem && onToggleActionItem(item.id, true)}
                          />
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-[#94A3B8] italic text-center py-4">
                        No action items for this client yet.
                      </p>
                    )}
                  </>
                )}

                {/* Add Action Item */}
                {onAddActionItem && (
                  <div className="bg-[#252830] rounded-lg p-3 mt-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add new action item..."
                        value={newActionItemText || ''}
                        onChange={(e) => onNewActionItemTextChange && onNewActionItemTextChange(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && onAddActionItem()}
                        className="flex-1 h-9 text-sm bg-[#1A1C23] border-[#3D414E] text-white placeholder:text-[#6B7280]"
                      />
                      <Button
                        onClick={onAddActionItem}
                        disabled={!(newActionItemText || '').trim() || addingActionItem}
                        size="sm"
                        className="h-9 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {addingActionItem ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* View All Action Items link */}
                <button
                  onClick={() => navigate && navigate(`/action-items${clientId ? `?clientId=${clientId}` : ''}`)}
                  className="w-full mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium text-center py-2 hover:bg-[#252830] rounded transition-colors"
                >
                  View All Action Items →
                </button>
              </div>
            )}
          </div>

          {/* Secondary Sections (from Clients page) */}
          {showSecondarySection && (
            <>
              {/* Ask Advicly - Collapsible */}
              <Card className="border-border/50">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setAskAdviclyCollapsed(!askAdviclyCollapsed)}
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Ask Advicly</h3>
                  </div>
                  {askAdviclyCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                {!askAdviclyCollapsed && (
                  <div className="border-t border-border/50">
                    <div className="h-[350px] overflow-hidden">
                      <InlineChatWidget
                        contextType="client"
                        contextData={{
                          clientId: clientId,
                          clientName: selectedClient.name,
                          clientEmail: selectedClient.email,
                          meetingCount: selectedClient.meetings?.length || selectedClient.pastMeetingCount || 0,
                          pipelineStatus: selectedClient.pipeline_stage || 'Unknown',
                          likelyValue: selectedClient.likely_value || 0
                        }}
                        clientId={clientId}
                        clientName={selectedClient.name}
                      />
                    </div>
                  </div>
                )}
              </Card>

              {/* Meeting History - Collapsible */}
              {selectedClient.meetings && (
                <Card className="border-border/50">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setMeetingHistoryCollapsed(!meetingHistoryCollapsed)}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Meeting History</h3>
                      {selectedClient.meetings.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({selectedClient.meetings.length})
                        </span>
                      )}
                    </div>
                    {meetingHistoryCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  {!meetingHistoryCollapsed && (
                    <div className="border-t border-border/50 p-4">
                      {selectedClient.meetings.length > 0 ? (
                        <div className="space-y-3">
                          {selectedClient.meetings
                            .sort((a, b) => new Date(b.starttime) - new Date(a.starttime))
                            .map(meeting => {
                              const meetingAI = clientActionItems?.find?.(m => m.meetingId === meeting.id);
                              const pendingItems = meetingAI?.actionItems?.filter(item => !item.completed) || [];
                              const completedItems = meetingAI?.actionItems?.filter(item => item.completed) || [];

                              return (
                                <div
                                  key={meeting.id}
                                  className="p-3 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors cursor-pointer"
                                  onClick={() => navigateToMeeting && navigateToMeeting(meeting.googleeventid || meeting.id)}
                                >
                                  <div className="flex items-start justify-between mb-1">
                                    <h4 className="text-sm font-medium text-foreground hover:text-primary">
                                      {meeting.title}
                                    </h4>
                                    {isMeetingComplete && isMeetingComplete(meeting) && (
                                      <div className="flex items-center gap-1 text-blue-600">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span className="text-xs">Complete</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mb-2">
                                    {formatDateProp ? formatDateProp(meeting.starttime) : new Date(meeting.starttime).toLocaleDateString()} • {new Date(meeting.starttime).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                  {meeting.quick_summary && (
                                    <p className="text-xs text-foreground/80 line-clamp-2 mb-2">
                                      {meeting.quick_summary}
                                    </p>
                                  )}
                                  {meetingAI && meetingAI.actionItems.length > 0 && (
                                    <div className="flex items-center gap-2 text-xs">
                                      {pendingItems.length > 0 && (
                                        <span className="text-orange-600">{pendingItems.length} pending</span>
                                      )}
                                      {completedItems.length > 0 && (
                                        <span className="text-green-600">{completedItems.length} done</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Calendar className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">No meetings found</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* Documents Section - Collapsible */}
              <Card className="border-border/50">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setDocumentsCollapsed(!documentsCollapsed)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Documents</h3>
                  </div>
                  {documentsCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                {!documentsCollapsed && (
                  <div className="border-t border-border/50 p-4">
                    <ClientDocumentsSection
                      clientId={clientId}
                      clientName={selectedClient.name}
                      meetings={selectedClient.meetings || []}
                    />
                  </div>
                )}
              </Card>
            </>
          )}

          {/* Close button for mobile */}
          <div className="pt-4 border-t border-border space-y-3 lg:hidden">
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full"
            >
              Close Details
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
