import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Checkbox } from '../components/ui/checkbox.jsx';
import {
  CheckCircle2,
  Clock,
  Mail,
  FileText,
  Plus,
  Send,
  AlertCircle,
  Calendar,
  User,
  Trash2,
  Edit3,
  Star
} from 'lucide-react';

export default function ActionItems() {
  const [actionItems, setActionItems] = useState({
    transcriptNeeded: [],
    emailPending: [],
    adHocTasks: [],
    annualReviews: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState({
    transcriptNeeded: [],
    emailPending: [],
    adHocTasks: [],
    annualReviews: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    fetchActionItems();
  }, []);

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/action-items/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch action items');
      }

      const data = await response.json();
      setActionItems(data);
    } catch (error) {
      console.error('Error fetching action items:', error);
      setError('Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelection = (section, itemId, checked) => {
    setSelectedItems(prev => ({
      ...prev,
      [section]: checked
        ? [...prev[section], itemId]
        : prev[section].filter(id => id !== itemId)
    }));
  };

  const handleSelectAll = (section, checked) => {
    setSelectedItems(prev => ({
      ...prev,
      [section]: checked
        ? actionItems[section].map(item => item.item_id)
        : []
    }));
  };

  const handleBulkAction = async (section, action) => {
    if (selectedItems[section].length === 0) {
      setError('Please select items to perform bulk action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/action-items/bulk-actions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          itemIds: selectedItems[section],
          itemType: section === 'adHocTasks' ? 'tasks' : 'meetings'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to perform bulk action');
      }

      setSuccess(`Bulk action completed successfully`);
      setSelectedItems(prev => ({ ...prev, [section]: [] }));
      fetchActionItems(); // Refresh data
    } catch (error) {
      console.error('Error performing bulk action:', error);
      setError('Failed to perform bulk action');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading action items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Action Items</h1>
        <p className="text-muted-foreground">
          Your daily task management center - ensure no client follow-up is missed
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Section 1: Past Meetings Without Transcripts */}
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <FileText className="w-5 h-5" />
              Transcripts Needed
              <Badge className="bg-orange-100 text-orange-800">
                {actionItems.transcriptNeeded.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedItems.transcriptNeeded.length === actionItems.transcriptNeeded.length && actionItems.transcriptNeeded.length > 0}
                onCheckedChange={(checked) => handleSelectAll('transcriptNeeded', checked)}
              />
              <span className="text-muted-foreground">Select All</span>
              {selectedItems.transcriptNeeded.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('transcriptNeeded', 'mark_transcript_not_required')}
                  className="ml-auto"
                >
                  Mark as Not Required
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {actionItems.transcriptNeeded.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>All caught up!</p>
                <p className="text-sm">No meetings need transcripts</p>
              </div>
            ) : (
              actionItems.transcriptNeeded.map((item) => (
                <div key={item.item_id} className="border rounded-lg p-3 hover:bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedItems.transcriptNeeded.includes(item.item_id)}
                      onCheckedChange={(checked) => handleItemSelection('transcriptNeeded', item.item_id, checked)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDate(item.meeting_date)}</span>
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1 mb-1">{item.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit3 className="w-3 h-3 mr-1" />
                      Add Transcript
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground">
                      Not Required
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Section 2: Email Summaries Pending */}
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Mail className="w-5 h-5" />
              Email Summaries Pending
              <Badge className="bg-blue-100 text-blue-800">
                {actionItems.emailPending.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedItems.emailPending.length === actionItems.emailPending.length && actionItems.emailPending.length > 0}
                onCheckedChange={(checked) => handleSelectAll('emailPending', checked)}
              />
              <span className="text-muted-foreground">Select All</span>
              {selectedItems.emailPending.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('emailPending', 'send_emails')}
                  className="ml-auto"
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send Selected
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {actionItems.emailPending.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>All caught up!</p>
                <p className="text-sm">No email summaries pending</p>
              </div>
            ) : (
              actionItems.emailPending.map((item) => (
                <div key={item.item_id} className="border rounded-lg p-3 hover:bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedItems.emailPending.includes(item.item_id)}
                      onCheckedChange={(checked) => handleItemSelection('emailPending', item.item_id, checked)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDate(item.meeting_date)}</span>
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1 mb-1">{item.title}</h4>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>Ready to send summary</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit3 className="w-3 h-3 mr-1" />
                      Review & Edit
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      <Send className="w-3 h-3 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Section 3: Ad-hoc Tasks */}
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Clock className="w-5 h-5" />
              Ad-hoc Tasks
              <Badge className="bg-green-100 text-green-800">
                {actionItems.adHocTasks.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedItems.adHocTasks.length === actionItems.adHocTasks.length && actionItems.adHocTasks.length > 0}
                onCheckedChange={(checked) => handleSelectAll('adHocTasks', checked)}
              />
              <span className="text-muted-foreground">Select All</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Task
              </Button>
              {selectedItems.adHocTasks.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('adHocTasks', 'complete')}
                >
                  Complete Selected
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {actionItems.adHocTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No active tasks</p>
                <p className="text-sm">Create a task to get started</p>
              </div>
            ) : (
              actionItems.adHocTasks.map((item) => (
                <div key={item.item_id} className="border rounded-lg p-3 hover:bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedItems.adHocTasks.includes(item.item_id)}
                      onCheckedChange={(checked) => handleItemSelection('adHocTasks', item.item_id, checked)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getPriorityColor(item.priority_level)}>
                          {item.priority_level}
                        </Badge>
                        {item.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due: {formatDate(item.due_date)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1 mb-1">{item.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit3 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Section 4: Annual Reviews */}
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Star className="w-5 h-5" />
              Annual Reviews
              <Badge className="bg-amber-100 text-amber-800">
                {actionItems.annualReviews.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedItems.annualReviews.length === actionItems.annualReviews.length && actionItems.annualReviews.length > 0}
                onCheckedChange={(checked) => handleSelectAll('annualReviews', checked)}
              />
              <span className="text-muted-foreground">Select All</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {actionItems.annualReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>All caught up!</p>
                <p className="text-sm">All annual reviews completed</p>
              </div>
            ) : (
              actionItems.annualReviews.map((item) => {
                const isOverdue = item.computed_status === 'overdue';
                const isPending = item.computed_status === 'pending';
                const isScheduled = item.computed_status === 'scheduled';

                return (
                  <div key={item.client_id} className={`border rounded-lg p-3 hover:bg-muted/50 ${isOverdue ? 'border-red-300 bg-red-50/50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedItems.annualReviews.includes(item.client_id)}
                        onCheckedChange={(checked) => handleItemSelection('annualReviews', item.client_id, checked)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.client_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            isOverdue ? 'bg-red-100 text-red-800 border-red-200' :
                            isPending ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            isScheduled ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            'bg-green-100 text-green-800 border-green-200'
                          }>
                            {item.computed_status}
                          </Badge>
                          {item.review_date && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.review_date)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.client_email}
                        </p>
                        {item.review_notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.review_notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.location.href = `/clients?client=${encodeURIComponent(item.client_email)}`}
                      >
                        <User className="w-3 h-3 mr-1" />
                        View Client
                      </Button>
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => window.location.href = `/meetings`}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Schedule
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-800">
              {actionItems.transcriptNeeded.length}
            </div>
            <div className="text-sm text-orange-600">Transcripts Needed</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-800">
              {actionItems.emailPending.length}
            </div>
            <div className="text-sm text-blue-600">Emails Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-800">
              {actionItems.adHocTasks.length}
            </div>
            <div className="text-sm text-green-600">Active Tasks</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-800">
              {actionItems.annualReviews.length}
            </div>
            <div className="text-sm text-amber-600">Annual Reviews Due</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

