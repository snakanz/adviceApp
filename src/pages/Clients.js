import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { useDebounce } from '../hooks/useDebounce';
import {
  Search,
  Calendar,
  Sparkles,
  Clock,
  Users,
  Building2,
  CheckCircle2,
  X,
  Edit3,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  PoundSterling,
  Target,
  MessageCircle,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BusinessTypeManager from '../components/BusinessTypeManager';
import CreateClientForm from '../components/CreateClientForm';
import ClientDocumentsSection from '../components/ClientDocumentsSection';
import InlineChatWidget from '../components/InlineChatWidget';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const debouncedSearch = useDebounce(search, 300);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    pipeline_stage: '',
    business_type: '',
    iaf_expected: '',
    business_amount: '',
    regular_contribution_type: '',
    regular_contribution_amount: '',
    likely_close_month: ''
  });
  const [saving, setSaving] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [clientFilter, setClientFilter] = useState('all'); // 'all', 'with-upcoming', 'no-upcoming'
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // Sorting state
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false); // NEW: Separate state for Edit Client Details modal
  const [showBusinessTypeManager, setShowBusinessTypeManager] = useState(false);
  const [clientBusinessTypes, setClientBusinessTypes] = useState([]);
  const [savingBusinessTypes, setSavingBusinessTypes] = useState(false);
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [clientActionItems, setClientActionItems] = useState([]);
  const [clientTodos, setClientTodos] = useState([]);
  const [newActionItemText, setNewActionItemText] = useState('');
  const [addingActionItem, setAddingActionItem] = useState(false);
  const [meetingHistoryCollapsed, setMeetingHistoryCollapsed] = useState(true); // Default collapsed
  const [askAdviclyCollapsed, setAskAdviclyCollapsed] = useState(true); // Default collapsed
  const [documentsCollapsed, setDocumentsCollapsed] = useState(true); // Default collapsed
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();



  // Helper function to show success message
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Generate AI summary for client
  const handleGenerateSummary = async (clientId) => {
    setGeneratingSummary(true);
    try {
      const response = await api.request(`/clients/${clientId}/generate-summary`, {
        method: 'POST'
      });

      if (response.summary) {
        // Update the selected client with the new summary
        setSelectedClient(prev => ({
          ...prev,
          ai_summary: response.summary
        }));

        // Also update in the clients list
        setClients(prev => prev.map(c =>
          c.id === clientId ? { ...c, ai_summary: response.summary } : c
        ));

        showSuccess('AI summary generated successfully!');
      } else {
        showSuccess(response.message || 'No content available to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      showSuccess('Failed to generate summary. Please try again.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Helper function to navigate to meetings page with specific meeting selected
  const navigateToMeeting = (meetingId) => {
    navigate(`/meetings?selected=${meetingId}`);
  };

  // Helper function to check if meeting is complete (has transcript + summaries)
  const isMeetingComplete = (meeting) => {
    return meeting.transcript &&
           meeting.quick_summary &&
           meeting.email_summary_draft;
  };

  // Fetch action items for a client
  const fetchClientActionItems = async (clientId) => {
    if (!clientId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/transcript-action-items/clients/${clientId}/action-items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch action items');
      }

      const data = await response.json();
      setClientActionItems(data.meetings || []);
    } catch (error) {
      console.error('Error fetching client action items:', error);
      setClientActionItems([]);
    }
  };

  // Toggle action item completion
  const toggleActionItemCompletion = async (actionItemId, currentCompleted) => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com'}/api/transcript-action-items/action-items/${actionItemId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle action item');
      }

      // Refresh action items after toggle
      if (selectedClient?.id) {
        await fetchClientActionItems(selectedClient.id);
      }
    } catch (error) {
      console.error('Error toggling action item:', error);
    }
  };

  // Fetch client todos (standalone action items)
  const fetchClientTodos = async (clientId) => {
    if (!clientId) return;

    try {
      const todos = await api.request(`/pipeline/client/${clientId}/todos`);
      setClientTodos(todos || []);
    } catch (error) {
      console.error('Error fetching client todos:', error);
      setClientTodos([]);
    }
  };

  // Create a new action item (todo) for a client
  const handleAddActionItem = async () => {
    if (!selectedClient?.id || !newActionItemText.trim()) return;

    setAddingActionItem(true);
    try {
      await api.request(`/pipeline/client/${selectedClient.id}/todos`, {
        method: 'POST',
        body: JSON.stringify({
          title: newActionItemText.trim(),
          category: 'action_item'
        })
      });

      // Clear input and refresh todos
      setNewActionItemText('');
      await fetchClientTodos(selectedClient.id);
      showSuccess('Action item added!');
    } catch (error) {
      console.error('Error adding action item:', error);
      showSuccess('Failed to add action item');
    } finally {
      setAddingActionItem(false);
    }
  };

  // Toggle todo completion
  const toggleTodoCompletion = async (todoId, currentStatus) => {
    try {
      await api.request(`/pipeline/todos/${todoId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: currentStatus === 'completed' ? 'pending' : 'completed'
        })
      });

      // Refresh todos after toggle
      if (selectedClient?.id) {
        await fetchClientTodos(selectedClient.id);
      }
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  // Extract clients from meeting attendees
  const handleExtractClients = async () => {
    setExtracting(true);
    try {
      const response = await api.extractClientsFromMeetings();

      console.log('Client extraction result:', response);

      // Refresh the clients list
      await fetchClients(clientFilter);

      // Show success message
      alert(`Client extraction completed! ${response.linked} meetings linked, ${response.clientsCreated} new clients created.`);

    } catch (error) {
      console.error('Client extraction failed:', error);
      alert('Failed to extract clients. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const fetchClients = useCallback(async (filter = 'all') => {
    setLoading(true);
    try {
      const endpoint = filter === 'all' ? '/clients' : `/clients?filter=${filter}`;
      const data = await api.request(endpoint);
      setClients(data);
      setSelectedClient(null); // Clear selection when data refreshes
    } catch (err) {
      setError(err.message);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients(clientFilter);
  }, [fetchClients, clientFilter]);



  // Handle URL parameters for client selection
  useEffect(() => {
    const clientParam = searchParams.get('client');

    if (clientParam && clients.length > 0) {
      const client = clients.find(c => c.email === clientParam);
      if (client) {
        setSelectedClient(client);
        setDetailPanelOpen(true);
      }
    }
  }, [searchParams, clients]);

  // Refresh when page becomes visible (user switches back to tab)
  // Removed 30-second polling - relying on webhooks for real-time updates
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📱 Page visible - refreshing clients...');
        fetchClients(clientFilter);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchClients, clientFilter]);

  // Fetch action items and todos when client is selected
  // Also auto-generate summary if client has data but no summary (like pipeline pattern)
  // Note: We intentionally only depend on selectedClient.id to avoid re-running on every state change
  useEffect(() => {
    if (selectedClient?.id) {
      fetchClientActionItems(selectedClient.id);
      fetchClientTodos(selectedClient.id);

      // Auto-generate client summary if:
      // 1. Client has no AI summary yet
      // 2. Client has meetings or business types (data to summarize)
      // 3. Not already generating
      const hasMeetings = selectedClient.meeting_count > 0 || selectedClient.meetings?.length > 0;
      const hasBusinessTypes = selectedClient.business_types_data?.length > 0;
      const hasNoSummary = !selectedClient.ai_summary;

      if (hasNoSummary && (hasMeetings || hasBusinessTypes) && !generatingSummary) {
        // Small delay to avoid UI flash
        const autoGenerateTimer = setTimeout(() => {
          handleGenerateSummary(selectedClient.id);
        }, 500);
        return () => clearTimeout(autoGenerateTimer);
      }
    } else {
      setClientActionItems([]);
      setClientTodos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?.id]);

  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sortable value from client
  const getSortValue = (client, key) => {
    switch (key) {
      case 'name':
        return (client.name || client.email || '').toLowerCase();
      case 'email':
        return (client.email || '').toLowerCase();
      case 'pipeline_stage':
        return (client.pipeline_stage || '').toLowerCase();
      case 'business_types':
        return (client.businessTypesDisplay || 'Not Set').toLowerCase();
      case 'iaf_expected':
        return parseFloat(client.totalIafExpected || client.iaf_expected || 0);
      case 'business_amount':
        return parseFloat(client.totalBusinessAmount || client.business_amount || 0);
      case 'expected_close_date':
        // Get earliest expected close date from business types
        const businessTypes = client.business_types_data || [];
        const dates = businessTypes
          .filter(bt => bt.expected_close_date)
          .map(bt => new Date(bt.expected_close_date).getTime());
        return dates.length > 0 ? Math.min(...dates) : (client.likely_close_month ? new Date(client.likely_close_month).getTime() : 0);
      case 'last_meeting_date':
        return client.last_meeting_date ? new Date(client.last_meeting_date).getTime() : 0;
      case 'meeting_count':
        return parseInt(client.meeting_count || 0);
      case 'next_meeting': {
        // Get next meeting date for sorting
        if (!client.meetings || client.meetings.length === 0) return Infinity; // No meetings = sort to end
        const now = new Date();
        const upcomingMeetings = client.meetings
          .filter(meeting => new Date(meeting.starttime) > now)
          .sort((a, b) => new Date(a.starttime) - new Date(b.starttime));
        return upcomingMeetings.length > 0 ? new Date(upcomingMeetings[0].starttime).getTime() : Infinity;
      }
      default:
        return '';
    }
  };

  const filteredClients = clients
    .filter(c => (`${c.name || c.email || ''}`).toLowerCase().includes(debouncedSearch.toLowerCase()))
    .sort((a, b) => {
      if (!sortConfig.key) return 0;

      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

  // Helper function to get next meeting date
  const getNextMeetingDate = (client) => {
    if (!client.meetings || client.meetings.length === 0) return null;

    const now = new Date();
    const upcomingMeetings = client.meetings
      .filter(meeting => new Date(meeting.starttime) > now)
      .sort((a, b) => new Date(a.starttime) - new Date(b.starttime));

    return upcomingMeetings.length > 0 ? upcomingMeetings[0].starttime : null;
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };



  // Helper function to handle client row click
  const handleClientClick = (client) => {
    setSelectedClient(client);
    setDetailPanelOpen(true);
  };



  const getUserInitials = (name, email) => {
    const displayName = name || email;
    if (!displayName) return 'C';
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Add/remove email fields
  // Email management functions (currently unused but kept for future multi-email support)
  // const addEmailField = () => setEditForm(f => ({ ...f, emails: [...(f.emails || ['']), ''] }));
  // const removeEmailField = idx => setEditForm(f => ({ ...f, emails: f.emails.filter((_, i) => i !== idx) }));
  // const handleEmailChange = (idx, value) => setEditForm(f => ({ ...f, emails: f.emails.map((e, i) => i === idx ? value : e) }));

  const handleEditClient = async (client) => {
    try {
      // Fetch fresh client data from the server to ensure we have the latest values
      const freshClient = await api.request(`/clients/${client.id}`);

      setEditingClient(freshClient);
      setEditForm({
        name: freshClient.name || '',
        email: freshClient.email || '',
        date_of_birth: freshClient.date_of_birth || '',
        gender: freshClient.gender || ''
      });
    } catch (err) {
      // Fallback to the passed client if fetch fails
      console.error('Error fetching fresh client data:', err);
      setEditingClient(client);
      setEditForm({
        name: client.name || '',
        email: client.email || '',
        date_of_birth: client.date_of_birth || '',
        gender: client.gender || ''
      });
    }

    // Open the Edit Client Details modal
    setShowEditClientModal(true);
  };

  const handleEditBusinessTypes = async (client) => {
    setEditingClient(client);
    try {
      const businessTypes = await api.request(`/clients/${client.id}/business-types`);
      setClientBusinessTypes(businessTypes);
      setShowBusinessTypeManager(true);
    } catch (error) {
      console.error('Error loading business types:', error);
      setClientBusinessTypes([]);
      setShowBusinessTypeManager(true);
    }
  };

  const handleSaveBusinessTypes = async (businessTypes) => {
    if (!editingClient) return;

    const clientIdToRegenerate = editingClient.id;
    setSavingBusinessTypes(true);
    try {
      await api.request(`/clients/${editingClient.id}/business-types`, {
        method: 'PUT',
        body: JSON.stringify({ businessTypes })
      });

      // Refresh clients list to show updated data
      await fetchClients();

      setShowBusinessTypeManager(false);
      setEditingClient(null);
      setClientBusinessTypes([]);

      // Show success message
      showSuccess('Business types updated successfully!');

      // Auto-regenerate client summary since business data changed (like pipeline pattern)
      // This ensures the summary reflects the latest business information
      handleGenerateSummary(clientIdToRegenerate);
    } catch (error) {
      console.error('Error saving business types:', error);
      showSuccess('Failed to save business types. Please try again.');
    } finally {
      setSavingBusinessTypes(false);
    }
  };

  const handleCreateClient = async (clientData) => {
    setCreatingClient(true);
    try {
      const response = await api.request('/clients/create', {
        method: 'POST',
        body: JSON.stringify(clientData)
      });

      if (response) {
        // Refresh clients data
        await fetchClients();
        setShowCreateClientForm(false);

        // Optionally select the newly created client
        if (response.client) {
          setSelectedClient(response.client);
        }

        // Show success message
        showSuccess('Client created successfully!');
      }
    } catch (error) {
      console.error('Error creating client:', error);
      throw error; // Re-throw to let the form handle the error
    } finally {
      setCreatingClient(false);
    }
  };

  const handleCancelBusinessTypes = () => {
    setShowBusinessTypeManager(false);
    setEditingClient(null);
    setClientBusinessTypes([]);
  };

  const handleSaveClientName = async () => {
    if (!editingClient || !editForm.name.trim()) return;

    setSaving(true);
    try {
      // Use the API service instead of hardcoded URL
      await api.request('/clients/update-name', {
        method: 'POST',
        body: JSON.stringify({
          email: editingClient.email,
          name: editForm.name.trim(),
          date_of_birth: editForm.date_of_birth || null,
          gender: editForm.gender || null
        })
      });

      // Refresh clients
      const data = await api.request('/clients');
      setClients(data);
      setEditingClient(null);
      setShowEditClientModal(false); // Close the modal
      setSaving(false);

      // Show success message
      showSuccess('Client details updated successfully!');
    } catch (err) {
      console.error('Error updating client:', err);
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setShowEditClientModal(false); // Close the modal
    setEditForm({
      name: '',
      email: '',
      date_of_birth: '',
      gender: ''
    });
  };



  if (loading) {
    return (
      <div className="h-full bg-background p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-4">Clients</h1>
          <div className="h-10 bg-muted rounded animate-pulse mb-4"></div>
        </div>
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-background p-6 flex items-center justify-center">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="p-6 text-center">
            <div className="text-destructive mb-4">
              <Building2 className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Clients</h3>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-background relative">
      {/* Success Message Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-border/50 p-4 sm:p-6 bg-card/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Clients</h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                onClick={() => setShowCreateClientForm(true)}
                className="flex items-center gap-2"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Client</span>
                <span className="sm:hidden">Add</span>
              </Button>
              <Button
                onClick={handleExtractClients}
                disabled={extracting}
                variant="outline"
                size="sm"
              >
                {extracting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                    <span className="hidden sm:inline">Extracting...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Extract Clients</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Button
                onClick={() => setClientFilter('all')}
                variant={clientFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="whitespace-nowrap"
              >
                All ({clients.length})
              </Button>
              <Button
                onClick={() => setClientFilter('with-upcoming')}
                variant={clientFilter === 'with-upcoming' ? 'default' : 'outline'}
                size="sm"
                className="whitespace-nowrap"
              >
                <span className="hidden sm:inline">With Upcoming</span>
                <span className="sm:hidden">Upcoming</span>
              </Button>
              <Button
                onClick={() => setClientFilter('no-upcoming')}
                variant={clientFilter === 'no-upcoming' ? 'default' : 'outline'}
                size="sm"
                className="whitespace-nowrap"
              >
                <span className="hidden sm:inline">Need Follow-up</span>
                <span className="sm:hidden">Follow-up</span>
              </Button>
            </div>

            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* List View (Table) */}
        <div className="flex-1 overflow-auto">
            <div className="min-w-[800px] sm:min-w-full">
              {/* Table Header */}
              <div className="sticky top-0 bg-muted/50 border-b border-border/50 px-4 sm:px-6 py-3 z-10">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {/* Sortable: Client Name */}
                <div
                  className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('name')}
                >
                  Client Name
                  {sortConfig.key === 'name' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>

                {/* Sortable: Client Email */}
                <div
                  className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('email')}
                >
                  Client Email
                  {sortConfig.key === 'email' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>

                {/* Sortable: Past Meetings */}
                <div
                  className="col-span-1 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('meeting_count')}
                >
                  Past Meetings
                  {sortConfig.key === 'meeting_count' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>

                {/* Sortable: Next Meeting */}
                <div
                  className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('next_meeting')}
                >
                  Next Meeting
                  {sortConfig.key === 'next_meeting' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>

                {/* Sortable: Business Types */}
                <div
                  className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('business_types')}
                >
                  Business Types
                  {sortConfig.key === 'business_types' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>

                {/* Sortable: Total IAF */}
                <div
                  className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('iaf_expected')}
                >
                  Total IAF
                  {sortConfig.key === 'iaf_expected' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>

                {/* Non-sortable: Actions */}
                <div className="col-span-1">Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border/50">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="px-6 py-3 hover:bg-muted/30 cursor-pointer transition-colors group"
                  onClick={() => handleClientClick(client)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center text-sm">
                    {/* Client Information - Enhanced */}
                    <div className="col-span-3 flex items-center gap-3">
                      <Avatar className="w-10 h-10 bg-primary/10 text-primary flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                          {getUserInitials(client.name, client.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate mb-1">
                          {client.name || client.email}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {client.email && client.email.includes('@') ? client.email : 'No email provided'}
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="col-span-2 text-muted-foreground">
                      <div className="text-sm truncate">
                        {client.email && client.email.includes('@') ? client.email : 'No email'}
                      </div>
                      {client.phone && (
                        <div className="text-xs text-muted-foreground truncate">
                          {client.phone}
                        </div>
                      )}
                    </div>

                    {/* Past Meetings Count */}
                    <div className="col-span-1 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        {client.meeting_count || 0}
                      </span>
                    </div>

                    {/* Next Meeting Date */}
                    <div className="col-span-2">
                      {getNextMeetingDate(client) ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Calendar className="w-3 h-3" />
                          <span className="text-xs">{formatDate(getNextMeetingDate(client))}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">No upcoming</span>
                        </div>
                      )}
                    </div>

                    {/* Business Type - Show all types or primary */}
                    <div className="col-span-2">
                      {client.business_types && client.business_types.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {client.business_types.slice(0, 2).map((type, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {type}
                            </span>
                          ))}
                          {client.business_types.length > 2 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              +{client.business_types.length - 2}
                            </span>
                          )}
                        </div>
                      ) : client.business_type ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {client.business_type}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not set</span>
                      )}
                    </div>

                    {/* IAF Expected - Show total from all business types */}
                    <div className="col-span-1 text-xs font-medium text-foreground">
                      {client.iaf_expected ? (
                        <span className="text-green-600">
                          £{parseFloat(client.iaf_expected).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the row click
                          handleEditBusinessTypes(client);
                        }}
                        className="h-7 px-2 text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                      >
                        <Building2 className="w-3 h-3 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

              {/* Empty State */}
              {filteredClients.length === 0 && (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No clients found</h3>
                  <p className="text-muted-foreground">
                    {search ? 'Try adjusting your search terms.' : 'Extract clients from meetings to get started.'}
                  </p>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Client Detail Panel - Responsive Sidebar */}
      {detailPanelOpen && selectedClient && (
        <>
          {/* Mobile Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setDetailPanelOpen(false)}
          />

          {/* Detail Panel - Expanded Width */}
          <div className="fixed right-0 top-0 h-full w-full lg:w-[45%] xl:w-[40%] bg-card border-l border-border shadow-xl z-50 overflow-hidden flex flex-col">
            {/* Panel Header */}
            <div className="sticky top-0 bg-background border-b border-border/50 p-4 sm:p-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <Avatar className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 text-primary flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-base sm:text-lg font-semibold">
                    {getUserInitials(selectedClient.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                    {selectedClient.name || 'Unnamed Client'}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {selectedClient.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClient(selectedClient)}
                >
                  <Edit3 className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailPanelOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Panel Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

              {/* ═══════════════════════════════════════════════════════════════════
                  CLIENT OVERVIEW ZONE - Dominant summary at top
                  ═══════════════════════════════════════════════════════════════════ */}

              {/* Client Summary Card - High Contrast, Dominant Element */}
              <Card className="border-0 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/20 rounded-lg">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-white/90">Client Summary</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGenerateSummary(selectedClient.id)}
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

              {/* KPI Blocks - Compact grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Business Types Count */}
                <div className="bg-card border border-border/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Business Types</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {selectedClient.business_types_data?.filter(bt => !bt.not_proceeding).length || 0}
                  </div>
                </div>

                {/* Expected Fees Total */}
                <div className="bg-card border border-border/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <PoundSterling className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs text-muted-foreground">Expected Fees</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    £{(selectedClient.business_types_data?.reduce((sum, bt) => {
                      if (bt.not_proceeding) return sum;
                      return sum + (parseFloat(bt.iaf_expected) || 0);
                    }, 0) || 0).toLocaleString()}
                  </div>
                </div>

                {/* Earliest Close Date */}
                <div className="bg-card border border-border/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs text-muted-foreground">Next Close</span>
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {(() => {
                      const dates = selectedClient.business_types_data
                        ?.filter(bt => bt.expected_close_date && !bt.not_proceeding)
                        .map(bt => new Date(bt.expected_close_date))
                        .sort((a, b) => a - b);
                      if (dates && dates.length > 0) {
                        return dates[0].toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                      }
                      return '—';
                    })()}
                  </div>
                </div>

                {/* Meetings Count */}
                <div className="bg-card border border-border/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Meetings</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {selectedClient.meeting_count || 0}
                  </div>
                  {selectedClient.has_upcoming_meetings && (
                    <div className="text-xs text-green-600 mt-0.5">
                      {selectedClient.upcoming_meetings_count} upcoming
                    </div>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════
                  OPERATIONAL SECTIONS - Business Details & Action Items
                  ═══════════════════════════════════════════════════════════════════ */}

              {/* Business Details Card */}
              <Card className="border-border/50">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Business Details</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditBusinessTypes(selectedClient)}
                      className="h-7 text-xs"
                    >
                      <Edit3 className="w-3 h-3 mr-1.5" />
                      Manage
                    </Button>
                  </div>
                  <div className="p-4">
                    {selectedClient.business_types_data && selectedClient.business_types_data.length > 0 ? (
                      <div className="space-y-3">
                        {selectedClient.business_types_data.map((bt, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${bt.not_proceeding ? 'bg-muted/30 border-border/30 opacity-60' : 'bg-muted/50 border-border/50'}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
                                  onClick={() => navigate(`/pipeline?businessType=${encodeURIComponent(bt.business_type)}`)}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditBusinessTypes(selectedClient)}
                        >
                          <Plus className="w-3 h-3 mr-1.5" />
                          Add Business Type
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Action Items Card */}
              <Card className="border-border/50">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Action Items</h3>
                      {(() => {
                        const pendingCount = (clientTodos?.filter(t => t.status !== 'completed').length || 0) +
                          (clientActionItems?.reduce((sum, m) => sum + m.actionItems.filter(i => !i.completed).length, 0) || 0);
                        return pendingCount > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                            {pendingCount} pending
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="p-4">
                    {/* Add New Action Item Form */}
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add new action item..."
                          value={newActionItemText}
                          onChange={(e) => setNewActionItemText(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddActionItem()}
                          className="flex-1 h-9 text-sm"
                        />
                        <Button
                          onClick={handleAddActionItem}
                          disabled={!newActionItemText.trim() || addingActionItem}
                          size="sm"
                          className="h-9"
                        >
                          {addingActionItem ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Manual Todos */}
                    {clientTodos && clientTodos.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-xs font-medium text-muted-foreground">Manual Tasks</p>
                        {clientTodos.filter(t => t.status !== 'completed').map((todo) => (
                          <div key={todo.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => toggleTodoCompletion(todo.id, todo.status)}
                              className="mt-0.5 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                            />
                            <p className="text-sm text-foreground flex-1">{todo.title}</p>
                          </div>
                        ))}
                        {clientTodos.filter(t => t.status === 'completed').map((todo) => (
                          <div key={todo.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 opacity-60">
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => toggleTodoCompletion(todo.id, todo.status)}
                              className="mt-0.5 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                            />
                            <p className="text-sm line-through text-muted-foreground flex-1">{todo.title}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meeting-extracted Action Items */}
                    {clientActionItems && clientActionItems.length > 0 && clientActionItems.some(m => m.actionItems.length > 0) ? (
                      <div className="space-y-3">
                        {clientActionItems.map(meeting => {
                          const pendingItems = meeting.actionItems.filter(item => !item.completed);
                          const completedItems = meeting.actionItems.filter(item => item.completed);
                          if (meeting.actionItems.length === 0) return null;

                          return (
                            <div key={meeting.meetingId} className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                                <span>From: {meeting.meetingTitle}</span>
                                {pendingItems.length > 0 && (
                                  <span className="text-orange-600">{pendingItems.length} pending</span>
                                )}
                              </p>
                              {pendingItems.map((item) => (
                                <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() => toggleActionItemCompletion(item.id, item.completed)}
                                    className="mt-0.5 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                                  />
                                  <p className="text-sm text-foreground flex-1">{item.actionText}</p>
                                </div>
                              ))}
                              {completedItems.map((item) => (
                                <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 opacity-60">
                                  <input
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => toggleActionItemCompletion(item.id, item.completed)}
                                    className="mt-0.5 w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                                  />
                                  <p className="text-sm line-through text-muted-foreground flex-1">{item.actionText}</p>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ) : clientTodos.length === 0 && (
                      <div className="text-center py-4">
                        <CheckCircle2 className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          No action items yet. Add one above or they'll appear from meeting transcripts.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ═══════════════════════════════════════════════════════════════════
                  SECONDARY SECTIONS - Collapsed by default
                  ═══════════════════════════════════════════════════════════════════ */}

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
                          clientId: selectedClient.id,
                          clientName: selectedClient.name,
                          clientEmail: selectedClient.email,
                          meetingCount: selectedClient.meetings?.length || 0,
                          pipelineStatus: selectedClient.pipeline_stage || 'Unknown',
                          likelyValue: selectedClient.likely_value || 0
                        }}
                        clientId={selectedClient.id}
                        clientName={selectedClient.name}
                      />
                    </div>
                  </div>
                )}
              </Card>

              {/* Meeting History - Collapsible */}
              <Card className="border-border/50">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setMeetingHistoryCollapsed(!meetingHistoryCollapsed)}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Meeting History</h3>
                    {selectedClient.meetings && selectedClient.meetings.length > 0 && (
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
                    {selectedClient.meetings && selectedClient.meetings.length > 0 ? (
                      <div className="space-y-3">
                        {selectedClient.meetings
                          .sort((a, b) => new Date(b.starttime) - new Date(a.starttime))
                          .map(meeting => {
                            const meetingActionItems = clientActionItems.find(m => m.meetingId === meeting.id);
                            const pendingItems = meetingActionItems?.actionItems.filter(item => !item.completed) || [];
                            const completedItems = meetingActionItems?.actionItems.filter(item => item.completed) || [];

                            return (
                              <div
                                key={meeting.id}
                                className="p-3 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => navigateToMeeting(meeting.googleeventid || meeting.id)}
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <h4 className="text-sm font-medium text-foreground hover:text-primary">
                                    {meeting.title}
                                  </h4>
                                  {isMeetingComplete(meeting) && (
                                    <div className="flex items-center gap-1 text-blue-600">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span className="text-xs">Complete</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mb-2">
                                  {formatDate(meeting.starttime)} • {new Date(meeting.starttime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                                {meeting.quick_summary && (
                                  <p className="text-xs text-foreground/80 line-clamp-2 mb-2">
                                    {meeting.quick_summary}
                                  </p>
                                )}
                                {meetingActionItems && meetingActionItems.actionItems.length > 0 && (
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
                      clientId={selectedClient.id}
                      clientName={selectedClient.name}
                      meetings={selectedClient.meetings || []}
                    />
                  </div>
                )}
              </Card>

            </div>
          </div>
        </>
      )}



      {/* Edit Client Modal */}
      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Client Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Client Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="Enter client name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  disabled
                  className="w-full p-2 border border-border rounded-md bg-muted text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Gender</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveClientName} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Type Manager Modal */}
      {showBusinessTypeManager && editingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-[100]">
            <h3 className="text-lg font-semibold mb-4">
              Manage Business Types - {editingClient.name}
            </h3>
            <BusinessTypeManager
              clientId={editingClient.id}
              initialBusinessTypes={clientBusinessTypes}
              onSave={handleSaveBusinessTypes}
              onCancel={handleCancelBusinessTypes}
              saving={savingBusinessTypes}
            />
          </div>
        </div>
      )}

      {/* Create Client Form Modal */}
      {showCreateClientForm && (
        <CreateClientForm
          onClose={() => setShowCreateClientForm(false)}
          onSuccess={handleCreateClient}
          isSubmitting={creatingClient}
        />
      )}
    </div>
  );
}