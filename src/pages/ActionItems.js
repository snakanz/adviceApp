import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
  AlertCircle,
  Sparkles,
  Filter,
  ArrowUpDown,
  Edit2,
  Save,
  List,
  Users,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

// Priority options for action items
const priorityOptions = [
  { value: 1, label: 'Urgent', icon: '🔴' },
  { value: 2, label: 'High', icon: '🟠' },
  { value: 3, label: 'Medium', icon: '🟡' },
  { value: 4, label: 'Low', icon: '🟢' }
];

export default function ActionItems() {
  const [clients, setClients] = useState([]);
  const [allActionItems, setAllActionItems] = useState([]); // For "All Items" view
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
  const [pendingItemPriorities, setPendingItemPriorities] = useState({}); // { itemId: priority }

  // Priority and filtering state
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all', '1', '2', '3', '4'
  const [sortBy, setSortBy] = useState('date'); // 'date' or 'priority'
  const [viewMode, setViewMode] = useState('by-client'); // 'by-client' or 'all-items'
  const [assigningPriorities, setAssigningPriorities] = useState(false);

  // Inline editing state (for approved items)
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Pending item editing state
  const [editingPendingItemId, setEditingPendingItemId] = useState(null);
  const [editingPendingText, setEditingPendingText] = useState('');
  const [savingPendingEdit, setSavingPendingEdit] = useState(false);

  // Adding new pending item state
  const [addingPendingItem, setAddingPendingItem] = useState(null); // { meetingId, clientId }
  const [newPendingItemText, setNewPendingItemText] = useState('');
  const [newPendingItemPriority, setNewPendingItemPriority] = useState(3);
  const [savingNewPendingItem, setSavingNewPendingItem] = useState(false);

  useEffect(() => {
    fetchActionItems();
    fetchPendingApprovalItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchActionItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, sortBy]);

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Build query params
      const params = new URLSearchParams();
      if (priorityFilter !== 'all') {
        params.append('priorityFilter', priorityFilter);
      }
      if (sortBy === 'priority') {
        params.append('sortBy', 'priority');
      }

      // Fetch by-client view
      const byClientResponse = await fetch(
        `${API_URL}/api/transcript-action-items/action-items/by-client?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!byClientResponse.ok) {
        throw new Error('Failed to fetch action items');
      }

      const byClientData = await byClientResponse.json();
      setClients(byClientData.clients || []);

      // Fetch all items view
      const allItemsResponse = await fetch(
        `${API_URL}/api/transcript-action-items/action-items/all?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (allItemsResponse.ok) {
        const allItemsData = await allItemsResponse.json();
        setAllActionItems(allItemsData.actionItems || []);
      }

      // Auto-expand clients with pending items
      const clientsWithPending = new Set();
      byClientData.clients?.forEach(client => {
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



  const fetchPendingApprovalItems = async () => {
    try {
      setLoadingPendingApproval(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
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

      // Auto-select all pending items by default and initialize priorities
      const allPendingIds = [];
      const priorities = {};
      data.clients?.forEach(client => {
        client.meetings?.forEach(meeting => {
          meeting.pendingItems?.forEach(item => {
            allPendingIds.push(item.id);
            priorities[item.id] = item.priority || 3; // Default to Medium if not set
          });
        });
      });
      setSelectedPendingItems(allPendingIds);
      setPendingItemPriorities(priorities);
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

  const updatePendingItemPriority = async (itemId, priority) => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending/${itemId}/priority`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priority })
      });

      if (!response.ok) {
        throw new Error('Failed to update priority');
      }

      // Update local state
      setPendingItemPriorities(prev => ({
        ...prev,
        [itemId]: priority
      }));
    } catch (error) {
      console.error('Error updating pending item priority:', error);
      setError('Failed to update priority');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Edit pending item text
  const startEditingPendingItem = (item) => {
    setEditingPendingItemId(item.id);
    setEditingPendingText(item.actionText);
  };

  const cancelEditingPendingItem = () => {
    setEditingPendingItemId(null);
    setEditingPendingText('');
  };

  const savePendingItemEdit = async (itemId) => {
    if (!editingPendingText.trim()) {
      setError('Action text cannot be empty');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setSavingPendingEdit(true);
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending/${itemId}/text`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actionText: editingPendingText.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to update pending item');
      }

      setSuccess('Action item updated successfully!');
      setTimeout(() => setSuccess(''), 3000);

      // Refresh pending items
      await fetchPendingApprovalItems();
      setEditingPendingItemId(null);
      setEditingPendingText('');
    } catch (error) {
      console.error('Error updating pending item:', error);
      setError('Failed to update action item');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSavingPendingEdit(false);
    }
  };

  // Add new pending item
  const startAddingPendingItem = (meetingId, clientId) => {
    setAddingPendingItem({ meetingId, clientId });
    setNewPendingItemText('');
    setNewPendingItemPriority(3);
  };

  const cancelAddingPendingItem = () => {
    setAddingPendingItem(null);
    setNewPendingItemText('');
    setNewPendingItemPriority(3);
  };

  const saveNewPendingItem = async () => {
    if (!newPendingItemText.trim()) {
      setError('Action text cannot be empty');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!addingPendingItem) return;

    try {
      setSavingNewPendingItem(true);
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/pending`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meetingId: addingPendingItem.meetingId,
          clientId: addingPendingItem.clientId,
          actionText: newPendingItemText.trim(),
          priority: newPendingItemPriority
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create pending item');
      }

      setSuccess('Action item added successfully!');
      setTimeout(() => setSuccess(''), 3000);

      // Refresh pending items
      await fetchPendingApprovalItems();
      setAddingPendingItem(null);
      setNewPendingItemText('');
      setNewPendingItemPriority(3);
    } catch (error) {
      console.error('Error creating pending item:', error);
      setError('Failed to add action item');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSavingNewPendingItem(false);
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

      // Update local state for by-client view
      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          actionItems: client.actionItems.map(item =>
            item.id === actionItemId ? { ...item, ...data.actionItem } : item
          )
        }))
      );

      // Update local state for all-items view (fixes white screen in all-items mode)
      setAllActionItems(prevItems =>
        prevItems.map(item =>
          item.id === actionItemId ? { ...item, ...data.actionItem } : item
        )
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

  // Inline editing functions
  const startEditing = (item) => {
    setEditingItemId(item.id);
    setEditingText(item.actionText);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingText('');
  };

  const saveEdit = async (actionItemId) => {
    if (!editingText.trim()) {
      setError('Action item text cannot be empty');
      return;
    }

    try {
      setSavingEdit(true);
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${API_URL}/api/transcript-action-items/action-items/${actionItemId}/text`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actionText: editingText.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to update action item');
      }

      const data = await response.json();

      // Update local state for by-client view
      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          actionItems: client.actionItems.map(item =>
            item.id === actionItemId ? { ...item, actionText: data.actionItem.actionText } : item
          )
        }))
      );

      // Update local state for all-items view
      setAllActionItems(prevItems =>
        prevItems.map(item =>
          item.id === actionItemId ? { ...item, actionText: data.actionItem.actionText } : item
        )
      );

      setSuccess('Action item updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      cancelEditing();
    } catch (error) {
      console.error('Error updating action item:', error);
      setError('Failed to update action item');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSavingEdit(false);
    }
  };

  // AI Priority Assignment
  const assignPriorities = async () => {
    try {
      setAssigningPriorities(true);
      setError('');
      const token = localStorage.getItem('jwt');

      const response = await fetch(`${API_URL}/api/transcript-action-items/action-items/assign-priorities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actionItemIds: [] }) // Empty array = process all items
      });

      if (!response.ok) {
        throw new Error('Failed to assign priorities');
      }

      const data = await response.json();
      setSuccess(`Successfully assigned priorities to ${data.updatedCount} action items using AI`);
      setTimeout(() => setSuccess(''), 5000);

      // Refetch action items to get updated priorities
      await fetchActionItems();
    } catch (error) {
      console.error('Error assigning priorities:', error);
      setError('Failed to assign priorities. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setAssigningPriorities(false);
    }
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

  // Priority badge helper
  const getPriorityConfig = (priority) => {
    switch (priority) {
      case 1:
        return { label: 'Urgent', color: 'bg-red-100 text-red-800 border-red-300', icon: '🔴' };
      case 2:
        return { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🟠' };
      case 3:
        return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🟡' };
      case 4:
        return { label: 'Low', color: 'bg-green-100 text-green-800 border-green-300', icon: '🟢' };
      default:
        return { label: 'Medium', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '⚪' };
    }
  };



  const PriorityBadge = ({ priority }) => {
    const config = getPriorityConfig(priority);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
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
          <Button onClick={() => { fetchActionItems(); }} variant="outline" size="sm">
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

            {/* Priority Filters and Controls */}
            <div className="flex items-center justify-between gap-4 mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center gap-3 flex-1">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 border border-border rounded-lg p-1 bg-background">
                  <Button
                    onClick={() => setViewMode('by-client')}
                    variant={viewMode === 'by-client' ? 'default' : 'ghost'}
                    size="sm"
                    className="flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    By Client
                  </Button>
                  <Button
                    onClick={() => setViewMode('all-items')}
                    variant={viewMode === 'all-items' ? 'default' : 'ghost'}
                    size="sm"
                    className="flex items-center gap-1.5"
                  >
                    <List className="w-3.5 h-3.5" />
                    All Items
                  </Button>
                </div>

                {/* Priority Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="1">🔴 Urgent</SelectItem>
                      <SelectItem value="2">🟠 High</SelectItem>
                      <SelectItem value="3">🟡 Medium</SelectItem>
                      <SelectItem value="4">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Toggle */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">By Date</SelectItem>
                      <SelectItem value="priority">By Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Priority Assignment Button */}
              <Button
                onClick={assignPriorities}
                disabled={assigningPriorities || totalItems === 0}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-primary/50 hover:bg-primary/10"
              >
                <Sparkles className={`w-4 h-4 ${assigningPriorities ? 'animate-spin' : ''}`} />
                {assigningPriorities ? 'Assigning...' : 'AI Assign Priorities'}
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
                                <Card key={item.id} className="border-orange-200 bg-white hover:shadow-sm transition-shadow">
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={selectedPendingItems.includes(item.id)}
                                        onChange={() => togglePendingItemSelection(item.id)}
                                        className="mt-1 w-4 h-4 text-orange-600 border-orange-300 rounded focus:ring-orange-500 cursor-pointer"
                                      />
                                      <div className="flex-1 space-y-2">
                                        {editingPendingItemId === item.id ? (
                                          // Edit mode
                                          <div className="space-y-2">
                                            <textarea
                                              value={editingPendingText}
                                              onChange={(e) => setEditingPendingText(e.target.value)}
                                              className="w-full text-sm border border-orange-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                              rows={2}
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.ctrlKey) {
                                                  savePendingItemEdit(item.id);
                                                } else if (e.key === 'Escape') {
                                                  cancelEditingPendingItem();
                                                }
                                              }}
                                            />
                                            <div className="flex items-center gap-2">
                                              <Button
                                                size="sm"
                                                onClick={() => savePendingItemEdit(item.id)}
                                                disabled={savingPendingEdit}
                                                className="h-7 text-xs bg-orange-600 hover:bg-orange-700"
                                              >
                                                {savingPendingEdit ? (
                                                  <>
                                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></div>
                                                    Saving...
                                                  </>
                                                ) : (
                                                  <>
                                                    <Save className="w-3 h-3 mr-1" />
                                                    Save
                                                  </>
                                                )}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={cancelEditingPendingItem}
                                                disabled={savingPendingEdit}
                                                className="h-7 text-xs"
                                              >
                                                <X className="w-3 h-3 mr-1" />
                                                Cancel
                                              </Button>
                                              <span className="text-xs text-muted-foreground ml-2">
                                                Ctrl+Enter to save, Esc to cancel
                                              </span>
                                            </div>
                                          </div>
                                        ) : (
                                          // View mode
                                          <>
                                            <div className="flex items-start justify-between group">
                                              <p className="text-sm text-foreground flex-1">
                                                {item.actionText}
                                              </p>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => startEditingPendingItem(item)}
                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                              >
                                                <Edit2 className="w-3 h-3 text-muted-foreground" />
                                              </Button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-muted-foreground">Priority:</span>
                                              <Select
                                                value={String(pendingItemPriorities[item.id] || 3)}
                                                onValueChange={(value) => updatePendingItemPriority(item.id, parseInt(value))}
                                              >
                                                <SelectTrigger className="w-32 h-7 text-xs">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {priorityOptions.map(option => (
                                                    <SelectItem key={option.value} value={String(option.value)}>
                                                      <span className="flex items-center gap-1">
                                                        <span>{option.icon}</span>
                                                        <span>{option.label}</span>
                                                      </span>
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}

                              {/* Add New Action Item */}
                              {addingPendingItem?.meetingId === meeting.meetingId ? (
                                <Card className="border-orange-300 bg-orange-50/50">
                                  <CardContent className="p-3">
                                    <div className="space-y-2">
                                      <textarea
                                        value={newPendingItemText}
                                        onChange={(e) => setNewPendingItemText(e.target.value)}
                                        placeholder="Enter action item text..."
                                        className="w-full text-sm border border-orange-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        rows={2}
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && e.ctrlKey) {
                                            saveNewPendingItem();
                                          } else if (e.key === 'Escape') {
                                            cancelAddingPendingItem();
                                          }
                                        }}
                                      />
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Priority:</span>
                                        <Select
                                          value={String(newPendingItemPriority)}
                                          onValueChange={(value) => setNewPendingItemPriority(parseInt(value))}
                                        >
                                          <SelectTrigger className="w-32 h-7 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {priorityOptions.map(option => (
                                              <SelectItem key={option.value} value={String(option.value)}>
                                                <span className="flex items-center gap-1">
                                                  <span>{option.icon}</span>
                                                  <span>{option.label}</span>
                                                </span>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          onClick={saveNewPendingItem}
                                          disabled={savingNewPendingItem}
                                          className="h-7 text-xs bg-orange-600 hover:bg-orange-700"
                                        >
                                          {savingNewPendingItem ? (
                                            <>
                                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></div>
                                              Adding...
                                            </>
                                          ) : (
                                            <>
                                              <Plus className="w-3 h-3 mr-1" />
                                              Add
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={cancelAddingPendingItem}
                                          disabled={savingNewPendingItem}
                                          className="h-7 text-xs"
                                        >
                                          <X className="w-3 h-3 mr-1" />
                                          Cancel
                                        </Button>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          Ctrl+Enter to add, Esc to cancel
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startAddingPendingItem(meeting.meetingId, client.clientId)}
                                  className="w-full h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Action Item
                                </Button>
                              )}
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
            {viewMode === 'by-client' ? (
              // By Client View
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
                          <div key={item.id} className="border border-border/50 rounded-lg p-4 hover:border-primary/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.completed || false}
                                onChange={() => toggleActionItem(item.id)}
                                className="mt-1 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                              />
                              <div className="flex-1">
                                {/* Inline Editing */}
                                {editingItemId === item.id ? (
                                  <div className="mb-2">
                                    <input
                                      type="text"
                                      value={editingText}
                                      onChange={(e) => setEditingText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit(item.id);
                                        if (e.key === 'Escape') cancelEditing();
                                      }}
                                      className="w-full px-3 py-2 text-sm border border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                      autoFocus
                                      disabled={savingEdit}
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                      <Button
                                        onClick={() => saveEdit(item.id)}
                                        disabled={savingEdit}
                                        size="sm"
                                        className="h-7"
                                      >
                                        <Save className="w-3 h-3 mr-1" />
                                        {savingEdit ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        onClick={cancelEditing}
                                        disabled={savingEdit}
                                        variant="outline"
                                        size="sm"
                                        className="h-7"
                                      >
                                        <X className="w-3 h-3 mr-1" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="group">
                                    <div className="flex items-start gap-2 mb-2">
                                      <p className={`text-sm flex-1 ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                        {item.actionText}
                                      </p>
                                      {!item.completed && (
                                        <Button
                                          onClick={() => startEditing(item)}
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  {/* Priority Badge */}
                                  {item.priority && <PriorityBadge priority={item.priority} />}

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
            ) : activeTab === 'action-items' ? (
              // All Items View
              <>
                {allActionItems.length === 0 ? (
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
                  <div className="space-y-3">
                    {allActionItems
                      .filter(item => {
                        if (filter === 'pending') return !item.completed;
                        if (filter === 'completed') return item.completed;
                        return true;
                      })
                      .map((item) => (
                        <Card key={item.id} className="border-border/50 hover:border-primary/30 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.completed || false}
                                onChange={() => toggleActionItem(item.id)}
                                className="mt-1 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                              />
                              <div className="flex-1">
                                {/* Inline Editing */}
                                {editingItemId === item.id ? (
                                  <div className="mb-2">
                                    <input
                                      type="text"
                                      value={editingText}
                                      onChange={(e) => setEditingText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit(item.id);
                                        if (e.key === 'Escape') cancelEditing();
                                      }}
                                      className="w-full px-3 py-2 text-sm border border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                      autoFocus
                                      disabled={savingEdit}
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                      <Button
                                        onClick={() => saveEdit(item.id)}
                                        disabled={savingEdit}
                                        size="sm"
                                        className="h-7"
                                      >
                                        <Save className="w-3 h-3 mr-1" />
                                        {savingEdit ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        onClick={cancelEditing}
                                        disabled={savingEdit}
                                        variant="outline"
                                        size="sm"
                                        className="h-7"
                                      >
                                        <X className="w-3 h-3 mr-1" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="group">
                                    <div className="flex items-start gap-2 mb-2">
                                      <p className={`text-sm flex-1 ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                        {item.actionText}
                                      </p>
                                      {!item.completed && (
                                        <Button
                                          onClick={() => startEditing(item)}
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  {/* Priority Badge */}
                                  {item.priority && <PriorityBadge priority={item.priority} />}

                                  {/* Client Info */}
                                  {item.client && (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        <span
                                          className="cursor-pointer hover:text-primary hover:underline"
                                          onClick={() => navigate(`/clients?client=${encodeURIComponent(item.client.email)}`)}
                                        >
                                          {item.client.name}
                                        </span>
                                      </div>
                                      <span>•</span>
                                    </>
                                  )}

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
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </>
          </>
        ) : null}
      </div>
    </div>
  );
}

