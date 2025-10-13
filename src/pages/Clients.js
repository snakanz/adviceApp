import React, { useState, useEffect, useCallback } from 'react';
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
  Plus
} from 'lucide-react';
import { api } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PipelineEntryForm from '../components/PipelineEntryForm';
import BusinessTypeManager from '../components/BusinessTypeManager';
import CreateClientForm from '../components/CreateClientForm';

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
  const [showPipelineForm, setShowPipelineForm] = useState(false);
  const [pipelineClient, setPipelineClient] = useState(null);
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [clientFilter, setClientFilter] = useState('all'); // 'all', 'with-upcoming', 'no-upcoming'
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [showBusinessTypeManager, setShowBusinessTypeManager] = useState(false);
  const [clientBusinessTypes, setClientBusinessTypes] = useState([]);
  const [savingBusinessTypes, setSavingBusinessTypes] = useState(false);
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();



  // Helper function to show success message
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
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

  // Refresh data when page becomes visible (e.g., navigating back from Meetings page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh client data to get latest summaries
        fetchClients(clientFilter);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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



  const filteredClients = clients
    .filter(c => (`${c.name || c.email || ''}`).toLowerCase().includes(debouncedSearch.toLowerCase())); // Show all clients

  // Helper function to get next meeting date
  const getNextMeetingDate = (client) => {
    if (!client.meetings || client.meetings.length === 0) return null;

    const now = new Date();
    const upcomingMeetings = client.meetings
      .filter(meeting => new Date(meeting.starttime) > now)
      .sort((a, b) => new Date(a.starttime) - new Date(b.starttime));

    return upcomingMeetings.length > 0 ? upcomingMeetings[0].starttime : null;
  };

  // Helper function to check if client has future meetings
  const hasFutureMeetings = (client) => {
    return getNextMeetingDate(client) !== null;
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



  const getUserInitials = (name) => {
    if (!name) return 'C';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Add/remove email fields
  // Email management functions (currently unused but kept for future multi-email support)
  // const addEmailField = () => setEditForm(f => ({ ...f, emails: [...(f.emails || ['']), ''] }));
  // const removeEmailField = idx => setEditForm(f => ({ ...f, emails: f.emails.filter((_, i) => i !== idx) }));
  // const handleEmailChange = (idx, value) => setEditForm(f => ({ ...f, emails: f.emails.map((e, i) => i === idx ? value : e) }));

  const handleEditClient = async (client) => {
    setEditingClient(client);
    setEditForm({
      name: client.name || '',
      email: client.email || '',
      pipeline_stage: client.pipeline_stage || '',
      business_type: client.business_type || '',
      iaf_expected: client.iaf_expected || client.likely_value || '', // Handle both old and new field names
      business_amount: client.business_amount || '',
      regular_contribution_type: client.regular_contribution_type || '',
      regular_contribution_amount: client.regular_contribution_amount || '',
      likely_close_month: client.likely_close_month || ''
    });

    // Load client business types
    try {
      const businessTypes = await api.request(`/clients/${client.id}/business-types`);
      setClientBusinessTypes(businessTypes);
    } catch (error) {
      console.error('Error loading business types:', error);
      setClientBusinessTypes([]);
    }
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
          pipeline_stage: editForm.pipeline_stage,
          business_type: editForm.business_type,
          iaf_expected: editForm.iaf_expected,
          business_amount: editForm.business_amount,
          regular_contribution_type: editForm.regular_contribution_type,
          regular_contribution_amount: editForm.regular_contribution_amount,
          likely_close_month: editForm.likely_close_month
        })
      });

      // Refresh clients
      const data = await api.request('/clients');
      setClients(data);
      setEditingClient(null);
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
    setEditForm({
      name: '',
      email: '',
      business_type: '',
      iaf_expected: '',
      business_amount: '',
      regular_contribution_type: '',
      regular_contribution_amount: '',
      likely_close_month: ''
    });
  };

  const handleCreatePipelineEntry = (client) => {
    setPipelineClient(client);
    setShowPipelineForm(true);
  };

  const handleClosePipelineForm = () => {
    setShowPipelineForm(false);
    setPipelineClient(null);
  };

  const handleSubmitPipelineEntry = async (formData) => {
    if (!pipelineClient) return;

    setCreatingPipeline(true);
    try {
      const response = await api.request(`/clients/${pipelineClient.id}/pipeline-entry`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response) {
        // Refresh clients data to show updated pipeline information
        await fetchClients();

        // Close the form
        handleClosePipelineForm();

        // Show success message
        showSuccess('Pipeline entry created successfully!');
        console.log('Pipeline entry created successfully:', response);
      }
    } catch (error) {
      console.error('Error creating pipeline entry:', error);
      showSuccess('Failed to create pipeline entry. Please try again.');
    } finally {
      setCreatingPipeline(false);
    }
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
        <div className="border-b border-border/50 p-6 bg-card/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">Clients</h1>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowCreateClientForm(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Client
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
                    Extracting...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Extract Clients
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <Button
                onClick={() => setClientFilter('all')}
                variant={clientFilter === 'all' ? 'default' : 'outline'}
                size="sm"
              >
                All ({clients.length})
              </Button>
              <Button
                onClick={() => setClientFilter('with-upcoming')}
                variant={clientFilter === 'with-upcoming' ? 'default' : 'outline'}
                size="sm"
              >
                With Upcoming
              </Button>
              <Button
                onClick={() => setClientFilter('no-upcoming')}
                variant={clientFilter === 'no-upcoming' ? 'default' : 'outline'}
                size="sm"
              >
                Need Follow-up
              </Button>
            </div>

            <div className="relative flex-1 max-w-md">
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

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            {/* Table Header */}
            <div className="sticky top-0 bg-muted/50 border-b border-border/50 px-6 py-3">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Client Name</div>
                <div className="col-span-2">Client Email</div>
                <div className="col-span-1 text-center">Past Meetings</div>
                <div className="col-span-2">Next Meeting</div>
                <div className="col-span-2">Business Types</div>
                <div className="col-span-1">Total IAF</div>
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
                          {getUserInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate mb-1">
                          {client.name || 'Unnamed Client'}
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
                      {!hasFutureMeetings(client) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the row click
                            handleCreatePipelineEntry(client);
                          }}
                          className="h-7 px-2 text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Pipeline
                        </Button>
                      )}
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

          {/* Detail Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md lg:w-96 bg-card border-l border-border shadow-xl z-50 overflow-hidden flex flex-col">
            {/* Panel Header */}
            <div className="sticky top-0 bg-background border-b border-border/50 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12 bg-primary/10 text-primary">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {getUserInitials(selectedClient.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {selectedClient.name || 'Unnamed Client'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedClient.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClient(selectedClient)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditBusinessTypes(selectedClient)}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Business Types
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

            {/* Panel Content */}
            <div className="p-6 space-y-6">
              {/* Client Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Meetings</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {selectedClient.meeting_count || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedClient.has_upcoming_meetings ?
                        `${selectedClient.upcoming_meetings_count} upcoming` :
                        'No upcoming meetings'
                      }
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Business Types</span>
                    </div>
                    {selectedClient.business_types && selectedClient.business_types.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {selectedClient.business_types.map((type, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {type}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total IAF: {selectedClient.iaf_expected ?
                            `£${parseFloat(selectedClient.iaf_expected).toLocaleString()}` :
                            'Not specified'
                          }
                        </div>
                        {selectedClient.business_amount && (
                          <div className="text-xs text-muted-foreground">
                            Total Business: £{parseFloat(selectedClient.business_amount).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No business types set
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Ask Advicly Button */}
              <Button
                className="w-full"
                onClick={() => {
                  const clientMeetings = selectedClient.meetings || [];
                  const params = new URLSearchParams({
                    contextType: 'client',
                    client: selectedClient.id,
                    clientName: selectedClient.name,
                    clientEmail: selectedClient.email,
                    meetingCount: clientMeetings.length.toString(),
                    pipelineStatus: selectedClient.pipeline_stage || 'Unknown',
                    likelyValue: selectedClient.likely_value?.toString() || '0'
                  });

                  if (clientMeetings.length > 0) {
                    const lastMeeting = clientMeetings.sort((a, b) =>
                      new Date(b.starttime) - new Date(a.starttime)
                    )[0];
                    params.set('lastMeetingDate', lastMeeting.starttime);
                    params.set('lastMeetingTitle', lastMeeting.title);
                  }

                  navigate(`/ask-advicly?${params.toString()}`);
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Ask About {selectedClient.name}
              </Button>

              {/* Meeting History */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Meeting History</h3>
                {selectedClient.meetings && selectedClient.meetings.length > 0 ? (
                  <div className="space-y-3">
                    {selectedClient.meetings
                      .sort((a, b) => new Date(b.starttime) - new Date(a.starttime))
                      .map(meeting => (
                        <Card key={meeting.id} className="border-border/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4
                                className="font-medium text-foreground cursor-pointer hover:text-primary"
                                onClick={() => navigateToMeeting(meeting.googleeventid || meeting.id)}
                              >
                                {meeting.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                {isMeetingComplete(meeting) && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span className="text-xs">Complete</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              {formatDate(meeting.starttime)} • {new Date(meeting.starttime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            {meeting.quick_summary && (
                              <div className="text-sm text-foreground">
                                {meeting.quick_summary}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    }
                  </div>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="p-6 text-center">
                      <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No meetings found</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </>
      )}



      {/* Edit Client Modal */}
      {editingClient && (
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
                <label className="block text-sm font-medium mb-2">Pipeline Stage</label>
                <select
                  value={editForm.pipeline_stage}
                  onChange={(e) => setEditForm({ ...editForm, pipeline_stage: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="">Select pipeline stage</option>
                  <option value="Client Signed">Client Signed</option>
                  <option value="Waiting to Sign">Waiting to Sign</option>
                  <option value="Waiting on Paraplanning">Waiting on Paraplanning</option>
                  <option value="Have Not Written Advice">Have Not Written Advice</option>
                  <option value="Need to Book Meeting">Need to Book Meeting</option>
                  <option value="Can't Contact Client">Can't Contact Client</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Business Type</label>
                <select
                  value={editForm.business_type}
                  onChange={(e) => setEditForm({ ...editForm, business_type: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="">Select business type</option>
                  <option value="Pension">Pension</option>
                  <option value="ISA">ISA</option>
                  <option value="Bond">Bond</option>
                  <option value="Investment">Investment</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Mortgage">Mortgage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">IAF Expected (£)</label>
                <input
                  type="number"
                  value={editForm.iaf_expected}
                  onChange={(e) => setEditForm({ ...editForm, iaf_expected: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="Enter IAF expected in pounds"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Business Amount (£)</label>
                <input
                  type="number"
                  value={editForm.business_amount}
                  onChange={(e) => setEditForm({ ...editForm, business_amount: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="Enter business amount"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Regular Contribution Type</label>
                <input
                  type="text"
                  value={editForm.regular_contribution_type}
                  onChange={(e) => setEditForm({ ...editForm, regular_contribution_type: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="e.g., Pension Regular Monthly"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Regular Contribution Amount</label>
                <input
                  type="text"
                  value={editForm.regular_contribution_amount}
                  onChange={(e) => setEditForm({ ...editForm, regular_contribution_amount: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  placeholder="e.g., £3,000 per month"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Next IAF Expected</label>
                <input
                  type="month"
                  value={editForm.likely_close_month}
                  onChange={(e) => setEditForm({ ...editForm, likely_close_month: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
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

      {/* Pipeline Entry Form Modal */}
      {showPipelineForm && pipelineClient && (
        <PipelineEntryForm
          client={pipelineClient}
          onClose={handleClosePipelineForm}
          onSubmit={handleSubmitPipelineEntry}
          isSubmitting={creatingPipeline}
        />
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