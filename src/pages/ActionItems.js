import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  CheckCircle2,
  Clock,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Star,
  FileText,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export default function ActionItems() {
  const [clients, setClients] = useState([]);
  const [starredMeetings, setStarredMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('action-items'); // 'action-items', 'pending-approval', or 'review-meetings'
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed'
  const [expandedClients, setExpandedClients] = useState(new Set());
  const navigate = useNavigate();

  // Pending approval state
  const [pendingApprovalClients, setPendingApprovalClients] = useState([]);
  const [loadingPendingApproval, setLoadingPendingApproval] = useState(false);
  const [selectedPendingItems, setSelectedPendingItems] = useState([]);
  const [totalPendingApprovalCount, setTotalPendingApprovalCount] = useState(0);

  useEffect(() => {
    fetchActionItems();
    fetchStarredMeetings();
    fetchPendingApprovalItems();
  }, []);

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/action-items/by-client`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch action items');
      }

      const data = await response.json();
      setClients(data.clients || []);

      // Auto-expand clients with pending items
      const clientsWithPending = new Set();
      data.clients?.forEach(client => {
        const hasPending = client.actionItems.some(item => !item.completed);
        if (hasPending) {
          clientsWithPending.add(client.clientId);
        }
      });
      setExpandedClients(clientsWithPending);
    } catch (error) {
      console.error('Error fetching action items:', error);
      setError('Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  const fetchStarredMeetings = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/calendar/meetings/starred`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch starred meetings');
      }

      const data = await response.json();
      setStarredMeetings(data || []);
    } catch (error) {
      console.error('Error fetching starred meetings:', error);
      // Don't show error for starred meetings, just log it
    }
  };

  const fetchPendingApprovalItems = async () => {
    try {
      setLoadingPendingApproval(true);
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending approval items');
      }

      const data = await response.json();
      setPendingApprovalClients(data.clients || []);
      setTotalPendingApprovalCount(data.totalCount || 0);

      // Auto-select all pending items by default
      const allPendingIds = [];
      data.clients?.forEach(client => {
        client.meetings?.forEach(meeting => {
          meeting.pendingItems?.forEach(item => {
            allPendingIds.push(item.id);
          });
        });
      });
      setSelectedPendingItems(allPendingIds);
    } catch (error) {
      console.error('Error fetching pending approval items:', error);
      // Don't show error, just log it
    } finally {
      setLoadingPendingApproval(false);
    }
  };

  const approvePendingItems = async () => {
    if (selectedPendingItems.length === 0) {
      setError('Please select at least one action item to approve');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pendingItemIds: selectedPendingItems })
      });

      if (!response.ok) {
        throw new Error('Failed to approve action items');
      }

      const data = await response.json();

      setSuccess(`Successfully approved ${data.approvedCount} action item${data.approvedCount > 1 ? 's' : ''}!`);
      setTimeout(() => setSuccess(''), 3000);

      // Refresh all data
      await fetchPendingApprovalItems();
      await fetchActionItems();
    } catch (error) {
      console.error('Error approving action items:', error);
      setError('Failed to approve action items');
      setTimeout(() => setError(''), 3000);
    }
  };

  const rejectPendingItems = async () => {
    if (selectedPendingItems.length === 0) {
      setError('Please select at least one action item to reject');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pendingItemIds: selectedPendingItems })
      });

      if (!response.ok) {
        throw new Error('Failed to reject action items');
      }

      const data = await response.json();

      setSuccess(`Rejected ${data.rejectedCount} action item${data.rejectedCount > 1 ? 's' : ''}`);
      setTimeout(() => setSuccess(''), 3000);

      // Refresh pending items
      await fetchPendingApprovalItems();
    } catch (error) {
      console.error('Error rejecting action items:', error);
      setError('Failed to reject action items');
      setTimeout(() => setError(''), 3000);
    }
  };

  const togglePendingItemSelection = (itemId) => {
    setSelectedPendingItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const toggleSelectAllPending = () => {
    const allPendingIds = [];
    pendingApprovalClients.forEach(client => {
      client.meetings?.forEach(meeting => {
        meeting.pendingItems?.forEach(item => {
          allPendingIds.push(item.id);
        });
      });
    });

    if (selectedPendingItems.length === allPendingIds.length) {
      setSelectedPendingItems([]);
    } else {
      setSelectedPendingItems(allPendingIds);
    }
  };

  const toggleActionItem = async (actionItemId) => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/action-items/${actionItemId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle action item');
      }

      const data = await response.json();
      
      // Update local state
      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          actionItems: client.actionItems.map(item =>
            item.id === actionItemId ? data.actionItem : item
          )
        }))
      );

      setSuccess(data.actionItem.completed ? 'Action item completed!' : 'Action item reopened');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error toggling action item:', error);
      setError('Failed to update action item');
      setTimeout(() => setError(''), 3000);
    }
  };

  const toggleClientExpanded = (clientId) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter clients based on selected filter
  const filteredClients = clients.map(client => {
    let filteredItems = client.actionItems;
    
    if (filter === 'pending') {
      filteredItems = client.actionItems.filter(item => !item.completed);
    } else if (filter === 'completed') {
      filteredItems = client.actionItems.filter(item => item.completed);
    }
    
    return {
      ...client,
      actionItems: filteredItems
    };
  }).filter(client => client.actionItems.length > 0);

  // Calculate statistics
  const totalItems = clients.reduce((sum, client) => sum + client.actionItems.length, 0);
  const pendingItems = clients.reduce((sum, client) => 
    sum + client.actionItems.filter(item => !item.completed).length, 0
  );
  const completedItems = totalItems - pendingItems;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading action items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 p-6 bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Action Items</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage action items from client meetings
            </p>
          </div>
          <Button onClick={() => { fetchActionItems(); fetchStarredMeetings(); }} variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setActiveTab('pending-approval')}
            variant={activeTab === 'pending-approval' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Pending Approval
            {totalPendingApprovalCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                {totalPendingApprovalCount}
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => setActiveTab('action-items')}
            variant={activeTab === 'action-items' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Action Items
            {pendingItems > 0 && (
              <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                {pendingItems}
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => setActiveTab('review-meetings')}
            variant={activeTab === 'review-meetings' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2"
          >
            <Star className="w-4 h-4" />
            Review Meetings
            {starredMeetings.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                {starredMeetings.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Statistics - Only show for Action Items tab */}
        {activeTab === 'action-items' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-foreground">{totalItems}</div>
                  <div className="text-xs text-muted-foreground">Total Items</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">{pendingItems}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{completedItems}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </CardContent>
              </Card>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 mt-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All Items
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('completed')}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Button>
            </div>
          </>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="mx-6 mt-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mx-6 mt-4 border-green-200 bg-red-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'pending-approval' ? (
          // Pending Approval Tab Content
          <>
            {loadingPendingApproval ? (
              <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Loading pending items...</p>
                </CardContent>
              </Card>
            ) : totalPendingApprovalCount === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">All Caught Up!</h3>
                  <p className="text-sm text-muted-foreground">
                    No pending action items awaiting approval
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Bulk Action Controls */}
                <div className="mb-4 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {totalPendingApprovalCount} Action Item{totalPendingApprovalCount > 1 ? 's' : ''} Awaiting Approval
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedPendingItems.length} selected • Review and approve AI-extracted action items from your meetings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleSelectAllPending}
                      className="h-8 text-xs"
                    >
                      {selectedPendingItems.length === totalPendingApprovalCount ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button
                      onClick={approvePendingItems}
                      disabled={selectedPendingItems.length === 0}
                      className="bg-green-600 hover:bg-green-700 text-white h-8"
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve Selected ({selectedPendingItems.length})
                    </Button>
                    <Button
                      onClick={rejectPendingItems}
                      disabled={selectedPendingItems.length === 0}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 h-8"
                      size="sm"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject ({selectedPendingItems.length})
                    </Button>
                  </div>
                </div>

                {/* Pending Items by Client */}
                <div className="space-y-4">
                  {pendingApprovalClients.map((client) => (
                    <Card key={client.clientId} className="border-orange-200 bg-orange-50/30">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{client.clientName}</CardTitle>
                            <p className="text-sm text-muted-foreground">{client.clientEmail}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/clients?client=${encodeURIComponent(client.clientEmail)}`)}
                          >
                            <User className="w-4 h-4 mr-1" />
                            View Client
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {client.meetings.map((meeting) => (
                          <div key={meeting.meetingId} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-foreground">{meeting.meetingTitle}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(meeting.meetingStartTime).toLocaleDateString()}
                                </span>
                              </div>
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                {meeting.pendingItems.length} pending
                              </Badge>
                            </div>

                            <div className="space-y-2 pl-6">
                              {meeting.pendingItems.map((item) => (
                                <Card key={item.id} className="border-orange-200 bg-white">
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={selectedPendingItems.includes(item.id)}
                                        onChange={() => togglePendingItemSelection(item.id)}
                                        className="mt-1 w-4 h-4 text-orange-600 border-orange-300 rounded focus:ring-orange-500 cursor-pointer"
                                      />
                                      <div className="flex-1">
                                        <p className="text-sm text-foreground">
                                          {item.actionText}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        ) : activeTab === 'action-items' ? (
          // Action Items Tab Content
          <>
            {filteredClients.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">All Caught Up!</h3>
                  <p className="text-sm text-muted-foreground">
                    {filter === 'pending' ? 'No pending action items' :
                     filter === 'completed' ? 'No completed action items' :
                     'No action items found'}
                  </p>
                </CardContent>
              </Card>
            ) : (
          <div className="space-y-4">
            {filteredClients.map((client) => {
              const isExpanded = expandedClients.has(client.clientId);
              const pendingCount = client.actionItems.filter(item => !item.completed).length;
              const completedCount = client.actionItems.filter(item => item.completed).length;

              return (
                <Card key={client.clientId} className="border-border/50">
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleClientExpanded(client.clientId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{client.clientName}</CardTitle>
                          <p className="text-sm text-muted-foreground">{client.clientEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {pendingCount > 0 && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            {pendingCount} pending
                          </Badge>
                        )}
                        {completedCount > 0 && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {completedCount} completed
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/clients?client=${encodeURIComponent(client.clientEmail)}`);
                          }}
                        >
                          <User className="w-4 h-4 mr-1" />
                          View Client
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {client.actionItems.map((item) => (
                          <div key={item.id} className="border border-border/50 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.completed || false}
                                onChange={() => toggleActionItem(item.id)}
                                className="mt-1 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                              />
                              <div className="flex-1">
                                <p className={`text-sm mb-2 ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {item.actionText}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span
                                      className="cursor-pointer hover:text-primary hover:underline"
                                      onClick={() => navigate(`/meetings?selected=${item.meeting.googleEventId || item.meeting.id}`)}
                                    >
                                      {item.meeting.title}
                                    </span>
                                  </div>
                                  <span>•</span>
                                  <span>{formatDate(item.meeting.startTime)}</span>
                                  {item.completedAt && (
                                    <>
                                      <span>•</span>
                                      <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Completed {formatDate(item.completedAt)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
              </div>
            )}
          </>
        ) : (
          // Review Meetings Tab Content
          <>
            {starredMeetings.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-12 text-center">
                <Star className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Review Meetings</h3>
                <p className="text-sm text-muted-foreground">
                  Star meetings in the Meetings page to flag them for review
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {starredMeetings.map((meeting) => (
                <Card key={meeting.id} className="border-border/50 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <CardTitle className="text-base">{meeting.title}</CardTitle>
                        </div>
                        {meeting.client && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-3 h-3" />
                            <span
                              className="hover:text-primary cursor-pointer"
                              onClick={() => navigate(`/clients/${meeting.client.id}`)}
                            >
                              {meeting.client.name}
                            </span>
                            <span>•</span>
                            <span>{meeting.client.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(meeting.startTime)}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/meetings')}
                        className="ml-2"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        View Meeting
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        {meeting.hasTranscript ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className={meeting.hasTranscript ? 'text-green-600' : 'text-muted-foreground'}>
                          Transcript
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {meeting.hasQuickSummary ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className={meeting.hasQuickSummary ? 'text-green-600' : 'text-muted-foreground'}>
                          Summary
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {meeting.hasEmailSummary ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className={meeting.hasEmailSummary ? 'text-green-600' : 'text-muted-foreground'}>
                          Email Draft
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>Note:</strong> This meeting has been flagged for review.
                        You may need to create custom emails or add specific action items for this client.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

