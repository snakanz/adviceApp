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
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export default function ActionItems() {
  const [clients, setClients] = useState([]);
  const [starredMeetings, setStarredMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('action-items'); // 'action-items' or 'review-meetings'
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed'
  const [expandedClients, setExpandedClients] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetchActionItems();
    fetchStarredMeetings();
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
        {activeTab === 'action-items' ? (
          // Action Items Tab Content
          filteredClients.length === 0 ? (
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
        ) : (
          // Review Meetings Tab Content
          starredMeetings.length === 0 ? (
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
          )
        )}
      </div>
    </div>
  );
}

